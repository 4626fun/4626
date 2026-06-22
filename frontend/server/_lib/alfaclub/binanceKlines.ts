/**
 * Binance public klines fetcher.
 *
 * Free REST endpoint (no auth): GET https://api.binance.com/api/v3/klines
 * Returns up to 1000 candles per request. 1m history goes back years.
 * Used to backfill the Supabase 1m cache for long-horizon backtests where
 * Hyperliquid's ~3.5-day 1m retention is insufficient.
 *
 * Binance USDT pairs (BTCUSDT) are used for deepest history. The close price
 * tracks the same underlying asset as Hyperliquid's USDC perps within basis
 * points, so it is suitable for rebalance-sim price input.
 */

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_BASE_URL = 'https://api.binance.com'
const FETCH_TIMEOUT_MS = 15_000
const MAX_CANDLES_PER_REQUEST = 1000
const MAX_PAGINATION_STEPS = 200
/** Polite delay between pagination requests (Binance weight limit is generous). */
const INTER_PAGE_DELAY_MS = 100

export type BinanceCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

function getBaseUrl(): string {
  const override = (process.env.BINANCE_BASE_URL ?? '').trim()
  return override || DEFAULT_BASE_URL
}

/**
 * Normalize a 4626 symbol (BTC, BTC/USDC, BTCUSD) to Binance pair format (BTCUSDT).
 * Strps quote suffixes and separators, then appends USDT for deepest history.
 */
export function toBinanceSymbol(raw: string): string {
  const base = raw
    .toUpperCase()
    .replace(/\/.*$/, '')
    .replace(/[-_].*$/, '')
    .replace(/(USDC|USDT|USD|PERP)$/i, '')
    .replace(/[^A-Z0-9]/g, '')
  if (!base) throw new Error(`Cannot normalize symbol "${raw}" for Binance`)
  return `${base}USDT`
}

function parseFloatSafe(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

async function fetchKlinesPage(params: {
  symbol: string
  interval: string
  startTimeMs: number
  endTimeMs: number
}): Promise<{ candles: BinanceCandle[] | null; error: string | null }> {
  const url = new URL(`${getBaseUrl()}/api/v3/klines`)
  url.searchParams.set('symbol', params.symbol)
  url.searchParams.set('interval', params.interval)
  url.searchParams.set('startTime', String(params.startTimeMs))
  url.searchParams.set('endTime', String(params.endTimeMs))
  url.searchParams.set('limit', String(MAX_CANDLES_PER_REQUEST))

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return { candles: null, error: `http_${res.status}` }
    const raw = await res.json()
    if (!Array.isArray(raw)) return { candles: null, error: 'invalid_kline_shape' }

    const out: BinanceCandle[] = []
    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length < 6) continue
      const time = Number(entry[0])
      const open = parseFloatSafe(entry[1])
      const high = parseFloatSafe(entry[2])
      const low = parseFloatSafe(entry[3])
      const close = parseFloatSafe(entry[4])
      const volume = parseFloatSafe(entry[5])
      if (!Number.isFinite(time) || open == null || high == null || low == null || close == null) continue
      out.push({ time, open, high, low, close, volume })
    }
    out.sort((a, b) => a.time - b.time)
    return { candles: out, error: null }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { candles: null, error: name === 'AbortError' ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch 1m klines from Binance, paginating forward from startTime to endTime.
 * Returns candles in chronological order, or null on hard failure.
 * Caller is responsible for retry logic.
 */
export async function getBinanceKlines(params: {
  symbol: string
  interval: string
  startTimeMs: number
  endTimeMs: number
}): Promise<BinanceCandle[] | null> {
  const binanceSymbol = toBinanceSymbol(params.symbol)
  const byTime = new Map<number, BinanceCandle>()
  const startMs = Math.floor(params.startTimeMs)
  const endMs = Math.floor(params.endTimeMs)
  let cursor = startMs
  let lastError: string | null = null

  for (let step = 0; step < MAX_PAGINATION_STEPS && cursor < endMs; step += 1) {
    const page = await fetchKlinesPage({
      symbol: binanceSymbol,
      interval: params.interval,
      startTimeMs: cursor,
      endTimeMs: endMs,
    })
    if (page.error) lastError = page.error
    if (page.candles == null) {
      return byTime.size > 0 ? Array.from(byTime.values()).sort((a, b) => a.time - b.time) : null
    }
    if (page.candles.length === 0) break

    for (const candle of page.candles) {
      if (candle.time >= startMs && candle.time <= endMs) {
        byTime.set(candle.time, candle)
      }
    }

    const lastTime = page.candles[page.candles.length - 1]!.time
    cursor = lastTime + 60_000
    if (page.candles.length < MAX_CANDLES_PER_REQUEST) break

    await new Promise((resolve) => setTimeout(resolve, INTER_PAGE_DELAY_MS))
  }

  if (byTime.size === 0 && lastError) return null
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}
