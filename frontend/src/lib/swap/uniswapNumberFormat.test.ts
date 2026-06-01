import { describe, expect, it } from 'vitest'

import {
  formatUniswapSwapTradeAmount,
  formatUniswapTokenBalanceAmount,
} from '@/lib/swap/uniswapNumberFormat'

describe('formatUniswapTokenBalanceAmount', () => {
  it('matches Uniswap swap-card balance chips', () => {
    expect(formatUniswapTokenBalanceAmount(1100)).toBe('1,100')
    expect(formatUniswapTokenBalanceAmount(0.55309)).toBe('0.55309')
    expect(formatUniswapTokenBalanceAmount(103_300_000)).toBe('103,300,000')
    expect(formatUniswapTokenBalanceAmount(654_538.892)).toBe('654,538.89')
    expect(formatUniswapTokenBalanceAmount(0.00688)).toBe('0.00688')
    expect(formatUniswapTokenBalanceAmount(0.00007)).toBe('0.00007')
    expect(formatUniswapTokenBalanceAmount(2940.34)).toBe('2,940.34')
  })
})

describe('formatUniswapSwapTradeAmount', () => {
  it('omits commas on large trade amounts like Uniswap quote fields', () => {
    expect(formatUniswapSwapTradeAmount(30_124_800)).toBe('30124800')
    expect(formatUniswapSwapTradeAmount(2015.156638)).toBe('2015.16')
    expect(formatUniswapSwapTradeAmount(1.00162)).toBe('1.00162')
  })
})
