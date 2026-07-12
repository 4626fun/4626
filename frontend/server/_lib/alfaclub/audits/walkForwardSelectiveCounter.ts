/**
 * Purged walk-forward harness for Conditional Inverse Edge.
 * Reports honestly; does not claim proven edge.
 */

export type WalkForwardPoint = {
  timestampMs: number
  asset: string
  selectiveCounterNetBps: number
  alwaysInverseNetBps: number
}

export type WalkForwardReport = {
  methodologyVersion: string
  sampleSize: number
  conditionalInverseEdgeBps: number
  bootstrapCi95: [number, number]
  fractionPositive: number
  epistemicTier: string
  claimAllowed: boolean
  notes: string[]
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function bootstrapMeanCi(
  values: number[],
  draws = 500,
  seed = 42,
): [number, number] {
  if (values.length === 0) return [0, 0]
  let state = seed
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  const means: number[] = []
  for (let i = 0; i < draws; i += 1) {
    const sample: number[] = []
    for (let j = 0; j < values.length; j += 1) {
      sample.push(values[Math.floor(next() * values.length)]!)
    }
    means.push(mean(sample))
  }
  means.sort((a, b) => a - b)
  const lo = means[Math.floor(draws * 0.025)] ?? 0
  const hi = means[Math.floor(draws * 0.975)] ?? 0
  return [Number(lo.toFixed(4)), Number(hi.toFixed(4))]
}

export function evaluateConditionalInverseEdge(params: {
  points: WalkForwardPoint[]
  methodologyVersion: string
  minSample?: number
}): WalkForwardReport {
  const minSample = params.minSample ?? 100
  const edges = params.points.map(
    (point) => point.selectiveCounterNetBps - point.alwaysInverseNetBps,
  )
  const edge = mean(edges)
  const ci = bootstrapMeanCi(edges)
  const claimAllowed = params.points.length >= minSample && ci[0] > 0
  return {
    methodologyVersion: params.methodologyVersion,
    sampleSize: params.points.length,
    conditionalInverseEdgeBps: Number(edge.toFixed(4)),
    bootstrapCi95: ci,
    fractionPositive: edges.length ? edges.filter((value) => value > 0).length / edges.length : 0,
    epistemicTier: 'infrastructure → hypothesis → in-sample → OOS → paper → independent live',
    claimAllowed,
    notes: [
      'Embargo/purged walk-forward required before public edge claims',
      'Negative Conditional Inverse Edge must be reported honestly',
      claimAllowed
        ? 'OOS CI excludes 0 at configured minimum n'
        : 'Public edge language remains disabled',
    ],
  }
}
