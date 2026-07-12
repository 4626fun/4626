import {
  isDelayFamily,
  isLongExhaustionFamily,
  isShortExhaustionFamily,
  sourceAlignedWithRegime,
  type FineRegime,
} from '../regimes/regimeTaxonomy.js'
import { estimateCostBps, estimateModeledEdgeBps } from './edgePrior.js'
import { invalidationPrice, suggestAdvisorySize } from './sizingAdvisory.js'
import {
  composeConfidence,
  DECISION_METHODOLOGY_VERSION,
  type CounterDecision,
  type DecisionRecord,
  type DecisionSource,
  type Side,
} from './types.js'
import type { MarketStateVector } from '../marketState/types.js'

declare const process: { env: Record<string, string | undefined> }

export type DecideInput = {
  decisionId: string
  observedAt: string
  dataAsOf: string
  asset: string
  source: DecisionSource
  regime: FineRegime
  regimeCoarse?: string
  marketState: MarketStateVector
  supportingEvidence: string[]
  contradictingEvidence: string[]
  dataQuality: 'ok' | 'degraded' | 'bad'
  staleSeconds: number
  statedCapitalUsd?: number
  venueMaxLeverage?: number
  now?: () => number
}

function skip(
  reason: string,
  partial: Omit<DecisionRecord, 'decision' | 'counter_side' | 'suggested_risk_pct' | 'suggested_notional_usd' | 'modeled_edge_bps' | 'edge_prior_version' | 'invalidation'> & {
    source: DecisionSource
  },
): DecisionRecord {
  return {
    ...partial,
    decision: 'SKIP',
    counter_side: null,
    suggested_risk_pct: 0,
    suggested_notional_usd: 0,
    modeled_edge_bps: 0,
    edge_prior_version: estimateModeledEdgeBps({
      regime: partial.regime,
      confidence: partial.confidence,
      decisionFamily: 'skip',
    }).priorVersion,
    invalidation: { price: null, conditions: [reason] },
    contradicting_evidence: [...partial.contradicting_evidence, reason],
  }
}

export function isIntelKillSwitchEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = String(env.INV_AKITA_INTEL_KILL ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function decideCounterDelaySkip(input: DecideInput): DecisionRecord {
  const base = {
    decision_id: input.decisionId,
    schema_version: 'counter-decision-v1' as const,
    methodology_version: DECISION_METHODOLOGY_VERSION,
    observed_at: input.observedAt,
    data_as_of: input.dataAsOf,
    venue: 'hyperliquid' as const,
    asset: input.asset.trim().toUpperCase(),
    source: input.source,
    confidence: 0,
    regime: input.regime,
    regime_coarse: input.regimeCoarse,
    market_state_vector: input.marketState,
    supporting_evidence: [...input.supportingEvidence],
    contradicting_evidence: [...input.contradictingEvidence],
    expected_holding_period_hours: 8,
    estimated_cost_bps: estimateCostBps({}),
    valid_for_minutes: 45,
    evaluation_horizons_hours: [1, 4, 8, 24],
    outcome: null,
    shadow_only: true as const,
    disclaimer: 'Advisory only. Not investment advice. Does not execute trades.',
  }

  if (isIntelKillSwitchEnabled()) {
    return skip('kill_switch_INV_AKITA_INTEL_KILL', {
      ...base,
      confidence: 0,
    })
  }

  if (input.dataQuality === 'bad' || input.staleSeconds > 120) {
    return skip('data_quality', { ...base, confidence: 0 })
  }
  if (input.regime === 'insufficient_data') {
    return skip('insufficient_data', { ...base, confidence: 0 })
  }
  if (input.regime === 'liquidation_cascade') {
    return skip('cascade', { ...base, confidence: 0.7 })
  }

  const featureCompleteness = Math.max(
    0,
    1 - input.marketState.missing.length / Math.max(1, 12),
  )
  const confidence = composeConfidence({
    regimeSeparability: input.regime === 'neutral_or_ambiguous' ? 0.2 : 0.75,
    featureCompleteness,
    legAgreement: input.contradictingEvidence.length === 0 ? 0.8 : 0.35,
    liquidityScore: input.marketState.proxies.oi_to_volume_24h != null ? 0.7 : 0.4,
    staleness: Math.min(1, input.staleSeconds / 120),
    contradictionPenalty: Math.min(1, input.contradictingEvidence.length * 0.25),
  })

  const withConfidence = { ...base, confidence }

  if (isDelayFamily(input.regime) && confidence >= 0.55) {
    if (sourceAlignedWithRegime(input.source.side, input.regime)) {
      return {
        ...withConfidence,
        decision: 'DELAY',
        counter_side: null,
        suggested_risk_pct: 0,
        suggested_notional_usd: 0,
        modeled_edge_bps: 0,
        edge_prior_version: estimateModeledEdgeBps({
          regime: input.regime,
          confidence,
          decisionFamily: 'delay',
        }).priorVersion,
        invalidation: {
          price: invalidationPrice({
            sourceSide: input.source.side,
            entryPrice: input.source.entryPrice,
            counterSide: null,
          }),
          conditions: ['source_aligned_early_or_covering'],
        },
      }
    }
  }

  const wantsCounterShort =
    input.source.side === 'LONG' && isLongExhaustionFamily(input.regime)
  const wantsCounterLong =
    input.source.side === 'SHORT' && isShortExhaustionFamily(input.regime)

  const costBps = withConfidence.estimated_cost_bps
  const { edgeBps, priorVersion } = estimateModeledEdgeBps({
    regime: input.regime,
    confidence,
    decisionFamily: wantsCounterShort || wantsCounterLong ? 'counter' : 'skip',
  })

  if (
    (wantsCounterShort || wantsCounterLong) &&
    confidence >= 0.65 &&
    edgeBps > costBps + 5
  ) {
    const counterSide: Side = wantsCounterShort ? 'SHORT' : 'LONG'
    const size = suggestAdvisorySize({
      decision: 'COUNTER',
      confidence,
      statedCapitalUsd: input.statedCapitalUsd ?? input.source.notionalUsd,
      sourceLeverage: input.source.leverage,
      venueMaxLeverage: input.venueMaxLeverage,
    })
    return {
      ...withConfidence,
      decision: 'COUNTER',
      counter_side: counterSide,
      suggested_risk_pct: size.suggestedRiskPct,
      suggested_notional_usd: size.suggestedNotionalUsd,
      modeled_edge_bps: edgeBps,
      edge_prior_version: priorVersion,
      invalidation: {
        price: invalidationPrice({
          sourceSide: input.source.side,
          entryPrice: input.source.entryPrice,
          counterSide,
        }),
        conditions: ['exhaustion_fade_invalidated_if_source_continues'],
      },
    }
  }

  return skip('no_edge_after_costs_or_ambiguity', {
    ...withConfidence,
    estimated_cost_bps: costBps,
  })
}

export type { CounterDecision, DecisionRecord }
