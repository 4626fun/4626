/**
 * OpenBB Platform API client (HTTP).
 *
 * We run OpenBB as a separate FastAPI service (openbb-api) and call it from
 * our TypeScript agent runtime. This wrapper provides:
 * - small in-memory TTL caching (safe for both long-lived and serverless)
 * - request timeouts
 * - consistent, user-friendly error shaping
 *
 * Docs:
 * - https://docs.openbb.co/platform/reference
 */

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenbbErrorCode = 'not_configured' | 'backend_unavailable' | 'bad_request'

export type OpenbbResult<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; error: OpenbbErrorCode; status?: number; message?: string }

export type OpenbbEnvelope<T> = {
  results: T | T[]
  provider?: string
  warnings?: unknown[]
  chart?: unknown
  extra?: Record<string, unknown>
}

export type EquityQuoteData = {
  symbol: string
  asset_type?: string | null
  name?: string | null
  exchange?: string | null
  bid?: number | null
  ask?: number | null
  last_price?: number | null
  last_timestamp?: string | null
  open?: number | null
  high?: number | null
  low?: number | null
  close?: number | null
  prev_close?: number | null
  change?: number | null
  change_percent?: number | null
  volume?: number | null
  year_high?: number | null
  year_low?: number | null
  [key: string]: unknown
}

export type EquityHistoricalData = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
  vwap?: number | null
  [key: string]: unknown
}

export type CompanyNewsData = {
  date: string
  title: string
  author?: string | null
  excerpt?: string | null
  body?: string | null
  url: string
  symbols?: string | null
  [key: string]: unknown
}

export type EconomicCalendarData = {
  date?: string | null
  country?: string | null
  category?: string | null
  event?: string | null
  importance?: string | null
  source?: string | null
  currency?: string | null
  unit?: string | null
  consensus?: string | number | null
  previous?: string | number | null
  revised?: string | number | null
  actual?: string | number | null
  [key: string]: unknown
}

export type FinancialRatiosData = {
  symbol?: string | null
  period_ending?: string | null
  fiscal_period?: string | null
  fiscal_year?: number | null
  // Provider field names vary; keep index signature and let callers pick keys.
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_CACHE_ENTRIES = 250

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/g, '')
}

/**
 * Normalize OPENBB_API_BASE_URL.
 *
 * We accept:
 * - "http://host:6900"
 * - "https://openbb.example.com"
 * - "host:6900" (auto-prefixed to http://)
 *
 * If the user mistakenly includes "/api/v1", we strip it so our paths remain stable.
 */
function normalizeOpenbbBaseUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = trimmed.includes('://') ? trimmed : `http://${trimmed}`
  const noSlash = stripTrailingSlashes(withScheme)
  const apiV1Suffix = '/api/v1'
  if (noSlash.toLowerCase().endsWith(apiV1Suffix)) {
    return noSlash.slice(0, -apiV1Suffix.length)
  }
  return noSlash
}

function getOpenbbBaseUrl(): string | null {
  return normalizeOpenbbBaseUrl(String(process.env.OPENBB_API_BASE_URL ?? ''))
}

function getOpenbbAuthHeaders(): Record<string, string> {
  const token = String(process.env.OPENBB_API_TOKEN ?? '').trim()
  if (!token) return {}
  // Not an OpenBB default; meant for a reverse proxy / gateway in front.
  return { Authorization: `Bearer ${token}` }
}

export function isOpenbbConfigured(): boolean {
  return Boolean(getOpenbbBaseUrl())
}

// ---------------------------------------------------------------------------
// TTL Cache (memory-only)
// ---------------------------------------------------------------------------

type CacheEntry = { expiresAtMs: number; data: unknown }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<OpenbbResult<any>>>()

function nowMs(): number {
  return Date.now()
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAtMs <= nowMs()) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCached(key: string, data: unknown, ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return
  cache.set(key, { expiresAtMs: nowMs() + ttlMs, data })

  // Simple eviction: cap entries by insertion order.
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey) cache.delete(oldestKey)
  }
}

function stableQueryKey(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  const usp = new URLSearchParams()
  for (const [k, v] of entries) usp.set(k, v)
  return usp.toString()
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function readResponseBodySnippet(res: Response): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return ''
    // Attempt to surface FastAPI error messages.
    try {
      const asJson = JSON.parse(text) as any
      const detail = typeof asJson?.detail === 'string' ? asJson.detail : null
      if (detail) return detail.slice(0, 300)
    } catch {
      // ignore JSON parse errors
    }
    return text.slice(0, 300)
  } catch {
    return ''
  }
}

async function openbbGetJson<T>(params: {
  path: string
  query?: Record<string, unknown>
  ttlMs?: number
  timeoutMs?: number
}): Promise<OpenbbResult<T>> {
  const baseUrl = getOpenbbBaseUrl()
  if (!baseUrl) return { ok: false, error: 'not_configured' }

  const queryKey = params.query ? stableQueryKey(params.query) : ''
  const cacheKey = `GET:${params.path}?${queryKey}`

  const cached = getCached(cacheKey)
  if (cached !== null) {
    return { ok: true, data: cached as T, cached: true }
  }

  const existing = inflight.get(cacheKey)
  if (existing) return existing

  const run = (async (): Promise<OpenbbResult<T>> => {
    const timeoutMs = Math.max(1_000, Math.floor(params.timeoutMs ?? DEFAULT_TIMEOUT_MS))
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs)

    try {
      const url = new URL(`${baseUrl}${params.path.startsWith('/') ? '' : '/'}${params.path}`)
      if (params.query) {
        for (const [k, v] of Object.entries(params.query)) {
          if (v === undefined || v === null || v === '') continue
          url.searchParams.set(k, String(v))
        }
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenbbAuthHeaders(),
        },
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const snippet = await readResponseBodySnippet(res)
        const isBadRequest = res.status >= 400 && res.status < 500
        return {
          ok: false,
          error: isBadRequest ? 'bad_request' : 'backend_unavailable',
          status: res.status,
          message: snippet || res.statusText,
        }
      }

      const json = (await res.json().catch(() => null)) as T | null
      if (!json) {
        return { ok: false, error: 'backend_unavailable', status: 502, message: 'Invalid JSON from OpenBB' }
      }

      if (params.ttlMs && params.ttlMs > 0) {
        setCached(cacheKey, json, params.ttlMs)
      }

      return { ok: true, data: json, cached: false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? '')
      const isAbort = msg.toLowerCase().includes('abort')
      return {
        ok: false,
        error: 'backend_unavailable',
        message: isAbort ? `OpenBB request timed out after ${timeoutMs}ms` : msg,
      }
    } finally {
      clearTimeout(timeout)
    }
  })()

  inflight.set(cacheKey, run as Promise<OpenbbResult<any>>)
  try {
    return await run
  } finally {
    inflight.delete(cacheKey)
  }
}

// ---------------------------------------------------------------------------
// Public endpoint helpers (typed)
// ---------------------------------------------------------------------------

export async function openbbEquityQuote(params: {
  symbol: string
  provider?: string
}): Promise<OpenbbResult<OpenbbEnvelope<EquityQuoteData>>> {
  return openbbGetJson({
    path: '/api/v1/equity/price/quote',
    query: {
      symbol: params.symbol,
      ...(params.provider ? { provider: params.provider } : null),
    },
    ttlMs: 30_000,
  })
}

export async function openbbEquityHistorical(params: {
  symbol: string
  startDate?: string
  endDate?: string
  interval?: string
  provider?: string
}): Promise<OpenbbResult<OpenbbEnvelope<EquityHistoricalData>>> {
  return openbbGetJson({
    path: '/api/v1/equity/price/historical',
    query: {
      symbol: params.symbol,
      ...(params.startDate ? { start_date: params.startDate } : null),
      ...(params.endDate ? { end_date: params.endDate } : null),
      ...(params.interval ? { interval: params.interval } : null),
      ...(params.provider ? { provider: params.provider } : null),
    },
    ttlMs: 5 * 60_000,
  })
}

export async function openbbCompanyNews(params: {
  symbol: string
  startDate?: string
  endDate?: string
  limit?: number
  provider?: string
}): Promise<OpenbbResult<OpenbbEnvelope<CompanyNewsData>>> {
  return openbbGetJson({
    path: '/api/v1/news/company',
    query: {
      symbol: params.symbol,
      ...(params.startDate ? { start_date: params.startDate } : null),
      ...(params.endDate ? { end_date: params.endDate } : null),
      ...(typeof params.limit === 'number' ? { limit: Math.max(1, Math.min(25, Math.floor(params.limit))) } : null),
      ...(params.provider ? { provider: params.provider } : null),
    },
    ttlMs: 30_000,
  })
}

export async function openbbFinancialRatios(params: {
  symbol: string
  limit?: number
  provider?: string
}): Promise<OpenbbResult<OpenbbEnvelope<FinancialRatiosData>>> {
  return openbbGetJson({
    path: '/api/v1/equity/fundamental/ratios',
    query: {
      symbol: params.symbol,
      ...(typeof params.limit === 'number' ? { limit: Math.max(1, Math.min(8, Math.floor(params.limit))) } : null),
      ...(params.provider ? { provider: params.provider } : null),
    },
    ttlMs: 60 * 60_000,
  })
}

export async function openbbEconomicCalendar(params: {
  startDate?: string
  endDate?: string
  provider?: string
}): Promise<OpenbbResult<OpenbbEnvelope<EconomicCalendarData>>> {
  return openbbGetJson({
    path: '/api/v1/economy/calendar',
    query: {
      ...(params.startDate ? { start_date: params.startDate } : null),
      ...(params.endDate ? { end_date: params.endDate } : null),
      ...(params.provider ? { provider: params.provider } : null),
    },
    ttlMs: 30 * 60_000,
  })
}

