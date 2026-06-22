/**
 * Bybit v5 public klines fetcher.
 *
 * Free REST endpoint (no auth): GET https://api.bybit.com/v5/market/kline
 * Returns up to 1000 candles per request, newest-first. 1m history goes back
 * months to years depending on listing date.
 *
 * Used for symbols not available on Binance (e.g. HYPE — Hyperliquid's native
 * token). Bybit linear (perp) category is the default because the backtest
 * simulates perp trading and perp prices match the simulated product more
 * closely than spot.
 *
 * Bybit returns candles newest-first; this fetcher paginates backward from
 * endTime to startTime and returns results in chronological order.
 */

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_BASE_URL = 'https://api.bybit.com'
const FETCH_TIMEOUT_MS = 15_000
const MAX_CANDLES_PER_REQUEST = 1000
const MAX_PAGINATION_STEPS = 200
/** Polite delay between pagination requests. */
const INTER_PAGE_DELAY_MS = 100

export type BybitCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export type BybitCategory = 'spot' | 'linear' | 'option'

function getBaseUrl(): string {
  const override = (process.env.BYBIT_BASE_URL ?? '').trim()
  return override || DEFAULT_BASE_URL
}

function getCategory(): BybitCategory {
  const raw = (process.env.BYBIT_CATEGORY ?? '').trim().toLowerCase()
  if (raw === 'spot' || raw === 'option') return raw
  return 'linear' // default — perp prices match the backtest simulation
}

/**
 * Normalize a 4626 symbol (BTC, BTC/USDC, HYPE) to Bybit pair format (BTCUSDT).
 * Strips quote suffixes and separators, then appends USDT.
 */
export function toBybitSymbol(raw: string): string {
  const base = raw
    .toUpperCase()
    .replace(/\/.*$/, '')
    .replace(/[-_].*$/, '')
    .replace(/(USDC|USDT|USD|PERP)$/i, '')
    .replace(/[^A-Z0-9]/g, '')
  if (!base) throw new Error(`Cannot normalize symbol "${raw}" for Bybit`)
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

/** Map standard interval labels (1m, 5m, 15m, 1h) to Bybit v5 interval codes (1, 5, 15, 60). */
function toBybitInterval(interval: string): string {
  const map: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60' }
  return map[interval] ?? interval
}

async function fetchKlinesPage(params: {
  symbol: string
  category: BybitCategory
  interval: string
  startMs: number
  endMs: number
}): Promise<{ candles: BybitCandle[] | null; error: string | null }> {
  const url = new URL(`${getBaseUrl()}/v5/market/kline`)
  url.searchParams.set('category', params.category)
  url.searchParams.set('symbol', params.symbol)
  url.searchParams.set('interval', toBybitInterval(params.interval))
  url.searchParams.set('start', String(params.startMs))
  url.searchParams.set('end', String(params.endMs))
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
    if (typeof raw !== 'object' || raw == null) return { candles: null, error: 'invalid_response' }
    if (raw.retCode !== 0) return { candles: null, error: `bybit_ret_${raw.retCode}` }
    const list = raw?.result?.list
    if (!Array.isArray(list)) return { candles: null, error: 'invalid_kline_shape' }

    const out: BybitCandle[] = []
    for (const entry of list) {
      if (!Array.isArray(entry) || entry.length < 5) continue
      const time = Number(entry[0])
      const open = parseFloatSafe(entry[1])
      const high = parseFloatSafe(entry[2])
      const low = parseFloatSafe(entry[3])
      const close = parseFloatSafe(entry[4])
      const volume = parseFloatSafe(entry[5])
      if (!Number.isFinite(time) || open == null || high == null || low == null || close == null) continue
      out.push({ time, open, high, low, close, volume })
    }
    // Bybit returns newest-first; sort to chronological for dedup
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
 * Fetch 1m klines from Bybit, paginating backward from endTime to startTime.
 * Bybit returns newest-first, so we cursor the `end` param backward.
 * Returns candles in chronological order, or null on hard failure.
 * Caller is responsible for retry logic.
 */
export async function getBybitKlines(params: {
  symbol: string
  interval: string
  startTimeMs: number
  endTimeMs: number
}): Promise<BybitCandle[] | null> {
  const bybitSymbol = toBybitSymbol(params.symbol)
  const category = getCategory()
  const byTime = new Map<number, BybitCandle>()
  const startMs = Math.floor(params.startTimeMs)
  const endMs = Math.floor(params.endTimeMs)
  let cursor = endMs
  let lastError: string | null = null

  for (let step = 0; step < MAX_PAGINATION_STEPS && cursor > startMs; step += 1) {
    const page = await fetchKlinesPage({
      symbol: bybitSymbol,
      category,
      interval: params.interval,
      startMs,
      endMs: cursor,
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

    // Bybit returns newest-first; the oldest candle in this page is [0] after sort
    const oldestTime = page.candles[0]!.time
    cursor = oldestTime - 1
    if (page.candles.length < MAX_CANDLES_PER_REQUEST) break

    await new Promise((resolve) => setTimeout(resolve, INTER_PAGE_DELAY_MS))
  }

  if (byTime.size === 0 && lastError) return null
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}
