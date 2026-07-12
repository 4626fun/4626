import { describe, expect, it } from 'vitest'

import { classifyFundingOiRegime, formatFundingOiRegime } from './fundingOiRegime.js'

describe('classifyFundingOiRegime', () => {
  it('fails closed when a required market field is unavailable', () => {
    expect(
      classifyFundingOiRegime({
        symbol: 'BTC',
        fundingRate: null,
        openInterestUsd: 1_000_000,
        volume24hUsd: 2_000_000,
        priceChange24hPct: 2,
      }),
    ).toMatchObject({
      symbol: 'BTC',
      regime: 'insufficient-data',
      confidence: 0,
      shadowOnly: true,
      missingFields: ['fundingRate'],
    })
  })

  it('detects crowded longs from positive funding and high OI participation', () => {
    const result = classifyFundingOiRegime({
      symbol: 'eth',
      fundingRate: 0.00015,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 3.2,
    })

    expect(result).toMatchObject({
      symbol: 'ETH',
      regime: 'crowded-longs',
      fundingBias: 'longs-paying',
      oiParticipation: 'high',
      shadowOnly: true,
      missingFields: [],
    })
    expect(result.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects crowded shorts symmetrically', () => {
    expect(
      classifyFundingOiRegime({
        symbol: 'SOL',
        fundingRate: -0.0002,
        openInterestUsd: 700_000,
        volume24hUsd: 1_000_000,
        priceChange24hPct: -4,
      }),
    ).toMatchObject({
      regime: 'crowded-shorts',
      fundingBias: 'shorts-paying',
      oiParticipation: 'high',
    })
  })

  it('keeps low-participation or flat-funding markets balanced', () => {
    expect(
      classifyFundingOiRegime({
        symbol: 'HYPE',
        fundingRate: 0.000005,
        openInterestUsd: 100_000,
        volume24hUsd: 1_000_000,
        priceChange24hPct: 0.4,
      }),
    ).toMatchObject({
      regime: 'balanced',
      fundingBias: 'flat',
      oiParticipation: 'low',
    })
  })

  it('returns an explicitly advisory, non-execution format', () => {
    const text = formatFundingOiRegime(
      classifyFundingOiRegime({
        symbol: 'BTC',
        fundingRate: 0.00015,
        openInterestUsd: 900_000,
        volume24hUsd: 1_000_000,
        priceChange24hPct: 3.2,
      }),
    )

    expect(text).toContain('Shadow Funding/OI Regime for BTC')
    expect(text).toContain('CROWDED-LONGS')
    expect(text).toContain('Advisory only')
    expect(text).not.toMatch(/\b(COUNTER|DELAY|SKIP)\b/)
  })

  it('never emits live-decision vocabulary for any regime branch', () => {
    const cases = [
      { fundingRate: 0.0002, openInterestUsd: 900_000, volume24hUsd: 1_000_000, priceChange24hPct: 3 },
      { fundingRate: -0.0002, openInterestUsd: 900_000, volume24hUsd: 1_000_000, priceChange24hPct: -3 },
      { fundingRate: 0.00001, openInterestUsd: 900_000, volume24hUsd: 1_000_000, priceChange24hPct: 1 },
      { fundingRate: 0.0002, openInterestUsd: 100_000, volume24hUsd: 1_000_000, priceChange24hPct: 3 },
      { fundingRate: null, openInterestUsd: null, volume24hUsd: null, priceChange24hPct: null },
    ]

    for (const input of cases) {
      const result = classifyFundingOiRegime({ symbol: 'BTC', ...input })
      expect(formatFundingOiRegime(result)).not.toMatch(/\b(COUNTER|DELAY|SKIP)\b/)
    }
  })
})
