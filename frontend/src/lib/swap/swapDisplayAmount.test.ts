import { describe, expect, it } from 'vitest'

import { formatSwapDisplayAmount } from '@/lib/swap/swapDisplayAmount'

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
