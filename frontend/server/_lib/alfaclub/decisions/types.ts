import { clip01 } from '../marketState/madZ.js'
import type { MarketStateVector } from '../marketState/types.js'
import type { FineRegime } from '../regimes/regimeTaxonomy.js'

export type CounterDecision = 'COUNTER' | 'DELAY' | 'SKIP'
export type Side = 'LONG' | 'SHORT'

export type DecisionSource = {
  id?: string
  side: Side
  entryPrice: number
  notionalUsd?: number
  leverage?: number
  sourceTimestamp: string
}

export type DecisionRecord = {
  decision_id: string
  schema_version: 'counter-decision-v1'
  methodology_version: string
  observed_at: string
  data_as_of: string
  venue: 'hyperliquid'
  asset: string
  source: DecisionSource
  decision: CounterDecision
  counter_side: Side | null
  confidence: number
  regime: FineRegime
  regime_coarse?: string
  market_state_vector: MarketStateVector
  supporting_evidence: string[]
  contradicting_evidence: string[]
  invalidation: {
    price: number | null
    conditions: string[]
  }
  suggested_risk_pct: number
  suggested_notional_usd: number
  expected_holding_period_hours: number
  estimated_cost_bps: number
  modeled_edge_bps: number
  edge_prior_version: string
  valid_for_minutes: number
  evaluation_horizons_hours: number[]
  outcome: null
  shadow_only: true
  disclaimer: string
}

export const DECISION_METHODOLOGY_VERSION = 'inv-akita-decision-v1.0.0'
export const EDGE_PRIOR_VERSION = 'inv-akita-edge-prior-v1.0.0-unvalidated'

export type ConfidenceInputs = {
  regimeSeparability: number
  featureCompleteness: number
  legAgreement: number
  liquidityScore: number
  staleness: number
  contradictionPenalty: number
}

export function composeConfidence(input: ConfidenceInputs): number {
  return clip01(
    0.35 * input.regimeSeparability +
      0.25 * input.featureCompleteness +
      0.2 * input.legAgreement +
      0.1 * input.liquidityScore +
      0.1 * (1 - input.staleness) -
      0.15 * input.contradictionPenalty,
  )
}
