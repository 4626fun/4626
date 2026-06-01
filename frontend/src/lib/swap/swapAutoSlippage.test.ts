import { describe, expect, it } from 'vitest'

import {
  formatSlippagePctForDisplay,
  parsePriceImpactPercentFromLabel,
  resolveAutoSwapSlippagePct,
} from '@/lib/swap/swapAutoSlippage'

describe('resolveAutoSwapSlippagePct', () => {
  it('uses 5% floor for canonical Zora routes', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: true,
        executionMode: 'canonical',
      }),
    ).toBe(5)
  })

  it('uses 2% floor for EOA Zora routes', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: true,
        executionMode: 'eoa',
      }),
    ).toBe(2)
  })

  it('bumps slippage when price impact is high', () => {
    expect(
      resolveAutoSwapSlippagePct({
        preferZoraTradeRoute: false,
        executionMode: 'canonical',
        priceImpactPercent: 8,
      }),
    ).toBe(10)
  })

  it('respects quoted Zora provider without prefer flag', () => {
    expect(
      resolveAutoSwapSlippagePct({
        quotedProvider: 'zora',
        executionMode: 'canonical',
      }),
    ).toBe(5)
  })
})

describe('parsePriceImpactPercentFromLabel', () => {
  it('parses formatted impact labels', () => {
    expect(parsePriceImpactPercentFromLabel('4.25%')).toBe(4.25)
    expect(parsePriceImpactPercentFromLabel('<0.01%')).toBe(0.01)
  })
})

describe('formatSlippagePctForDisplay', () => {
  it('formats integers and decimals cleanly', () => {
    expect(formatSlippagePctForDisplay(5)).toBe('5')
    expect(formatSlippagePctForDisplay(0.5)).toBe('0.5')
    expect(formatSlippagePctForDisplay(10)).toBe('10')
  })
})
