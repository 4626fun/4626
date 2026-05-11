import { describe, expect, it } from 'vitest'

import { __testOnly } from './ethosCanonicalScores.js'

describe('ethosCanonicalScores helpers', () => {
  it('parses twitter identifiers into stable Ethos userkeys', () => {
    expect(__testOnly.parseTwitterUserkey('1234567890')).toMatchObject({
      userkey: 'service:x.com:1234567890',
      identityType: 'x_id',
    })
    expect(__testOnly.parseTwitterUserkey('@Akita')).toMatchObject({
      userkey: 'service:x.com:username:akita',
      identityType: 'x_username',
    })
  })

  it('derives address and social seeds with deterministic priorities', () => {
    const rows = __testOnly.deriveIdentitySeedsForProfile({
      canonicalUserId: 42,
      profilePrimaryWallet: '0x1111111111111111111111111111111111111111',
      profileEmbeddedEoa: '0x2222222222222222222222222222222222222222',
      profileCanonicalCsw: '0x3333333333333333333333333333333333333333',
      walletRows: [
        {
          address: '0x4444444444444444444444444444444444444444',
          is_primary: true,
          is_embedded_eoa: false,
          is_canonical_smart_wallet: false,
        },
      ],
      linkedMethodRows: [
        { type: 'twitter', value: '987654321' },
        { type: 'twitter', value: 'example_handle' },
        { type: 'farcaster', value: '13579' },
      ],
    })
    const byKey = new Map(rows.map((row) => [row.ethosUserkey, row]))
    expect(byKey.get('address:0x1111111111111111111111111111111111111111')?.priority).toBe(
      __testOnly.toIdentityPriority('address_external_eoa'),
    )
    expect(byKey.get('address:0x2222222222222222222222222222222222222222')?.priority).toBe(
      __testOnly.toIdentityPriority('address_embedded_eoa'),
    )
    expect(byKey.get('address:0x3333333333333333333333333333333333333333')?.priority).toBe(
      __testOnly.toIdentityPriority('address_canonical_smart_wallet'),
    )
    expect(byKey.get('service:x.com:987654321')?.identityType).toBe('x_id')
    expect(byKey.get('service:x.com:username:example_handle')?.identityType).toBe('x_username')
    expect(byKey.get('service:farcaster:13579')?.identityType).toBe('farcaster')
  })

  it('extracts updates payload userkeys and cursors', () => {
    const items = __testOnly.parseUpdateItems({
      updates: [
        { userkey: 'address:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', updatedAt: '2026-01-01T00:00:00.000Z' },
        { userKey: 'service:x.com:username:akita', createdAt: '2026-01-01T01:00:00.000Z' },
      ],
    })
    expect(items).toHaveLength(2)
    expect(__testOnly.extractUpdateUserkey(items[0]!)).toBe('address:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(__testOnly.extractUpdateUserkey(items[1]!)).toBe('service:x.com:username:akita')
    expect(__testOnly.extractUpdateCursor(items[0]!)).toBe('2026-01-01T00:00:00.000Z')
    expect(__testOnly.extractUpdateCursor(items[1]!)).toBe('2026-01-01T01:00:00.000Z')
  })
})
