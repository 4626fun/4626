export type BacktestCandleInterval = '1m' | '5m' | '15m' | '1h'

const MAX_BACKTEST_WINDOW_HOURS = 24 * 90

/** Finest resolution for counter-rebalance backtests (1m through 90d). */
export function chooseBacktestInterval(windowHours: number): BacktestCandleInterval {
  const hours = Math.max(1, Math.min(MAX_BACKTEST_WINDOW_HOURS, Math.floor(windowHours)))
  if (hours <= 24 * 90) return '1m'
  return '1h'
}

export function parseBacktestInterval(
  raw: unknown,
  windowHours: number,
): BacktestCandleInterval {
  if (raw === '1m' || raw === '5m' || raw === '15m' || raw === '1h') return raw
  return chooseBacktestInterval(windowHours)
}

/** True when callers should defer bar resolution to loadFinestBacktestMarketBars. */
export function isAutoBacktestInterval(raw: unknown): boolean {
  if (raw == null) return true
  if (typeof raw !== 'string') return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '' || normalized === 'auto'
}

export function intervalToMinutes(interval: BacktestCandleInterval): number {
  if (interval === '1m') return 1
  if (interval === '5m') return 5
  if (interval === '15m') return 15
  return 60
}

export function expectedBarCount(windowHours: number, interval: BacktestCandleInterval): number {
  const minutes = intervalToMinutes(interval)
  return Math.max(1, Math.floor((windowHours * 60) / minutes))
}

export function minCoverageRatio(windowHours: number, interval: BacktestCandleInterval): number {
  if (interval === '1m' && windowHours >= 24 * 30) return 0.92
  if (interval === '1m') return 0.85
  return 0.75
}

export const BACKTEST_INTERVAL_RANK: BacktestCandleInterval[] = ['1m', '5m', '15m', '1h']

/**
 * Leg health is ~1.0 at entry, 0 at liquidation, and can exceed 1 when price moves in that leg's favor.
 * Floors above 1.0 fire almost immediately after entry and do not mean "105% health."
 */
export function clampBacktestHealthFloor(value: number): number {
  if (!Number.isFinite(value)) return 0.7
  return Math.min(1, Math.max(0.05, value))
}
