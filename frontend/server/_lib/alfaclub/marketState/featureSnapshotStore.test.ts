import { describe, expect, it } from 'vitest'

import {
  bucketObservedAtMs,
  computeFeatureDeltas,
} from './featureSnapshotStore.js'
import type { MarketFeatureSnapshot } from './types.js'

function snap(partial: Partial<MarketFeatureSnapshot> & Pick<MarketFeatureSnapshot, 'observedAtMs'>): MarketFeatureSnapshot {
  return {
    symbol: 'HYPE',
    markPriceUsd: 40,
    fundingRate: 0.0001,
    openInterestUsd: 1_000_000,
    volume24hUsd: 500_000,
    priceChange24hPct: 1.2,
    oraclePriceUsd: null,
    basisBps: null,
    ...partial,
  }
}

describe('market feature snapshot primitives', () => {
  it('buckets timestamps for idempotent 5-minute sampling', () => {
    const t = Date.parse('2026-07-12T08:33:41.000Z')
    expect(bucketObservedAtMs(t)).toBe(Date.parse('2026-07-12T08:30:00.000Z'))
    expect(bucketObservedAtMs(t, 5 * 60 * 1000)).toBe(bucketObservedAtMs(t + 60_000))
  })

  it('computes deltas only from point-in-time priors within tolerance', () => {
    const current = snap({
      observedAtMs: Date.parse('2026-07-12T08:35:00.000Z'),
      fundingRate: 0.0003,
      openInterestUsd: 1_100_000,
      volume24hUsd: 520_000,
      markPriceUsd: 41,
    })
    const prior = snap({
      observedAtMs: Date.parse('2026-07-12T08:30:00.000Z'),
      fundingRate: 0.0001,
      openInterestUsd: 1_000_000,
      volume24hUsd: 500_000,
      markPriceUsd: 40,
    })
    const deltas = computeFeatureDeltas({ current, prior, maxAgeMs: 20 * 60 * 1000 })
    expect(deltas.dFunding).toBeCloseTo(0.0002)
    expect(deltas.dOpenInterestUsd).toBe(100_000)
    expect(deltas.dVolume24hUsd).toBe(20_000)
    expect(deltas.dMarkPriceUsd).toBe(1)
    expect(deltas.missing).toEqual([])
  })

  it('leaves deltas null when prior is missing or stale', () => {
    const current = snap({ observedAtMs: 1_000_000 })
    expect(computeFeatureDeltas({ current, prior: null }).missing).toContain('dFunding')
    const stale = snap({ observedAtMs: 1_000_000 - 60 * 60 * 1000 })
    expect(
      computeFeatureDeltas({ current, prior: stale, maxAgeMs: 20 * 60 * 1000 }).dFunding,
    ).toBeNull()
  })

  it('never imputes when a feature side is null', () => {
    const current = snap({
      observedAtMs: 2_000_000,
      fundingRate: null,
      openInterestUsd: 2,
    })
    const prior = snap({
      observedAtMs: 1_000_000,
      fundingRate: 0.1,
      openInterestUsd: 1,
    })
    const deltas = computeFeatureDeltas({ current, prior, maxAgeMs: 2_000_000 })
    expect(deltas.dFunding).toBeNull()
    expect(deltas.dOpenInterestUsd).toBe(1)
    expect(deltas.missing).toContain('dFunding')
  })
})
