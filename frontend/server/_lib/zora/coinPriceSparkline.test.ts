import { describe, expect, it } from 'vitest'

import { buildCoinPriceSparklineFromSwapEdges } from './coinPriceSparkline.js'

describe('buildCoinPriceSparklineFromSwapEdges', () => {
  it('derives 30d price values and percent change from swap edges', () => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const result = buildCoinPriceSparklineFromSwapEdges([
      { node: { blockTimestamp: new Date(now - 20 * dayMs).toISOString(), currencyAmountWithPrice: { priceUsdc: '1.00' } } },
      { node: { blockTimestamp: new Date(now - 10 * dayMs).toISOString(), currencyAmountWithPrice: { priceUsdc: '1.10' } } },
      { node: { blockTimestamp: new Date(now - 1 * dayMs).toISOString(), currencyAmountWithPrice: { priceUsdc: '1.25' } } },
    ])

    expect(result.values.length).toBeGreaterThanOrEqual(2)
    expect(result.changePercent).not.toBeNull()
    expect(result.changePercent!).toBeGreaterThan(0)
  })
})
