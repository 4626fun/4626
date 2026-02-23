import { describe, expect, it } from 'vitest'

import {
  areEquivalentSwapTokens,
  buildTokenOptions,
  getNestedAmountOut,
  NATIVE_TOKEN_ADDRESS,
  resolveTokenDisplay,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  shareTokenLogo,
  shortAddress,
  type TokenOption,
} from './swapUtils'

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x4200000000000000000000000000000000000006', group: 'core' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', group: 'core' },
]

describe('swapUtils token identity', () => {
  it('builds token options with creator + share entries', () => {
    const creator = '0x1111111111111111111111111111111111111111'
    const share = '0x2222222222222222222222222222222222222222'
    const options = buildTokenOptions({
      coreTokens: CORE_TOKENS,
      creatorCoin: creator,
      shareCoin: share,
      shareSymbol: 'AKITA',
      shareName: 'Akita Share',
      chainId: 8453,
    })

    expect(options).toHaveLength(4)
    expect(options.some((o) => o.address.toLowerCase() === creator.toLowerCase() && o.group === 'creator')).toBe(true)
    expect(options.some((o) => o.address.toLowerCase() === share.toLowerCase() && o.group === 'share')).toBe(true)
    expect(options.find((o) => o.group === 'share')?.logoUrl).toBe(shareTokenLogo(share))
  })

  it('deduplicates repeated addresses and falls back share metadata', () => {
    const duplicateCore = '0x4200000000000000000000000000000000000006'
    const share = '0x3333333333333333333333333333333333333333'
    const options = buildTokenOptions({
      coreTokens: CORE_TOKENS,
      creatorCoin: duplicateCore,
      shareCoin: share,
    })

    expect(options.filter((o) => o.address.toLowerCase() === duplicateCore.toLowerCase())).toHaveLength(1)
    const shareOption = options.find((o) => o.address.toLowerCase() === share.toLowerCase())
    expect(shareOption?.symbol).toBe('Share Token')
    expect(shareOption?.name).toBe('Share Token')
  })

  it('resolves non-core display with onchain metadata precedence', () => {
    const out = resolveTokenDisplay({
      option: {
        symbol: 'Creator Coin',
        name: 'Creator Coin',
        address: '0x4444444444444444444444444444444444444444',
        group: 'creator',
      },
      address: '0x4444444444444444444444444444444444444444',
      onchain: { name: 'Akita Coin', symbol: 'AKITA' },
      imageUrl: null,
    })
    expect(out.name).toBe('Akita Coin')
    expect(out.symbol).toBe('AKITA')
  })

  it('falls back to short address when metadata unavailable', () => {
    const token = '0x5555555555555555555555555555555555555555'
    const out = resolveTokenDisplay({
      option: null,
      address: token,
      onchain: null,
      imageUrl: null,
    })
    expect(out.name).toBe(shortAddress(token))
    expect(out.symbol).toBe(shortAddress(token))
  })

  it('extracts amountOut from nested quote shapes', () => {
    expect(getNestedAmountOut({ quote: { output: { amount: '123' } } })).toBe('123')
    expect(getNestedAmountOut({ output: { amount: 456 } })).toBe('456')
    expect(getNestedAmountOut({ expectedAmountOut: '789' })).toBe('789')
    expect(getNestedAmountOut({ orderInfo: { outputs: [{ startAmount: '2022' }] } })).toBe('2022')
    expect(getNestedAmountOut({})).toBeNull()
  })

  it('sanitizes decimal inputs for UI-safe parsing', () => {
    expect(sanitizeDecimalInput('..1abc2.34', 3)).toBe('0.123')
    expect(sanitizeDecimalInput('01,23456789', 4)).toBe('1.2345')
    expect(sanitizeDecimalInput('12.', 6)).toBe('12.')
  })

  it('sanitizes integer-only inputs', () => {
    expect(sanitizeIntegerInput('15m', 3)).toBe('15')
    expect(sanitizeIntegerInput('123456', 3)).toBe('123')
  })

  it('compares native and wrapped-native as equivalent', () => {
    const weth = '0x4200000000000000000000000000000000000006'
    expect(areEquivalentSwapTokens(NATIVE_TOKEN_ADDRESS, weth, weth)).toBe(true)
    expect(areEquivalentSwapTokens(weth, NATIVE_TOKEN_ADDRESS, weth)).toBe(true)
    expect(areEquivalentSwapTokens(weth, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', weth)).toBe(false)
  })
})

