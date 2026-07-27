import { describe, expect, it } from 'vitest'

import { getTokenLogo, isBlockedTokenLogoUrl } from './tokenLogo'

describe('token logo known seeds', () => {
  it('prefers canonical ZORA logo seed for Base ZORA token address', () => {
    const lookup = getTokenLogo({
      address: '0x1111111111166b7FE7bd91427724B487980aFc69',
      chainId: 8453,
      group: 'core',
      symbol: 'ZORA',
    })

    expect(lookup.preferred).toBe('/brands/zora-token.svg')
  })
})

describe('isBlockedTokenLogoUrl', () => {
  it('allows first-party creator and share token image URLs', () => {
    expect(
      isBlockedTokenLogoUrl(
        '/api/v1/token/0x5b674196812451b7cec024fe9d22d2c0b172fa75/image?chain=8453&format=png&style=raw&tokenKind=creator',
      ),
    ).toBe(false)
    expect(
      isBlockedTokenLogoUrl(
        '/api/v1/token/0x4df30fffda1d4a81bcf4dc778292be8ff9752a57/image?chain=8453&format=png&style=raw&tokenKind=share',
      ),
    ).toBe(false)
  })

  it('still blocks placeholder and chrome mark URLs', () => {
    expect(isBlockedTokenLogoUrl('https://dd.dexscreener.com/ds-data/tokens/base/0xabc.png')).toBe(true)
    expect(isBlockedTokenLogoUrl('/assets/logo-mark.svg')).toBe(true)
    expect(isBlockedTokenLogoUrl('/base/base-chain-light.svg')).toBe(true)
    expect(isBlockedTokenLogoUrl('https://api.dexscreener.com/token-placeholder/x')).toBe(true)
  })

  it('uses an explicit first-party creator logo when provided', () => {
    const logoUrl =
      '/api/v1/token/0x5b674196812451b7cec024fe9d22d2c0b172fa75/image?chain=8453&format=png&style=raw&tokenKind=creator'
    const lookup = getTokenLogo({
      address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      group: 'creator',
      symbol: 'AKITA',
      logoUrl,
    })
    expect(lookup.preferred).toBe(logoUrl)
  })
})
