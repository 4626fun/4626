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
      lean: 'insufficient-data',
      confidence: 0,
      edgeScore: 0,
      shadowOnly: true,
      missingFields: ['fundingRate'],
    })
  })

  it('detects strong fade-longs from elevated funding and high OI participation', () => {
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
      lean: 'fade-longs',
      fundingBias: 'longs-paying',
      oiParticipation: 'high',
      shadowOnly: true,
      missingFields: [],
    })
    expect(result.confidence).toBeGreaterThanOrEqual(70)
    expect(result.edgeScore).toBeGreaterThanOrEqual(70)
    expect(result.strength).toMatch(/moderate|strong/)
  })

  it('detects fade-shorts symmetrically', () => {
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
      lean: 'fade-shorts',
      fundingBias: 'shorts-paying',
      oiParticipation: 'high',
    })
  })

  it('marks mild funding + high OI as watch, not full fade', () => {
    const result = classifyFundingOiRegime({
      symbol: 'BTC',
      fundingRate: 0.00004,
      openInterestUsd: 3_000_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 0.3,
    })

    expect(result).toMatchObject({
      regime: 'balanced',
      lean: 'watch-longs',
      fundingBias: 'longs-paying',
      oiParticipation: 'high',
    })
    expect(result.edgeScore).toBeGreaterThan(0)
    expect(result.edgeScore).toBeLessThan(70)
  })

  it('keeps flat-funding markets as no-edge with high certainty', () => {
    const result = classifyFundingOiRegime({
      symbol: 'HYPE',
      fundingRate: 0.000005,
      openInterestUsd: 100_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 0.4,
    })

    expect(result).toMatchObject({
      regime: 'balanced',
      lean: 'no-edge',
      fundingBias: 'flat',
      oiParticipation: 'low',
      strength: 'none',
    })
    expect(result.confidence).toBeGreaterThanOrEqual(70)
    expect(result.edgeScore).toBeLessThanOrEqual(25)
  })

  it('treats the canary-like BTC snapshot as no-edge, not a soft buy', () => {
    // Matches job 67942 shape: tiny funding, high OI/vol, flat price.
    const result = classifyFundingOiRegime({
      symbol: 'BTC',
      fundingRate: 0.000013,
      openInterestUsd: 3_010_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: -0.21,
    })

    expect(result.lean).toBe('no-edge')
    expect(result.regime).toBe('balanced')
    expect(result.edgeScore).toBeLessThan(30)
    expect(result.confidence).toBeGreaterThanOrEqual(70)
  })

  it('returns a decisive advisory format with lean + playbook', () => {
    const text = formatFundingOiRegime(
      classifyFundingOiRegime({
        symbol: 'BTC',
        fundingRate: 0.00015,
        openInterestUsd: 900_000,
        volume24hUsd: 1_000_000,
        priceChange24hPct: 3.2,
      }),
    )

    expect(text).toContain('Funding/OI signal — BTC')
    expect(text).toContain('FADE LONGS')
    expect(text).toContain('Playbook')
    expect(text).toContain('Advisory only')
    expect(text).not.toMatch(/\b(COUNTER|DELAY|SKIP)\b/)
    expect(text).not.toMatch(/Shadow Funding\/OI Regime|Regime:/i)
  })

  it('formats no-edge as stand-aside, not a mushy mid confidence headline', () => {
    const text = formatFundingOiRegime(
      classifyFundingOiRegime({
        symbol: 'BTC',
        fundingRate: 0.000013,
        openInterestUsd: 3_010_000,
        volume24hUsd: 1_000_000,
        priceChange24hPct: -0.21,
      }),
    )

    expect(text).toContain('NO EDGE')
    expect(text).toContain('Edge:')
    expect(text).toContain('certainty no-edge')
    expect(text).toContain('stand aside')
    expect(text).not.toMatch(/Signal: BALANCED \(confidence: 4\d\/100\)/)
  })

  it('never emits live-decision vocabulary for any lean branch', () => {
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
