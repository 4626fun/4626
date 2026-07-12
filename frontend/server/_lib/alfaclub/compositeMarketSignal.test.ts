import { describe, expect, it } from 'vitest'

import { classifyFundingOiRegime } from './fundingOiRegime.js'
import {
  formatCompositeMarketSignal,
  fuseCompositeMarketSignal,
} from './compositeMarketSignal.js'

describe('fuseCompositeMarketSignal', () => {
  it('aligns counter short-bias with fade-longs into a high-conviction SHORT', () => {
    const fundingOi = classifyFundingOiRegime({
      symbol: 'BTC',
      fundingRate: 0.0002,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 3.5,
    })
    const result = fuseCompositeMarketSignal({
      symbol: 'BTC',
      fundingOi,
      counter: {
        signal: 'short-bias',
        conviction: 80,
        priceChangePct: 6.2,
      },
    })

    expect(result.action).toBe('SHORT')
    expect(result.agreement).toBe('aligned')
    expect(result.conviction).toBeGreaterThanOrEqual(75)
    expect(result.sizeHintPct).toBeGreaterThanOrEqual(60)
  })

  it('vetoes to STAY_OUT when counter and Funding/OI conflict', () => {
    const fundingOi = classifyFundingOiRegime({
      symbol: 'ETH',
      fundingRate: 0.0002,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 3,
    })
    const result = fuseCompositeMarketSignal({
      symbol: 'ETH',
      fundingOi,
      counter: {
        signal: 'long-bias',
        conviction: 70,
        priceChangePct: -5,
      },
    })

    expect(result.action).toBe('STAY_OUT')
    expect(result.agreement).toBe('conflict')
    expect(result.conviction).toBeGreaterThanOrEqual(60)
    expect(result.sizeHintPct).toBe(0)
  })

  it('stays out with high certainty when both legs have no edge', () => {
    const fundingOi = classifyFundingOiRegime({
      symbol: 'BTC',
      fundingRate: 0.000013,
      openInterestUsd: 3_010_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: -0.21,
    })
    const result = fuseCompositeMarketSignal({
      symbol: 'BTC',
      fundingOi,
      counter: {
        signal: 'neutral',
        conviction: 0,
        priceChangePct: 0.4,
      },
    })

    expect(result.action).toBe('STAY_OUT')
    expect(result.agreement).toBe('none')
    expect(result.conviction).toBeGreaterThanOrEqual(70)
    expect(result.sizeHintPct).toBe(0)
  })

  it('allows a discounted single-leg SHORT from strong counter when Funding/OI is flat', () => {
    const fundingOi = classifyFundingOiRegime({
      symbol: 'SOL',
      fundingRate: 0.000005,
      openInterestUsd: 100_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 0.2,
    })
    const result = fuseCompositeMarketSignal({
      symbol: 'SOL',
      fundingOi,
      counter: {
        signal: 'short-bias',
        conviction: 90,
        priceChangePct: 8,
      },
    })

    expect(result.action).toBe('SHORT')
    expect(result.agreement).toBe('partial')
    expect(result.conviction).toBeLessThan(90)
    expect(result.conviction).toBeGreaterThanOrEqual(55)
    expect(result.sizeHintPct).toBeGreaterThan(0)
  })

  it('formats a decisive action card, not a mushy funding-only dump', () => {
    const fundingOi = classifyFundingOiRegime({
      symbol: 'BTC',
      fundingRate: 0.0002,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
      priceChange24hPct: 3.5,
    })
    const text = formatCompositeMarketSignal(
      fuseCompositeMarketSignal({
        symbol: 'BTC',
        fundingOi,
        counter: {
          signal: 'short-bias',
          conviction: 80,
          priceChangePct: 6.2,
        },
      }),
    )

    expect(text).toContain('SIGNAL — BTC')
    expect(text).toContain('Action: **SHORT**')
    expect(text).toContain('ALIGNED')
    expect(text).toContain('Drivers')
    expect(text).toContain('Playbook')
    expect(text).toContain('Advisory only')
    expect(text).not.toMatch(/Signal: BALANCED \(confidence: 4\d\/100\)/)
    expect(text).not.toMatch(/\b(COUNTER|DELAY|SKIP)\b/)
  })
})
