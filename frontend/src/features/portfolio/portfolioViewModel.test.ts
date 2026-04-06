import { describe, expect, it } from 'vitest'

import { buildPortfolioImageProxyUrl, deriveCreatorCoinOptions, normalizeAddress, resolvePortfolioAddresses } from '@/features/portfolio/portfolioViewModel'

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

  it('builds a first-party proxy URL for remote token images', () => {
    expect(buildPortfolioImageProxyUrl('https://cdn.example.com/token.png')).toBe(
      '/api/image/external?url=https%3A%2F%2Fcdn.example.com%2Ftoken.png',
    )
    expect(buildPortfolioImageProxyUrl('http://assets.example.com/logo.webp')).toBe(
      '/api/image/external?url=http%3A%2F%2Fassets.example.com%2Flogo.webp',
    )
  })

  it('rejects unsafe image URLs', () => {
    expect(buildPortfolioImageProxyUrl('')).toBeNull()
    expect(buildPortfolioImageProxyUrl('not-a-url')).toBeNull()
    expect(buildPortfolioImageProxyUrl('data:image/png;base64,AAA=')).toBeNull()
    expect(buildPortfolioImageProxyUrl('https://localhost/logo.png')).toBeNull()
    expect(buildPortfolioImageProxyUrl('http://127.0.0.1/logo.png')).toBeNull()
    expect(buildPortfolioImageProxyUrl('http://10.0.0.5/logo.png')).toBeNull()
  })
})
