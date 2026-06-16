/** Stable run id for matching sweep CSV rows to playback series JSON. */
export function buildBacktestRunId(params: {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  healthFloor: number
  deadband: number
  minChunkUsd: number
  maxChunkUsd: number
  cooldownBars: number
}): string {
  const fmt = (value: number) => {
    if (Number.isInteger(value)) return String(value)
    return String(Number(value.toFixed(6)))
  }
  return [
    params.symbol,
    params.interval,
    params.windowHours,
    params.leverage,
    fmt(params.healthFloor),
    fmt(params.deadband),
    fmt(params.minChunkUsd),
    fmt(params.maxChunkUsd),
    params.cooldownBars,
  ].join('-')
}
