export type ExploreHeroSparklinePoint = {
  creatorCoinsMarketCapUsd: number | null
}

export type SparklineLayoutPoint = {
  x: number
  y: number
}

export function extractIndexedMcapSparklineValues(
  history: ReadonlyArray<ExploreHeroSparklinePoint>,
): number[] {
  return history
    .map((row) => row.creatorCoinsMarketCapUsd)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
}

export function buildSparklineLayout(
  values: ReadonlyArray<number>,
  width: number,
  height: number,
  padding = 2,
): SparklineLayoutPoint[] {
  if (values.length < 2) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = Math.max(0, width - padding * 2)
  const innerH = Math.max(0, height - padding * 2)

  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * innerW
    const y =
      span <= 0
        ? padding + innerH / 2
        : padding + innerH - ((value - min) / span) * innerH
    return { x, y }
  })
}

export function layoutToPolyline(points: ReadonlyArray<SparklineLayoutPoint>): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

export function layoutToAreaPath(
  points: ReadonlyArray<SparklineLayoutPoint>,
  _width: number,
  height: number,
  padding = 2,
): string | null {
  if (points.length < 2) return null
  const baselineY = height - padding
  const line = points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')
  const last = points[points.length - 1]!
  const first = points[0]!
  return `M ${first.x.toFixed(2)} ${baselineY.toFixed(2)} L ${line} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} Z`
}
