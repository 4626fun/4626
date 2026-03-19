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
  tokenLogoFallbacks,
  shortAddress,
  trustWalletBaseLogo,
  type TokenOption,
  uniswapBaseLogo,
  z0r0zBaseLogo,
} from './swapUtils'

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, group: 'core' },
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

  it('ignores unverified share labels by default', () => {
    const share = '0x9999999999999999999999999999999999999999'
    const options = buildTokenOptions({
      coreTokens: CORE_TOKENS,
      shareCoin: share,
      shareSymbol: 'USDC',
      shareName: 'USD Coin',
    })
    const shareOption = options.find((o) => o.address.toLowerCase() === share.toLowerCase())
    expect(shareOption?.symbol).toBe('Share Token')
    expect(shareOption?.name).toBe('Share Token')
  })

  it('keeps share labels when explicitly marked verified', () => {
    const share = '0x8888888888888888888888888888888888888888'
    const options = buildTokenOptions({
      coreTokens: CORE_TOKENS,
      shareCoin: share,
      shareSymbol: '■AKITA',
      shareName: 'Akita Share',
      shareLabelVerified: true,
    })
    const shareOption = options.find((o) => o.address.toLowerCase() === share.toLowerCase())
    expect(shareOption?.symbol).toBe('■AKITA')
    expect(shareOption?.name).toBe('Akita Share')
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

  it('keeps explicit non-generic token labels stable when onchain metadata arrives', () => {
    const out = resolveTokenDisplay({
      option: {
        symbol: 'AKITA',
        name: 'Akita Share',
        address: '0x4444444444444444444444444444444444444444',
        group: 'share',
      },
      address: '0x4444444444444444444444444444444444444444',
      onchain: { name: 'Wrapped Akita Share', symbol: '■AKITA' },
      imageUrl: null,
    })
    expect(out.name).toBe('Akita Share')
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

  it('builds deterministic base token logo fallback chain', () => {
    const usdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    expect(tokenLogoFallbacks(usdc)).toEqual([
      uniswapBaseLogo(usdc),
      trustWalletBaseLogo(usdc),
      z0r0zBaseLogo(usdc),
    ])
  })

  it('includes logo fallback list in resolved token display', () => {
    const usdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const out = resolveTokenDisplay({
      option: {
        symbol: 'USDC',
        name: 'USD Coin',
        address: usdc,
        group: 'core',
        logoUrl: trustWalletBaseLogo(usdc),
      },
      address: usdc,
      onchain: null,
      imageUrl: null,
    })
    expect(out.logoUrl).toBe(trustWalletBaseLogo(usdc))
    expect(out.logoUrls?.[0]).toBe(trustWalletBaseLogo(usdc))
    expect(out.logoUrls).toContain(uniswapBaseLogo(usdc))
    expect(out.logoUrls).toContain(z0r0zBaseLogo(usdc))
  })
})

