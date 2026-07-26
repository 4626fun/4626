import { describe, expect, it } from 'vitest'

import {
  assertPrivyWalletIdMatchesSignerAddress,
  isPrivyWalletSignerMismatchError,
  normalizePrivySignerAddress,
  PRIVY_WALLET_SIGNER_MISMATCH_MESSAGE,
  resolveEmbeddedVsBaseAppSigningLane,
} from '@/lib/privy/privyWalletSignerMatch'

const EMBEDDED = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9'
const ADMIN_EOA = '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'
const WALLET_ID = 'l8pocg69pnk3djdrp6t4lm0n'

describe('normalizePrivySignerAddress', () => {
  it('normalizes checksum addresses', () => {
    expect(normalizePrivySignerAddress('0xCeCa13F2686Ed061C57620Ecdf67E1b8C0F285E9')).toBe(EMBEDDED)
  })

  it('rejects non-addresses', () => {
    expect(normalizePrivySignerAddress('not-an-address')).toBeNull()
  })
})

describe('resolveEmbeddedVsBaseAppSigningLane', () => {
  it('prefers connected Base App direct over track string', () => {
    expect(
      resolveEmbeddedVsBaseAppSigningLane({
        executionTrack: 'legacy-owner-install',
        baseAppDirectConnected: true,
      }),
    ).toBe('base-app-direct')
  })

  it('maps execution tracks', () => {
    expect(resolveEmbeddedVsBaseAppSigningLane({ executionTrack: 'base-app-direct' })).toBe('base-app-direct')
    expect(resolveEmbeddedVsBaseAppSigningLane({ executionTrack: 'legacy-owner-install' })).toBe(
      'legacy-embedded',
    )
    expect(resolveEmbeddedVsBaseAppSigningLane({ executionTrack: 'none-yet' })).toBe('unknown')
  })
})

describe('assertPrivyWalletIdMatchesSignerAddress', () => {
  it('allows matching wallet id and signer', () => {
    expect(() =>
      assertPrivyWalletIdMatchesSignerAddress({
        walletId: WALLET_ID,
        walletAddress: EMBEDDED,
        expectedSignerAddress: EMBEDDED,
      }),
    ).not.toThrow()
  })

  it('fails closed on l8pocg69-style wallet bound to admin EOA 0xb05cf', () => {
    expect(() =>
      assertPrivyWalletIdMatchesSignerAddress({
        walletId: WALLET_ID,
        walletAddress: EMBEDDED,
        expectedSignerAddress: ADMIN_EOA,
      }),
    ).toThrow(PRIVY_WALLET_SIGNER_MISMATCH_MESSAGE)
  })

  it('allows missing wallet address when expected signer is valid', () => {
    expect(() =>
      assertPrivyWalletIdMatchesSignerAddress({
        walletId: WALLET_ID,
        walletAddress: null,
        expectedSignerAddress: EMBEDDED,
      }),
    ).not.toThrow()
  })
})

describe('isPrivyWalletSignerMismatchError', () => {
  it('matches the fail-closed message', () => {
    expect(isPrivyWalletSignerMismatchError(PRIVY_WALLET_SIGNER_MISMATCH_MESSAGE)).toBe(true)
  })
})
