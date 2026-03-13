import { describe, expect, it } from 'vitest'

import { normalizeDmGuardAddress, shouldBlockSelfDm } from './dmGuard'

describe('dmGuard', () => {
  it('normalizes valid EVM addresses to lowercase', () => {
    expect(normalizeDmGuardAddress('0xAbCdEfabcdefABCDEFabcdefabCDefAbcDefABCD')).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    )
  })

  it('returns null for invalid addresses', () => {
    expect(normalizeDmGuardAddress('not-an-address')).toBeNull()
  })

  it('allows self DM when peer equals identity', () => {
    expect(
      shouldBlockSelfDm({
        peerAddress: '0x1111111111111111111111111111111111111111',
        identityAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toBe(false)
  })

  it('does not block when peer differs from identity', () => {
    expect(
      shouldBlockSelfDm({
        peerAddress: '0x1111111111111111111111111111111111111111',
        identityAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false)
  })
})
