import { describe, expect, it } from 'vitest'

import { buildAccountZoraProfileSeeds, pickAccountZoraProfileSeed } from './zoraProfileIdentifier'

describe('account zora profile seeds', () => {
  const csw = '0x00000000000000000000000000000000000000aa'
  const embedded = '0x00000000000000000000000000000000000000bb'

  it('prefers CSW over embedded EOA for account-scoped lookups', () => {
    expect(
      pickAccountZoraProfileSeed({
        canonicalCswAddress: csw,
        embeddedEoaAddress: embedded,
        primaryWalletAddress: embedded,
      }),
    ).toBe(csw)
  })

  it('uses waitlist handle before wallet addresses', () => {
    expect(
      buildAccountZoraProfileSeeds({
        preprovZoraHandle: 'akita',
        canonicalCswAddress: csw,
        primaryWalletAddress: embedded,
      }),
    ).toEqual(['akita', csw, embedded])
  })
})
