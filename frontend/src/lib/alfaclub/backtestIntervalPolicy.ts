export type BacktestCandleInterval = '1m' | '5m' | '15m' | '1h'

const MAX_BACKTEST_WINDOW_HOURS = 24 * 90

export function chooseBacktestInterval(windowHours: number): BacktestCandleInterval {
  const hours = Math.max(1, Math.min(MAX_BACKTEST_WINDOW_HOURS, Math.floor(windowHours)))
  if (hours <= 24 * 90) return '1m'
  return '1h'
}

/** Interval sent to the backtest run API — auto picks finest full-horizon resolution server-side. */
export function resolveBacktestIntervalForRun(windowHours: number): 'auto' | BacktestCandleInterval {
  const hours = Math.max(1, Math.min(MAX_BACKTEST_WINDOW_HOURS, Math.floor(windowHours)))
  if (hours >= 24 * 7) return 'auto'
  return chooseBacktestInterval(hours)
}

export function intervalToMinutes(interval: BacktestCandleInterval): number {
  if (interval === '1m') return 1
  if (interval === '5m') return 5
  if (interval === '15m') return 15
  return 60
}

/**
 * Leg health is ~1.0 at entry, 0 at liquidation, and can exceed 1 when price moves in that leg's favor.
 * Floors above 1.0 fire almost immediately after entry and do not mean "105% health."
 */
export function clampBacktestHealthFloor(value: number): number {
  if (!Number.isFinite(value)) return 0.7
  return Math.min(1, Math.max(0.05, value))
}
