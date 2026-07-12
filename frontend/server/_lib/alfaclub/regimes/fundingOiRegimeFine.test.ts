import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../marketState/featureSnapshotStore.js', () => ({
  loadPriorMarketFeatureSnapshot: vi.fn(async () => null),
  computeFeatureDeltas: vi.fn(() => ({
    dFunding: null,
    dOpenInterestUsd: null,
    dVolume24hUsd: null,
    dMarkPriceUsd: null,
    lookbackMs: null,
    priorObservedAtMs: null,
    missing: ['dFunding', 'dOpenInterestUsd', 'dVolume24hUsd', 'dMarkPriceUsd'],
  })),
  loadFeatureHistory: vi.fn(async () => []),
}))

import { classifyFineFundingOiRegime } from './fundingOiRegimeFine.js'

describe('classifyFineFundingOiRegime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits fine + coarse labels and lists missing fields without imputation', async () => {
    const result = await classifyFineFundingOiRegime({
      snapshot: {
        symbol: 'hype',
        observedAtMs: Date.parse('2026-07-12T08:30:00.000Z'),
        markPriceUsd: 40,
        fundingRate: 0.0003,
        openInterestUsd: 50_000_000,
        volume24hUsd: 10_000_000,
        priceChange24hPct: 4,
        oraclePriceUsd: null,
        basisBps: null,
      },
    })
    expect(result.regimeFine).toBeTruthy()
    expect(result.regimeCoarse).toMatch(/crowded|balanced|insufficient/)
    expect(result.marketState.normalization).toBe('absolute_thresholds_v2')
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['dF_t', 'dOI_t', 'B_t', 'OF_t', 'L_t']),
    )
    expect(result.marketState.B_t).toBeNull()
    expect(result.shadowOnly).toBe(true)
    expect(result.methodologyVersion).toBe('inv-akita-regime-v1.0.0')
  })
})
