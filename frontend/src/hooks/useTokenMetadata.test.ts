import { describe, expect, it } from 'vitest'

import { selectMetadataSourceUri } from './useTokenMetadata'

describe('selectMetadataSourceUri', () => {
  it('prefers tokenURI when both tokenURI and contractURI are present', () => {
    expect(
      selectMetadataSourceUri({
        tokenURI: '  https://metadata.example/token.json  ',
        contractURI: 'https://metadata.example/contract.json',
      }),
    ).toBe('https://metadata.example/token.json')
  })

  it('falls back to contractURI when tokenURI is missing', () => {
    expect(
      selectMetadataSourceUri({
        tokenURI: '   ',
        contractURI: ' https://api.4626.fun/v1/token/0xabc/metadata ',
      }),
    ).toBe('https://api.4626.fun/v1/token/0xabc/metadata')
  })

  it('returns null when both metadata URIs are missing', () => {
    expect(selectMetadataSourceUri({ tokenURI: null, contractURI: undefined })).toBeNull()
  })
})
