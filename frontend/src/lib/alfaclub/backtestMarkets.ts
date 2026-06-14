import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type BacktestMarketOption = {
  symbol: string
  market: string
  maxLeverage: number | null
}

export type BacktestMarketsPayload = {
  markets: BacktestMarketOption[]
  source: 'hyperliquid' | 'fallback'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseMarketOption(raw: unknown): BacktestMarketOption | null {
  if (!isRecord(raw)) return null
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim().toUpperCase() : ''
  const market = typeof raw.market === 'string' ? raw.market.trim().toUpperCase() : ''
  const maxLeverage =
    typeof raw.maxLeverage === 'number' && Number.isFinite(raw.maxLeverage) ? raw.maxLeverage : null
  if (!symbol || !market) return null
  return { symbol, market, maxLeverage }
}

function parsePayload(payload: unknown): BacktestMarketsPayload {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new Error('Invalid backtest markets response shape')
  }
  const data = payload.data
  const marketsRaw = Array.isArray(data.markets) ? data.markets : []
  const markets = marketsRaw.map(parseMarketOption).filter((row): row is BacktestMarketOption => row != null)
  const source = data.source === 'hyperliquid' ? 'hyperliquid' : 'fallback'
  return { markets, source }
}

export async function fetchBacktestMarkets(): Promise<BacktestMarketsPayload> {
  const response = await apiFetch(API_ENDPOINTS.alfaclub.backtestMarkets, { method: 'GET' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Backtest markets fetch failed (${response.status})`))
  }
  return parsePayload(payload)
}
