import { describe, expect, it } from 'vitest'

import { resolveEnrichmentFinancials } from '../../../server/_lib/zora/creatorMetricsSyncHelpers.js'

describe('resolveEnrichmentFinancials', () => {
  it('writes zero metrics for unlisted coins with no API financials', () => {
    const result = resolveEnrichmentFinancials({
      marketCapUsd: null,
      volume24hUsd: null,
      feeModel: 'v4',
    })
    expect(result).toEqual({
      marketCapUsd: 0,
      volume24hUsd: 0,
      fees24hUsd: 0,
      unlisted: true,
    })
  })

  it('derives fees from volume and fee model when market cap is missing', () => {
    const result = resolveEnrichmentFinancials({
      marketCapUsd: null,
      volume24hUsd: 1000,
      feeModel: 'legacy',
    })
    expect(result.marketCapUsd).toBe(0)
    expect(result.volume24hUsd).toBe(1000)
    expect(result.fees24hUsd).toBe(30)
    expect(result.unlisted).toBe(false)
  })

  it('preserves listed coin financials', () => {
    const result = resolveEnrichmentFinancials({
      marketCapUsd: 5000,
      volume24hUsd: 250,
      feeModel: 'v4',
    })
    expect(result).toEqual({
      marketCapUsd: 5000,
      volume24hUsd: 250,
      fees24hUsd: 2.5,
      unlisted: false,
    })
  })
})
