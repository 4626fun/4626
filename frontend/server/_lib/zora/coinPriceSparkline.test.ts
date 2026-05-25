import { describe, expect, it, vi } from 'vitest'

import { buildCoinPriceSparklineFromSwapEdges, resolveCoinPriceSparkline } from './coinPriceSparkline.js'

vi.mock('../uniswap/tokenPoolHistorySeries.js', () => ({
  fetchTokenPoolDayCloseSeries: vi.fn(),
}))

import { fetchTokenPoolDayCloseSeries } from '../uniswap/tokenPoolHistorySeries.js'

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

describe('resolveCoinPriceSparkline', () => {
  it('prefers subgraph daily closes over Zora swaps', async () => {
    vi.mocked(fetchTokenPoolDayCloseSeries).mockResolvedValueOnce({
      values: [1, 1.2, 1.5],
      changePercent: 50,
      poolId: '0xpool',
    })

    const sdk = {
      getCoinSwaps: vi.fn().mockResolvedValue({ data: { zora20Token: { swapActivities: { edges: [] } } } }),
    }

    const result = await resolveCoinPriceSparkline('0x1111111111111111111111111111111111111111', { sdk })
    expect(result.source).toBe('subgraph')
    expect(result.values).toEqual([1, 1.2, 1.5])
    expect(sdk.getCoinSwaps).not.toHaveBeenCalled()
  })

  it('falls back to Zora swaps when subgraph has no series', async () => {
    vi.mocked(fetchTokenPoolDayCloseSeries).mockResolvedValueOnce(null)
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    const sdk = {
      getCoinSwaps: vi.fn().mockResolvedValue({
        data: {
          zora20Token: {
            swapActivities: {
              edges: [
                { node: { blockTimestamp: new Date(now - 10 * dayMs).toISOString(), currencyAmountWithPrice: { priceUsdc: '2.00' } } },
                { node: { blockTimestamp: new Date(now - 1 * dayMs).toISOString(), currencyAmountWithPrice: { priceUsdc: '2.50' } } },
              ],
            },
          },
        },
      }),
    }

    const result = await resolveCoinPriceSparkline('0x1111111111111111111111111111111111111111', { sdk })
    expect(result.source).toBe('zora_swaps')
    expect(result.values.length).toBeGreaterThanOrEqual(2)
    expect(sdk.getCoinSwaps).toHaveBeenCalledOnce()
  })
})
