import { describe, expect, it } from 'vitest'

import { mad, madZ, median } from './madZ.js'
import { computeFeatureDeltas } from './featureSnapshotStore.js'
import { selectLiquidUniverse } from './ingestSampler.js'
import type { MarketFeatureSnapshot } from './types.js'

describe('madZ', () => {
  it('computes robust z from median and MAD', () => {
    const window = [1, 2, 2, 2, 3, 100]
    expect(median(window)).toBe(2)
    expect(mad(window)).toBe(0.5)
    expect(madZ(100, window)).not.toBeNull()
    expect(madZ(null, window)).toBeNull()
    expect(madZ(2, [1])).toBeNull()
  })
})

describe('computeFeatureDeltas', () => {
  const current: MarketFeatureSnapshot = {
    symbol: 'BTC',
    observedAtMs: 1_000_000,
    markPriceUsd: 101,
    fundingRate: 0.0002,
    openInterestUsd: 1_100,
    volume24hUsd: 2_000,
    priceChange24hPct: 1.2,
    oraclePriceUsd: null,
    basisBps: null,
  }

  it('returns null deltas when prior history is missing', () => {
    const deltas = computeFeatureDeltas({ current, prior: null })
    expect(deltas.dOpenInterestUsd).toBeNull()
    expect(deltas.missing).toEqual([
      'dFunding',
      'dOpenInterestUsd',
      'dVolume24hUsd',
      'dMarkPriceUsd',
    ])
  })

  it('computes honest deltas from a prior snapshot inside the age window', () => {
    const prior: MarketFeatureSnapshot = {
      ...current,
      observedAtMs: 1_000_000 - 5 * 60 * 1000,
      markPriceUsd: 100,
      fundingRate: 0.0001,
      openInterestUsd: 1_000,
      volume24hUsd: 1_500,
    }
    const deltas = computeFeatureDeltas({ current, prior })
    expect(deltas.dFunding).toBeCloseTo(0.0001)
    expect(deltas.dOpenInterestUsd).toBe(100)
    expect(deltas.dVolume24hUsd).toBe(500)
    expect(deltas.dMarkPriceUsd).toBe(1)
    expect(deltas.missing).toEqual([])
  })
})

describe('selectLiquidUniverse', () => {
  it('filters by volume and ranks descending', () => {
    const selected = selectLiquidUniverse(
      [
        {
          symbol: 'AAA',
          markPriceUsd: 1,
          priceChange24hPct: 0,
          fundingRate: 0,
          openInterestUsd: 1,
          volume24hUsd: 5_000_000,
        },
        {
          symbol: 'BTC',
          markPriceUsd: 1,
          priceChange24hPct: 0,
          fundingRate: 0,
          openInterestUsd: 1,
          volume24hUsd: 50_000_000,
        },
        {
          symbol: 'ETH',
          markPriceUsd: 1,
          priceChange24hPct: 0,
          fundingRate: 0,
          openInterestUsd: 1,
          volume24hUsd: 20_000_000,
        },
      ],
      { topN: 2, minimumDailyVolumeUsd: 10_000_000 },
    )
    expect(selected.map((row) => row.symbol)).toEqual(['BTC', 'ETH'])
  })
})
