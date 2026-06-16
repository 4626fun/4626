export type BacktestSeriesPoint = {
  t: number
  mark: number
  equity: number
  longHealth: number
  shortHealth: number
  rebalance?: boolean
}

export function downsampleBacktestSeries(
  points: BacktestSeriesPoint[],
  maxPoints: number,
): BacktestSeriesPoint[] {
  if (points.length <= maxPoints || maxPoints < 3) return points

  const stride = Math.ceil(points.length / maxPoints)
  const keep = new Set<number>([0, points.length - 1])
  for (let i = 0; i < points.length; i += 1) {
    if (i % stride === 0) keep.add(i)
    if (points[i]?.rebalance) keep.add(i)
  }

  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((index) => points[index]!)
}
