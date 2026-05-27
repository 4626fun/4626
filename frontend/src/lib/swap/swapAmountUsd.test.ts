import { describe, expect, it } from 'vitest'

import { CONTRACTS } from '@/config/contracts'
import { deriveSwapUsdEstimates, isUsdStablecoinToken, parsePositiveHumanAmount } from '@/lib/swap/swapAmountUsd'
import { NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'

describe('swapAmountUsd', () => {
  it('parses positive human amounts', () => {
    expect(parsePositiveHumanAmount('100')).toBe(100)
    expect(parsePositiveHumanAmount('0')).toBeNull()
    expect(parsePositiveHumanAmount('')).toBeNull()
  })

  it('values USDC sell and mirrors to buy when output has no USD price', () => {
    const result = deriveSwapUsdEstimates({
      amountInUnits: '100',
      estimatedOut: '250',
      tokenIn: CONTRACTS.usdc,
      tokenOut: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      prices: { ethUsd: 2500, tokenUsdByAddress: new Map() },
    })
    expect(result.amountInUsd).toBe('$100.00')
    expect(result.estimatedOutUsd).toBe('$100.00')
  })

  it('values ETH sell using ethUsd and mirrors to USDC buy', () => {
    const result = deriveSwapUsdEstimates({
      amountInUnits: '0.000176',
      estimatedOut: '0.362161',
      tokenIn: NATIVE_TOKEN_ADDRESS,
      tokenOut: CONTRACTS.usdc,
      prices: { ethUsd: 2500, tokenUsdByAddress: new Map() },
    })
    expect(result.amountInUsd).toBe('$0.44')
    expect(result.estimatedOutUsd).toBe('$0.36')
  })

  it('detects Base USDC as stablecoin', () => {
    expect(isUsdStablecoinToken(CONTRACTS.usdc)).toBe(true)
    expect(isUsdStablecoinToken('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2')).toBe(true)
  })
})
