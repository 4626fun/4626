import { describe, expect, it } from 'vitest'

import {
  extractSwapRouteSummary,
  formatQuoteGasEstimateLabel,
  formatSwapExchangeRate,
  formatSwapNetworkCostDisplay,
  formatSwapPriceImpactLabel,
  formatUniswapPoolFeePercent,
  normalizePriceImpactPercent,
  parseSwapRouteFromClassicQuote,
  summarizeRouteProtocols,
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

  it('treats Uniswap priceImpact as percent (not decimal fraction)', () => {
    expect(normalizePriceImpactPercent(0.04)).toBe(0.04)
    expect(formatSwapPriceImpactLabel(0.04)).toBe('0.04%')
    expect(formatSwapPriceImpactLabel(4)).toBe('4.00%')
    expect(formatSwapPriceImpactLabel(0.005)).toBe('0.01%')
  })

  it('drops bogus -100% price impact', () => {
    expect(formatSwapPriceImpactLabel(-100)).toBeNull()
  })

  it('uses gasFeeUSD directly as usd (Uniswap API is USDC-denominated)', () => {
    expect(
      formatQuoteGasEstimateLabel({
        quote: { quote: { gasFeeUSD: '0.004087454597225348' } } as any,
        ethUsd: 3000,
      }),
    ).toBe('$0.004087')
  })

  it('shows sponsored label for canonical paymaster execution', () => {
    expect(
      formatQuoteGasEstimateLabel({
        quote: { quote: { gasFeeUSD: '4.71' } } as any,
        ethUsd: 3000,
        sponsoredExecution: true,
      }),
    ).toBe('Sponsored')
  })

  it('converts gasFee wei to usd when gasFeeUSD is absent', () => {
    expect(
      formatQuoteGasEstimateLabel({
        quote: { quote: { gasFee: '1570000000000000' } } as any,
        ethUsd: 3000,
      }),
    ).toBe('$4.71')
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

  it('formats execution exchange rate from quoted amounts', () => {
    expect(
      formatSwapExchangeRate({
        amountIn: '1',
        tokenInSymbol: 'USDC',
        amountOut: '95840.4',
        tokenOutSymbol: 'akita',
      }),
    ).toBe('1 USDC = 95840.4 akita')
  })

  it('formats tiny execution rates without scientific notation', () => {
    const rate = formatSwapExchangeRate({
      amountIn: '1',
      tokenInSymbol: 'OS',
      amountOut: '0.0000002993133619015909',
      tokenOutSymbol: 'ETH',
    })
    expect(rate).toBeTruthy()
    expect(rate).not.toMatch(/e[-+]/i)
    expect(rate).toContain('1 OS =')
    expect(rate).toContain('ETH')
  })

  it('summarizes mixed v3/v4 route protocols', () => {
    expect(
      summarizeRouteProtocols([
        { protocol: 'v3', protocolLabel: 'Uniswap V3', tokenIn: 'USDC', tokenOut: 'WETH', feePercentLabel: '0.30%', poolAddress: null },
        { protocol: 'v4', protocolLabel: 'Uniswap V4', tokenIn: 'WETH', tokenOut: 'AKITA', feePercentLabel: '3.00%', poolAddress: null },
      ]),
    ).toBe('V3 + V4 100%')
  })

  it('shows sponsored network cost for canonical paymaster execution', () => {
    expect(formatSwapNetworkCostDisplay({ gasEstimateLabel: 'Sponsored', sponsoredExecution: true })).toEqual({
      primary: 'Free',
      sponsoredFree: true,
    })
  })
})
