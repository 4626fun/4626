import { describe, expect, it } from 'vitest'

import { CONTRACTS } from '@/config/contracts'
import { deriveSwapUsdEstimates, formatSwapUsd } from '@/lib/swap/swapAmountUsd'

describe('formatSwapUsd', () => {
  it('uses full dollar precision instead of K abbreviations', () => {
    expect(formatSwapUsd(2044.49)).toBe('$2,044.49')
    expect(formatSwapUsd(2050)).toBe('$2,050.00')
  })

  it('keeps two decimals for small swap notionals', () => {
    expect(formatSwapUsd(88.92)).toBe('$88.92')
  })
})

describe('deriveSwapUsdEstimates', () => {
  it('does not mirror sell USD onto buy when output amount is zero', () => {
    const result = deriveSwapUsdEstimates({
      amountInUnits: '88.92',
      estimatedOut: '0',
      tokenIn: CONTRACTS.usdc,
      tokenOut: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      prices: { ethUsd: 0, tokenUsdByAddress: new Map() },
    })

    expect(result.amountInUsd).toBe('$88.92')
    expect(result.estimatedOutUsd).toBeNull()
  })
})
