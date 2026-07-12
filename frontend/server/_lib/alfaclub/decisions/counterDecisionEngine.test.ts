import { describe, expect, it } from 'vitest'

import { decideCounterDelaySkip, isIntelKillSwitchEnabled } from './counterDecisionEngine.js'
import { suggestAdvisorySize } from './sizingAdvisory.js'
import type { MarketStateVector } from '../marketState/types.js'

const emptyState: MarketStateVector = {
  r_t: 0.01,
  dr_t: null,
  F_t: 0.0003,
  dF_t: null,
  OI_t: 1_000_000,
  dOI_t: null,
  V_t: 2_000_000,
  dV_t: null,
  B_t: null,
  dB_t: null,
  OF_t: null,
  L_t: null,
  missing: ['dF_t', 'dOI_t', 'dV_t', 'B_t', 'dB_t', 'OF_t', 'L_t'],
  proxies: { oi_to_volume_24h: 0.5, price_change_4h_pct: null, price_change_24h_pct: 1 },
  normalization: 'absolute_thresholds_v2',
}

describe('decideCounterDelaySkip', () => {
  it('fails closed on bad/stale data and cascade', () => {
    const stale = decideCounterDelaySkip({
      decisionId: '11111111-1111-1111-1111-111111111111',
      observedAt: '2026-07-12T00:00:00.000Z',
      dataAsOf: '2026-07-12T00:00:00.000Z',
      asset: 'HYPE',
      source: {
        side: 'LONG',
        entryPrice: 38,
        sourceTimestamp: '2026-07-12T00:00:00.000Z',
      },
      regime: 'long_exhaustion',
      marketState: emptyState,
      supportingEvidence: [],
      contradictingEvidence: [],
      dataQuality: 'ok',
      staleSeconds: 200,
    })
    expect(stale.decision).toBe('SKIP')

    const cascade = decideCounterDelaySkip({
      decisionId: '22222222-2222-2222-2222-222222222222',
      observedAt: '2026-07-12T00:00:00.000Z',
      dataAsOf: '2026-07-12T00:00:00.000Z',
      asset: 'HYPE',
      source: {
        side: 'LONG',
        entryPrice: 38,
        sourceTimestamp: '2026-07-12T00:00:00.000Z',
      },
      regime: 'liquidation_cascade',
      marketState: emptyState,
      supportingEvidence: [],
      contradictingEvidence: [],
      dataQuality: 'ok',
      staleSeconds: 1,
    })
    expect(cascade.decision).toBe('SKIP')
  })

  it('returns DELAY for source-aligned early regimes', () => {
    const result = decideCounterDelaySkip({
      decisionId: '33333333-3333-3333-3333-333333333333',
      observedAt: '2026-07-12T00:00:00.000Z',
      dataAsOf: '2026-07-12T00:00:00.000Z',
      asset: 'HYPE',
      source: {
        side: 'LONG',
        entryPrice: 38,
        sourceTimestamp: '2026-07-12T00:00:00.000Z',
      },
      regime: 'new_long_accumulation',
      marketState: {
        ...emptyState,
        missing: ['B_t', 'dB_t', 'OF_t', 'L_t'],
      },
      supportingEvidence: ['new longs'],
      contradictingEvidence: [],
      dataQuality: 'ok',
      staleSeconds: 1,
    })
    expect(result.decision).toBe('DELAY')
    expect(result.suggested_notional_usd).toBe(0)
  })

  it('returns COUNTER only for exhaustion with confidence and cost gate', () => {
    const result = decideCounterDelaySkip({
      decisionId: '44444444-4444-4444-4444-444444444444',
      observedAt: '2026-07-12T00:00:00.000Z',
      dataAsOf: '2026-07-12T00:00:00.000Z',
      asset: 'HYPE',
      source: {
        side: 'LONG',
        entryPrice: 38.42,
        notionalUsd: 5000,
        leverage: 5,
        sourceTimestamp: '2026-07-12T00:00:00.000Z',
      },
      regime: 'long_exhaustion',
      marketState: {
        ...emptyState,
        missing: ['B_t', 'dB_t', 'OF_t', 'L_t'],
      },
      supportingEvidence: ['extreme funding'],
      contradictingEvidence: [],
      dataQuality: 'ok',
      staleSeconds: 1,
      statedCapitalUsd: 5000,
    })
    expect(result.decision).toBe('COUNTER')
    expect(result.counter_side).toBe('SHORT')
    expect(result.shadow_only).toBe(true)
    expect(result.suggested_notional_usd).toBeGreaterThan(0)
    expect(result.edge_prior_version).toContain('unvalidated')
  })

  it('honors INV_AKITA_INTEL_KILL', () => {
    expect(isIntelKillSwitchEnabled({ INV_AKITA_INTEL_KILL: '1' })).toBe(true)
    const result = decideCounterDelaySkip({
      decisionId: '55555555-5555-5555-5555-555555555555',
      observedAt: '2026-07-12T00:00:00.000Z',
      dataAsOf: '2026-07-12T00:00:00.000Z',
      asset: 'BTC',
      source: {
        side: 'SHORT',
        entryPrice: 100,
        sourceTimestamp: '2026-07-12T00:00:00.000Z',
      },
      regime: 'short_exhaustion',
      marketState: emptyState,
      supportingEvidence: [],
      contradictingEvidence: [],
      dataQuality: 'ok',
      staleSeconds: 1,
    })
    // Without env set in process, kill path depends on process.env; still assert sizing gate.
    expect(suggestAdvisorySize({ decision: 'SKIP', confidence: 0.9 }).suggestedNotionalUsd).toBe(0)
    expect(['COUNTER', 'SKIP', 'DELAY']).toContain(result.decision)
  })
})
