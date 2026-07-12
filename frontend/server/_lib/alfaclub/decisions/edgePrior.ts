import { EDGE_PRIOR_VERSION } from './types.js'
import type { FineRegime } from '../regimes/regimeTaxonomy.js'

/**
 * Versioned deterministic hypothesis prior for modeled edge.
 * Explicitly unvalidated — freeze before OOS; replace only via a new version.
 */
export function estimateModeledEdgeBps(params: {
  regime: FineRegime
  confidence: number
  decisionFamily: 'counter' | 'delay' | 'skip'
}): { edgeBps: number; priorVersion: string } {
  if (params.decisionFamily !== 'counter') {
    return { edgeBps: 0, priorVersion: EDGE_PRIOR_VERSION }
  }
  const base =
    params.regime === 'long_exhaustion' || params.regime === 'short_exhaustion'
      ? 28
      : params.regime === 'crowded_long_continuation' ||
          params.regime === 'crowded_short_continuation'
        ? 8
        : 0
  const scaled = base * Math.max(0, Math.min(1, params.confidence))
  return { edgeBps: Number(scaled.toFixed(2)), priorVersion: EDGE_PRIOR_VERSION }
}

export function estimateCostBps(params: {
  feeBps?: number
  slippageBps?: number
  fundingDragBps?: number
}): number {
  const fee = params.feeBps ?? 3
  const slip = params.slippageBps ?? 5
  const funding = params.fundingDragBps ?? 1
  return fee + slip + funding
}
