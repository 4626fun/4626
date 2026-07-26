import { describe, expect, it } from 'vitest'

import { getCoinFeeStatus, resolveExploreFeeBucketDisplay } from './rowFormatting'

describe('resolveExploreFeeBucketDisplay', () => {
  it('prefers indexed CoinTradeRewards buckets over volume × rate', () => {
    const { feeRates } = getCoinFeeStatus(undefined, '2025-07-01T00:00:00.000Z')
    const display = resolveExploreFeeBucketDisplay({
      feeBuckets: {
        creatorUsd: '175.04',
        platformUsd: '70.02',
        protocolUsd: '17.50',
        lpUsd: '70.02',
        dopplerUsd: '3.50',
        indexedAt: '2026-07-26T00:00:00.000Z',
      },
      volumeForFees: '1000000',
      feeRates,
    })
    expect(display.indexed).toBe(true)
    expect(display.creator).toBe('$175.04')
    expect(display.platform).toBe('$70.02')
    expect(display.zora).toBe('$17.50')
    expect(display.lp).toBe('$70.02')
    expect(display.doppler).toBe('$3.50')
  })

  it('falls back to volume × fee rate when buckets are not indexed', () => {
    const { feeRates } = getCoinFeeStatus(undefined, '2025-07-01T00:00:00.000Z')
    const display = resolveExploreFeeBucketDisplay({
      feeBuckets: null,
      volumeForFees: '35000',
      feeRates,
    })
    expect(display.indexed).toBe(false)
    expect(display.creator).toBe('$175.00')
    expect(display.platform).toBe('$70.00')
    expect(display.lp).toBe('$70.00')
    expect(display.zora).toBe('$17.50')
    expect(display.doppler).toBe('$3.50')
  })
})
