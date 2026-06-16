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
