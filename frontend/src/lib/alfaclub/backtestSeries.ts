import type { BacktestCandleInterval } from './backtestIntervalPolicy'

export type BacktestRebalanceEvent = {
  t: number
  mark: number
  weakSide: 'long' | 'short'
  strongSide: 'long' | 'short'
  weakHealth: number
  healthGap: number
  chunkUsd: number
  executionCostUsd: number
}

export type BacktestSeriesPoint = {
  t: number
  mark: number
  equity: number
  longHealth: number
  shortHealth: number
  rebalance?: boolean
}

export type BacktestSeriesSummary = {
  initialCapital: number
  finalEquity: number
  returnPct: number
  rebalanceCount: number
  commingleViolationCount: number
  minHealthLong: number
  minHealthShort: number
  startPrice: number
  endPrice: number
  priceChangePct: number
  liquidationCount?: number
  realizedPnl?: number
  executionCost?: number
  forcedSkipsInsufficientBuffer?: number
  objective?: number
}

export type BacktestSeriesPayload = {
  runId: string
  symbol: string
  interval: BacktestCandleInterval
  windowHours: number
  leverage: number
  dataQuality: {
    source: string
    barCount: number
    expectedBars: number
    coveragePct: number
  }
  summary: BacktestSeriesSummary
  rebalanceEvents?: BacktestRebalanceEvent[]
  points: BacktestSeriesPoint[]
}

export function formatBacktestSeriesTime(t: number): string {
  const ms = t > 1_000_000_000_000 ? t : t * 60_000
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
