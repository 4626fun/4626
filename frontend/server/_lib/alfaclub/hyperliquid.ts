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
}

export type HyperliquidUserFill = {
  closedPnl: number
  fee: number
  time: number
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
  const data = raw as {
    marginSummary?: {
      accountValue?: unknown
      totalNtlPos?: unknown
      totalRawUsd?: unknown
    }
  }
  const summary = data.marginSummary
  if (!summary || typeof summary !== 'object') return null
  return {
    accountValueUsd: parseFloatSafe(summary.accountValue),
    totalNtlPosUsd: parseFloatSafe(summary.totalNtlPos),
    totalRawUsdUsd: parseFloatSafe(summary.totalRawUsd),
  }
}

export async function getUserFills30d(
  address: string,
  now: Date = new Date(),
): Promise<HyperliquidUserFill[] | null> {
  const url = getInfoUrl()
  const startTimeMs = now.getTime() - THIRTY_DAYS_SECONDS * 1_000
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
