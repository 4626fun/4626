import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type BacktestSweepRow = {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  healthFloor: number
  deadband: number
  minChunkUsd: number
  maxChunkUsd: number
  cooldownBars: number
  startPrice: number
  endPrice: number
  priceChangePct: number
  finalEquity: number
  realizedPnl: number
  executionCost: number
  rebalanceCount: number
  avgChunkUsd: number
  finalLongQty: number
  finalShortQty: number
  finalLongNotionalUsd: number
  finalShortNotionalUsd: number
  minHealthRoom: number
  minHealthAgent: number
  forcedSkipsInsufficientBuffer: number
  commingleViolationCount: number
  objective: number
}

export type BacktestSweepPayload = {
  file: string | null
  files: string[]
  rows: BacktestSweepRow[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseRow(value: unknown): BacktestSweepRow | null {
  if (!isRecord(value)) return null
  return {
    symbol: typeof value.symbol === 'string' ? value.symbol : '',
    interval: typeof value.interval === 'string' ? value.interval : '',
    windowHours: asNumber(value.windowHours),
    leverage: asNumber(value.leverage),
    healthFloor: asNumber(value.healthFloor),
    deadband: asNumber(value.deadband),
    minChunkUsd: asNumber(value.minChunkUsd),
    maxChunkUsd: asNumber(value.maxChunkUsd),
    cooldownBars: asNumber(value.cooldownBars),
    startPrice: asNumber(value.startPrice),
    endPrice: asNumber(value.endPrice),
    priceChangePct: asNumber(value.priceChangePct),
    finalEquity: asNumber(value.finalEquity),
    realizedPnl: asNumber(value.realizedPnl),
    executionCost: asNumber(value.executionCost),
    rebalanceCount: asNumber(value.rebalanceCount),
    avgChunkUsd: asNumber(value.avgChunkUsd),
    finalLongQty: asNumber(value.finalLongQty),
    finalShortQty: asNumber(value.finalShortQty),
    finalLongNotionalUsd: asNumber(value.finalLongNotionalUsd),
    finalShortNotionalUsd: asNumber(value.finalShortNotionalUsd),
    minHealthRoom: asNumber(value.minHealthRoom),
    minHealthAgent: asNumber(value.minHealthAgent),
    forcedSkipsInsufficientBuffer: asNumber(value.forcedSkipsInsufficientBuffer),
    commingleViolationCount: asNumber(value.commingleViolationCount),
    objective: asNumber(value.objective),
  }
}

function parsePayload(payload: unknown): BacktestSweepPayload {
  if (!isRecord(payload)) throw new Error('Invalid backtest sweep response shape')
  if (payload.success !== true) throw new Error('Backtest sweep request was not successful')
  if (!isRecord(payload.data)) throw new Error('Backtest sweep response is missing data')

  const data = payload.data
  const file = typeof data.file === 'string' ? data.file : null
  const files = Array.isArray(data.files) ? data.files.filter((entry): entry is string => typeof entry === 'string') : []
  const rows = Array.isArray(data.rows) ? data.rows.map(parseRow).filter((row): row is BacktestSweepRow => Boolean(row)) : []
  return { file, files, rows }
}

export async function fetchBacktestSweep(params?: { file?: string | null }): Promise<BacktestSweepPayload> {
  const query = params?.file ? `?file=${encodeURIComponent(params.file)}` : ''
  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.backtestSweep}${query}`, {
    method: 'GET',
    withCredentials: false,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Backtest sweep failed (${response.status})`))
  }
  return parsePayload(payload)
}
