import { describe, expect, it } from 'vitest'

import { getTokenLogo } from './tokenLogo'

describe('token logo known seeds', () => {
  it('prefers canonical ZORA logo seed for Base ZORA token address', () => {
    const lookup = getTokenLogo({
      address: '0x4200000000000000000000000000000000000777',
      chainId: 8453,
      group: 'core',
      symbol: 'ZORA',
    })

    expect(lookup.preferred).toBe('/brands/zora-token.svg')
  })
})

