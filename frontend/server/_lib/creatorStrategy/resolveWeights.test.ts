import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  DEFAULT_AJNA_WEIGHT_BPS,
  DEFAULT_CHARM_WEIGHT_BPS,
  DEFAULT_IDLE_RESERVE_BPS,
  DEFAULT_SOLANA_WEIGHT_BPS,
  PRODUCTIVE_ALLOCATION_BPS,
  TOTAL_ALLOCATION_BPS,
  computeStrategyWeights,
  gateRequestedStrategyWeights,
  resolveCreatorStrategyPlan,
} from './resolveWeights'

import type { CreatorStrategyFeatureKey } from './catalog'

const CREATOR = getAddress('0x1111111111111111111111111111111111111111')

function mockDb(activeFeatureKeys: CreatorStrategyFeatureKey[]) {
  return {
    sql: async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
      rows: activeFeatureKeys.map((feature_key) => ({ feature_key })),
    }),
  }
}

describe('computeStrategyWeights (scaling)', () => {
  it('returns {ok:false, no_paid_strategies} when the creator has paid for nothing', () => {
    const result = computeStrategyWeights(new Set<CreatorStrategyFeatureKey>())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no_paid_strategies')
  })

  it('ignores non-gating feature keys like solana_meteora_alpha_vault', () => {
    const result = computeStrategyWeights(
      new Set<CreatorStrategyFeatureKey>(['solana_meteora_alpha_vault']),
    )
    // Meteora add-on is post-deploy, not a deploy-gating key — it alone
    // does not count as a paid strategy for Phase 3.
    expect(result.ok).toBe(false)
  })

  it('one paid strategy gets the full 9_000 productive budget (90 %)', () => {
    const result = computeStrategyWeights(new Set<CreatorStrategyFeatureKey>(['charm_active_lp']))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.weights.charmWeightBps).toBe(PRODUCTIVE_ALLOCATION_BPS)
    expect(result.weights.charmWeightBps).toBe(9_000n)
    expect(result.weights.ajnaWeightBps).toBe(0n)
    expect(result.weights.solanaWeightBps).toBe(0n)
    expect(result.weights.idleReserveBps).toBe(DEFAULT_IDLE_RESERVE_BPS)
    const sum =
      result.weights.charmWeightBps +
      result.weights.ajnaWeightBps +
      result.weights.solanaWeightBps +
      result.weights.idleReserveBps
    expect(sum).toBe(TOTAL_ALLOCATION_BPS)
  })

  it('two paid strategies split 9_000 evenly at 4_500 bps each', () => {
    const result = computeStrategyWeights(
      new Set<CreatorStrategyFeatureKey>(['ajna_sleeve', 'solana_bridge_strategy']),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.weights.charmWeightBps).toBe(0n)
    expect(result.weights.ajnaWeightBps).toBe(4_500n)
    expect(result.weights.solanaWeightBps).toBe(4_500n)
    expect(result.weights.idleReserveBps).toBe(DEFAULT_IDLE_RESERVE_BPS)
  })

  it('three paid strategies split 9_000 at 3_000 bps each', () => {
    const result = computeStrategyWeights(
      new Set<CreatorStrategyFeatureKey>([
        'charm_active_lp',
        'ajna_sleeve',
        'solana_bridge_strategy',
      ]),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.weights.charmWeightBps).toBe(DEFAULT_CHARM_WEIGHT_BPS)
    expect(result.weights.ajnaWeightBps).toBe(DEFAULT_AJNA_WEIGHT_BPS)
    expect(result.weights.solanaWeightBps).toBe(DEFAULT_SOLANA_WEIGHT_BPS)
    expect(result.weights.idleReserveBps).toBe(DEFAULT_IDLE_RESERVE_BPS)
  })

  it('every valid count sums to exactly TOTAL_ALLOCATION_BPS (no rounding loss)', () => {
    for (const keys of [
      ['charm_active_lp'],
      ['ajna_sleeve'],
      ['solana_bridge_strategy'],
      ['charm_active_lp', 'ajna_sleeve'],
      ['charm_active_lp', 'solana_bridge_strategy'],
      ['ajna_sleeve', 'solana_bridge_strategy'],
      ['charm_active_lp', 'ajna_sleeve', 'solana_bridge_strategy'],
    ] as const) {
      const result = computeStrategyWeights(new Set<CreatorStrategyFeatureKey>(keys))
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const sum =
        result.weights.charmWeightBps +
        result.weights.ajnaWeightBps +
        result.weights.solanaWeightBps +
        result.weights.idleReserveBps
      expect(sum).toBe(TOTAL_ALLOCATION_BPS)
    }
  })
})

describe('resolveCreatorStrategyPlan', () => {
  it('returns {ok:false, no_paid_strategies} when nothing is paid', async () => {
    const db = mockDb([])
    const result = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('no_paid_strategies')
      expect(result.creatorToken).toBe(CREATOR)
      expect(result.activeFeatureKeys).toEqual([])
    }
  })

  it('wraps the scaled plan in {ok:true, plan:…} when at least one feature is paid', async () => {
    const db = mockDb(['charm_active_lp'])
    const result = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { plan } = result
    expect(plan.creatorToken).toBe(CREATOR)
    expect(plan.charmWeightBps).toBe(9_000n)
    expect(plan.ajnaWeightBps).toBe(0n)
    expect(plan.solanaWeightBps).toBe(0n)
    expect(plan.idleReserveBps).toBe(DEFAULT_IDLE_RESERVE_BPS)
    expect(plan.reasons.charm).toBe('paid')
    expect(plan.reasons.ajna).toBe('unpaid')
    expect(plan.reasons.solana).toBe('unpaid')
    expect(plan.activeFeatureKeys).toEqual(['charm_active_lp'])
  })
})

describe('gateRequestedStrategyWeights', () => {
  it('accepts exact server-plan match (all three paid)', async () => {
    const db = mockDb(['charm_active_lp', 'ajna_sleeve', 'solana_bridge_strategy'])
    const res = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { plan } = res
    const result = gateRequestedStrategyWeights(plan, {
      charmWeightBps: plan.charmWeightBps,
      ajnaWeightBps: plan.ajnaWeightBps,
      solanaWeightBps: plan.solanaWeightBps,
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a single-strategy 9_000 weight', async () => {
    const db = mockDb(['solana_bridge_strategy'])
    const res = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const { plan } = res
    const result = gateRequestedStrategyWeights(plan, {
      charmWeightBps: 0n,
      ajnaWeightBps: 0n,
      solanaWeightBps: 9_000n,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects nonzero charm weight when charm is unpaid', async () => {
    const db = mockDb(['ajna_sleeve'])
    const res = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const result = gateRequestedStrategyWeights(res.plan, {
      charmWeightBps: 3_000n,
      ajnaWeightBps: res.plan.ajnaWeightBps,
      solanaWeightBps: 0n,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('charm_unpaid_but_requested')
  })

  it('rejects nonzero solana weight when solana is unpaid', async () => {
    const db = mockDb(['charm_active_lp', 'ajna_sleeve'])
    const res = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const result = gateRequestedStrategyWeights(res.plan, {
      charmWeightBps: res.plan.charmWeightBps,
      ajnaWeightBps: res.plan.ajnaWeightBps,
      solanaWeightBps: 3_000n,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('solana_unpaid_but_requested')
  })

  it('rejects a paid charm weight that disagrees with the plan', async () => {
    const db = mockDb(['charm_active_lp', 'ajna_sleeve', 'solana_bridge_strategy'])
    const res = await resolveCreatorStrategyPlan(db, CREATOR)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const result = gateRequestedStrategyWeights(res.plan, {
      charmWeightBps: res.plan.charmWeightBps + 1n,
      ajnaWeightBps: res.plan.ajnaWeightBps,
      solanaWeightBps: res.plan.solanaWeightBps,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('charm_weight_mismatch')
  })
})
