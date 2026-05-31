import { describe, expect, it } from 'vitest'

import {
  extractSwapRouteSummary,
  formatQuoteGasEstimateLabel,
  formatSwapPriceImpactLabel,
  formatUniswapPoolFeePercent,
  normalizePriceImpactPercent,
  parseSwapRouteFromClassicQuote,
} from './swapQuoteDetails'

describe('swapQuoteDetails', () => {
  it('ignores routing enum values as route summary', () => {
    expect(extractSwapRouteSummary({ routing: 'CLASSIC' } as any)).toBeNull()
  })

  it('uses routeString from classic quote', () => {
    expect(
      extractSwapRouteSummary({
        routing: 'CLASSIC',
        quote: { routeString: 'USDC → WETH → AKITA' },
      } as any),
    ).toBe('USDC → WETH → AKITA')
  })

  it('labels zora quotes with zora router copy', () => {
    expect(extractSwapRouteSummary({ provider: 'zora', routing: 'CLASSIC' } as any)).toBe(
      'Zora Universal Router',
    )
  })

  it('normalizes fractional price impact to percent', () => {
    expect(normalizePriceImpactPercent(0.005)).toBe(0.5)
    expect(formatSwapPriceImpactLabel(0.005)).toBe('0.50%')
  })

  it('drops bogus -100% price impact', () => {
    expect(formatSwapPriceImpactLabel(-100)).toBeNull()
  })

  it('converts tiny gasFeeUSD values from eth to usd', () => {
    expect(
      formatQuoteGasEstimateLabel({
        quote: { quote: { gasFeeUSD: '0.004087454597225348' } } as any,
        ethUsd: 3000,
      }),
    ).toBe('$12.26')
  })

  it('builds full token path including the sell token', () => {
    const parsed = parseSwapRouteFromClassicQuote({
      route: [
        [
          {
            type: 'v3-pool',
            tokenIn: { symbol: 'USDC' },
            tokenOut: { symbol: 'WETH' },
            fee: '500',
          },
        ],
        [
          {
            type: 'v4-pool',
            tokenIn: { symbol: 'WETH' },
            tokenOut: { symbol: 'AKITA' },
            fee: '10000',
          },
        ],
      ],
    })

    expect(parsed.summary).toBe('USDC → WETH → AKITA')
    expect(parsed.legs).toHaveLength(2)
    expect(parsed.legs[0]?.feePercentLabel).toBe('0.05%')
    expect(parsed.legs[1]?.feePercentLabel).toBe('1.00%')
  })

  it('formats uniswap pool fee tiers', () => {
    expect(formatUniswapPoolFeePercent(3000)).toBe('0.30%')
    expect(formatUniswapPoolFeePercent(10000)).toBe('1.00%')
  })
})
