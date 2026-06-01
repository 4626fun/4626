import { describe, expect, it } from 'vitest'

import {
  amountUnitsFromBalancePercent,
  formatSwapDisplayAmount,
  formatSwapTokenBalanceLabel,
  formatSwapTokenUsdLabel,
} from '@/lib/swap/swapDisplayAmount'

describe('amountUnitsFromBalancePercent', () => {
  it('uses full raw balance at 100% even when display rounds to fewer decimals', () => {
    const balance = { raw: 887_174_848n, decimals: 6 }
    expect(amountUnitsFromBalancePercent(balance, 100)).toBe('887.174848')
    expect(amountUnitsFromBalancePercent(balance, 50)).toBe('443.587424')
  })

  it('never exceeds raw units at fractional percentages', () => {
    const balance = { raw: 1_000_001n, decimals: 6 }
    expect(amountUnitsFromBalancePercent(balance, 33)).toBe('0.33')
  })
})

describe('formatSwapDisplayAmount', () => {
  it('formats stablecoin outputs with two decimals', () => {
    expect(formatSwapDisplayAmount('2015.156638', 'USDC')).toBe('2015.16')
    expect(formatSwapDisplayAmount('2020', 'USDC')).toBe('2020')
  })

  it('formats ETH-like outputs with trimmed precision', () => {
    expect(formatSwapDisplayAmount('1.001620000', 'ETH')).toBe('1.00162')
  })

  it('passes through empty and zero', () => {
    expect(formatSwapDisplayAmount('')).toBe('')
    expect(formatSwapDisplayAmount('0', 'ETH')).toBe('0')
  })
})

describe('formatSwapTokenBalanceLabel', () => {
  it('comma-groups large balances to cents (654,538.89 style)', () => {
    expect(formatSwapTokenBalanceLabel('654538.89230025562217', 'akita')).toBe('654,538.89')
    expect(formatSwapTokenBalanceLabel('103654538.896', 'akita')).toBe('103,654,538.9')
    expect(formatSwapTokenBalanceLabel('10312658.93179696315806', 'b20')).toBe('10,312,658.93')
    expect(formatSwapTokenBalanceLabel('103300000', 'akita')).toBe('103,300,000')
    expect(formatSwapTokenBalanceLabel('103300000.78', 'akita')).toBe('103,300,000.78')
  })

  it('uses two decimals for mid-sized holdings', () => {
    expect(formatSwapTokenBalanceLabel('5.4729', 'SOL')).toBe('5.47')
  })

  it('keeps extra precision for tiny fractional amounts', () => {
    expect(formatSwapTokenBalanceLabel('0.00688', 'ETH')).toBe('0.00688')
    expect(formatSwapTokenBalanceLabel('0.00007', 'ETH')).toBe('0.00007')
  })

  it('pins stables to cents when >= 1', () => {
    expect(formatSwapTokenBalanceLabel('2940.34', 'USDC')).toBe('2,940.34')
    expect(formatSwapTokenBalanceLabel('2940.3499', 'USDC')).toBe('2,940.35')
  })
})

describe('formatSwapTokenUsdLabel', () => {
  it('always shows cents for sub-million USD values', () => {
    expect(formatSwapTokenUsdLabel(2939.52)).toBe('$2,939.52')
    expect(formatSwapTokenUsdLabel(0.14)).toBe('$0.14')
  })
})
