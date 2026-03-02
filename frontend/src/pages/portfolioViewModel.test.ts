import { describe, expect, it } from 'vitest'

import { deriveCreatorCoinOptions, normalizeAddress, resolvePortfolioAddresses } from './portfolioViewModel'

describe('portfolioViewModel', () => {
  it('normalizes valid EVM addresses and rejects invalid values', () => {
    expect(normalizeAddress('0x000000000000000000000000000000000000cAFe')).toBe('0x000000000000000000000000000000000000cafe')
    expect(normalizeAddress('0x123')).toBeNull()
    expect(normalizeAddress('')).toBeNull()
  })

  it('resolves public mode from route address', () => {
    const result = resolvePortfolioAddresses({
      routeAddress: '0x0000000000000000000000000000000000001001',
      wagmiAddress: '0x0000000000000000000000000000000000002002',
      siweAuthAddress: '0x0000000000000000000000000000000000003003',
    })

    expect(result.isPublicMode).toBe(true)
    expect(result.publicAddress).toBe('0x0000000000000000000000000000000000001001')
    expect(result.effectiveAddress).toBe('0x0000000000000000000000000000000000001001')
  })

  it('uses connected wallet first and deduplicates creator coin options', () => {
    const result = resolvePortfolioAddresses({
      routeAddress: '',
      wagmiAddress: '0x0000000000000000000000000000000000002002',
      siweAuthAddress: '0x0000000000000000000000000000000000003003',
    })

    expect(result.isPublicMode).toBe(false)
    expect(result.publicAddress).toBeNull()
    expect(result.effectiveAddress).toBe('0x0000000000000000000000000000000000002002')

    expect(
      deriveCreatorCoinOptions([
        '0x000000000000000000000000000000000000AAAA',
        '0x000000000000000000000000000000000000aaaa',
        '0x000000000000000000000000000000000000bbbb',
        'invalid',
      ]),
    ).toEqual([
      '0x000000000000000000000000000000000000aaaa',
      '0x000000000000000000000000000000000000bbbb',
    ])
  })
})
