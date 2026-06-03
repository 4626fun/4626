/**
 * Hyperliquid read-only wrapper.
 *
 * Uses the public Hyperliquid Info API (https://api.hyperliquid.xyz/info)
 * to pull `clearinghouseState` (current margin/account value) and
 * `userFills` (trade history) for a given wallet. Entirely public, no auth.
 *
 * Everything here is fail-open: if Hyperliquid is down, requests time out,
 * or responses don't match the expected shape, we return a typed "null" and
 * callers skip the Hyperliquid contribution to the composite score.
 */

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_INFO_URL = 'https://api.hyperliquid.xyz/info'
const FETCH_TIMEOUT_MS = 8_000
/** Hard cap on response size to protect against a misbehaving endpoint. */
const MAX_RESPONSE_BYTES = 2_000_000
/** Seconds in a 30-day window. */
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

// ---------------------------------------------------------------------------
// Types (subset of the Hyperliquid schema — we read only what we need)
// ---------------------------------------------------------------------------

export type HyperliquidClearinghouseState = {
  accountValueUsd: number | null
  totalNtlPosUsd: number | null
  totalRawUsdUsd: number | null
  // Richer data for room 1659 position awareness
  crossAccountValueUsd?: number | null
  withdrawableUsd?: number | null
  assetPositions?: Array<{
    coin: string
    entryPx: number | null
    positionValue: number | null
    unrealizedPnl: number | null
    liquidationPx: number | null
    leverage: number | null
    side?: 'long' | 'short' | null
  }>
}

export type HyperliquidUserFill = {
  closedPnl: number
  fee: number
  time: number
}

export type HyperliquidUserFillDetailed = HyperliquidUserFill & {
  coin: string | null
  px: number | null
  sz: number | null
  dir: string | null
  side: 'long' | 'short' | null
  startPosition: number | null
}

export type HyperliquidCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export type HyperliquidSnapshot = {
  address: string
  accountValueUsd: number | null
  pnl30dUsd: number | null
  fills30d: number
  fetchedAt: string
  ok: boolean
  errorReason: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInfoUrl(): string {
  const override = (process.env.HYPERLIQUID_INFO_URL ?? '').trim()
  return override || DEFAULT_INFO_URL
}

function parseFloatSafe(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

async function fetchJsonBounded(
  url: string,
  body: unknown,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<unknown | { __error: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { __error: `http_${res.status}` }
    const contentLength = Number(res.headers.get('content-length') ?? '0')
    if (contentLength > 0 && contentLength > MAX_RESPONSE_BYTES) {
      return { __error: 'response_too_large' }
    }
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) return { __error: 'response_too_large' }
    try {
      return JSON.parse(text) as unknown
    } catch {
      return { __error: 'invalid_json' }
    }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { __error: name === 'AbortError' ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timer)
  }
}

function isErrorShape(value: unknown): value is { __error: string } {
  return typeof value === 'object' && value !== null && '__error' in (value as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getClearinghouseState(
  address: string,
): Promise<HyperliquidClearinghouseState | null> {
  const url = getInfoUrl()
  const raw = await fetchJsonBounded(url, {
    type: 'clearinghouseState',
    user: address.toLowerCase(),
  })
  if (isErrorShape(raw)) return null
  if (!raw || typeof raw !== 'object') return null
  const data = raw as any

  const marginSummary = data?.marginSummary ?? {}
  const crossMarginSummary = data?.crossMarginSummary ?? {}

  const result: HyperliquidClearinghouseState = {
    accountValueUsd: parseFloatSafe(marginSummary.accountValue),
    totalNtlPosUsd: parseFloatSafe(marginSummary.totalNtlPos),
    totalRawUsdUsd: parseFloatSafe(marginSummary.totalRawUsd),
    crossAccountValueUsd: parseFloatSafe(crossMarginSummary.accountValue),
    withdrawableUsd: parseFloatSafe(data?.withdrawable),
  }

  // Parse assetPositions for liquidation / position details (critical for room 1659)
  if (Array.isArray(data?.assetPositions)) {
    result.assetPositions = data.assetPositions
      .map((pos: any) => {
        const position = pos?.position ?? pos
        if (!position) return null

        const coin = position.coin ?? 'UNKNOWN'
        const entryPx = parseFloatSafe(position.entryPx)
        const positionValue = parseFloatSafe(position.positionValue)
        const unrealizedPnl = parseFloatSafe(position.unrealizedPnl)
        const liquidationPx = parseFloatSafe(position.liquidationPx)
        const leverage = parseFloatSafe(position.leverage?.value ?? position.leverage)

        let side: 'long' | 'short' | null = null
        if (position.szi) {
          const szi = parseFloatSafe(position.szi)
          if (szi !== null) side = szi > 0 ? 'long' : 'short'
        }

        return {
          coin,
          entryPx,
          positionValue,
          unrealizedPnl,
          liquidationPx,
          leverage,
          side,
        }
      })
      .filter(Boolean)
  }

  return result
}

/** Compact position summary for `/help` and `/halp` in Hermit command rooms. */
export function formatHyperliquidPositionHelpBlock(
  state: HyperliquidClearinghouseState | null,
  walletAddress?: string | null,
): string {
  const walletLabel = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'your wallet'
  const lines: string[] = [`**Your position** (${walletLabel})`]

  const firstPos = state?.assetPositions?.[0]
  if (!firstPos) {
    lines.push('- No open Hyperliquid position for this wallet.')
    return lines.join('\n')
  }

  const side = (firstPos.side ?? 'flat').toUpperCase()
  const size = firstPos.positionValue != null ? `$${Number(firstPos.positionValue).toFixed(0)}` : '?'
  const pnl =
    firstPos.unrealizedPnl != null
      ? `${firstPos.unrealizedPnl >= 0 ? '+' : ''}$${Number(firstPos.unrealizedPnl).toFixed(0)} PnL`
      : null
  const liq =
    firstPos.liquidationPx != null ? `LIQ @ $${Number(firstPos.liquidationPx).toFixed(2)}` : null
  lines.push(
    `- ${side} ${firstPos.coin ?? 'HL'} ${size}${pnl ? ` · ${pnl}` : ''}${liq ? ` · ${liq}` : ''}`,
  )
  return lines.join('\n')
}

export async function getUserFills30d(
  address: string,
  now: Date = new Date(),
): Promise<HyperliquidUserFill[] | null> {
  const startTimeMs = now.getTime() - THIRTY_DAYS_SECONDS * 1_000
  return getUserFillsByTime(address, startTimeMs)
}

export async function getUserFillsByTime(
  address: string,
  startTimeMs: number,
): Promise<HyperliquidUserFill[] | null> {
  const url = getInfoUrl()
  const raw = await fetchJsonBounded(url, {
    type: 'userFillsByTime',
    user: address.toLowerCase(),
    startTime: startTimeMs,
  })
  if (isErrorShape(raw)) return null
  if (!Array.isArray(raw)) return null
  const out: HyperliquidUserFill[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const fill = entry as Record<string, unknown>
    const closed = parseFloatSafe(fill.closedPnl) ?? 0
    const fee = parseFloatSafe(fill.fee) ?? 0
    const timeRaw = fill.time
    const time = typeof timeRaw === 'number' ? timeRaw : Number(timeRaw ?? 0)
    if (!Number.isFinite(time)) continue
    out.push({ closedPnl: closed, fee, time })
  }
  return out
}

export async function getUserFillsByTimeDetailed(
  address: string,
  startTimeMs: number,
): Promise<HyperliquidUserFillDetailed[] | null> {
  const url = getInfoUrl()
  const raw = await fetchJsonBounded(url, {
    type: 'userFillsByTime',
    user: address.toLowerCase(),
    startTime: startTimeMs,
  })
  if (isErrorShape(raw)) return null
  if (!Array.isArray(raw)) return null
  const out: HyperliquidUserFillDetailed[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const fill = entry as Record<string, unknown>
    const closed = parseFloatSafe(fill.closedPnl) ?? 0
    const fee = parseFloatSafe(fill.fee) ?? 0
    const timeRaw = fill.time
    const time = typeof timeRaw === 'number' ? timeRaw : Number(timeRaw ?? 0)
    if (!Number.isFinite(time)) continue

    const dirRaw = typeof fill.dir === 'string' ? fill.dir.trim() : null
    const loweredDir = (dirRaw ?? '').toLowerCase()
    let side: 'long' | 'short' | null = null
    if (loweredDir.includes('long') || loweredDir.includes('buy')) side = 'long'
    if (loweredDir.includes('short') || loweredDir.includes('sell')) side = 'short'

    out.push({
      closedPnl: closed,
      fee,
      time,
      coin: typeof fill.coin === 'string' ? fill.coin : null,
      px: parseFloatSafe(fill.px),
      sz: parseFloatSafe(fill.sz),
      dir: dirRaw,
      side,
      startPosition: parseFloatSafe(fill.startPosition),
    })
  }
  return out
}

export async function getCandleSnapshot(params: {
  coin: string
  interval: string
  startTimeMs: number
  endTimeMs: number
}): Promise<HyperliquidCandle[] | null> {
  const url = getInfoUrl()
  const raw = await fetchJsonBounded(url, {
    type: 'candleSnapshot',
    req: {
      coin: params.coin,
      interval: params.interval,
      startTime: params.startTimeMs,
      endTime: params.endTimeMs,
    },
  })
  if (isErrorShape(raw)) return null
  if (!Array.isArray(raw)) return null
  const out: HyperliquidCandle[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const candle = entry as Record<string, unknown>
    const time =
      typeof candle.t === 'number'
        ? candle.t
        : typeof candle.time === 'number'
          ? candle.time
          : Number(candle.T ?? 0)
    if (!Number.isFinite(time)) continue

    const open = parseFloatSafe(candle.o)
    const high = parseFloatSafe(candle.h)
    const low = parseFloatSafe(candle.l)
    const close = parseFloatSafe(candle.c)
    if (open == null || high == null || low == null || close == null) continue
    out.push({
      time,
      open,
      high,
      low,
      close,
      volume: parseFloatSafe(candle.v),
    })
  }
  return out
}

/**
 * Compose a Hyperliquid snapshot for an address:
 *  - account value from `clearinghouseState`
 *  - realized PnL (closedPnl - fees) over the last 30 days from `userFillsByTime`
 *
 * Returns `ok: false` with a reason if Hyperliquid is unreachable. Never throws.
 */
export async function getHyperliquidSnapshot(address: string): Promise<HyperliquidSnapshot> {
  const normalized = address.toLowerCase()
  const fetchedAt = new Date().toISOString()
  const [state, fills] = await Promise.all([
    getClearinghouseState(normalized),
    getUserFills30d(normalized),
  ])

  if (state === null && fills === null) {
    return {
      address: normalized,
      accountValueUsd: null,
      pnl30dUsd: null,
      fills30d: 0,
      fetchedAt,
      ok: false,
      errorReason: 'hyperliquid_unavailable',
    }
  }

  let pnl: number | null = null
  if (fills) {
    pnl = 0
    for (const f of fills) {
      pnl += (Number.isFinite(f.closedPnl) ? f.closedPnl : 0) - (Number.isFinite(f.fee) ? f.fee : 0)
    }
  }

  return {
    address: normalized,
    accountValueUsd: state?.accountValueUsd ?? null,
    pnl30dUsd: pnl,
    fills30d: fills?.length ?? 0,
    fetchedAt,
    ok: true,
    errorReason: null,
  }
}
