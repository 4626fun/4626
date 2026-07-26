import { describe, expect, it } from 'vitest'

import { pickPrivyEmbeddedEoaWalletFromList } from './useSwapEmbeddedEoa'

const EMBEDDED = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9'
const ADMIN_EOA = '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'
const WALLET_ID = 'l8pocg69pnk3djdrp6t4lm0n'
const CANONICAL_CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5'

describe('pickPrivyEmbeddedEoaWalletFromList', () => {
  it('prefers the embedded wallet matching preferredAddresses over other embedded wallets', () => {
    const preferred = {
      id: WALLET_ID,
      address: EMBEDDED,
      walletClientType: 'privy',
    }
    const other = {
      id: 'other-embedded',
      address: '0x1111111111111111111111111111111111111111',
      walletClientType: 'privy',
    }
    expect(
      pickPrivyEmbeddedEoaWalletFromList({
        wallets: [other, preferred],
        preferredAddresses: [EMBEDDED],
      }),
    ).toBe(preferred)
  })

  it('never selects admin/session EOA even when it is the only preferred address match', () => {
    const adminExternal = {
      id: 'external-admin',
      address: ADMIN_EOA,
      walletClientType: 'metamask',
    }
    const embedded = {
      id: WALLET_ID,
      address: EMBEDDED,
      walletClientType: 'privy',
    }
    expect(
      pickPrivyEmbeddedEoaWalletFromList({
        wallets: [adminExternal, embedded],
        // Simulate stale session binding admin as "preferred" — must still pick embedded.
        preferredAddresses: [ADMIN_EOA, EMBEDDED],
      }),
    ).toBe(embedded)
  })

  it('returns null when only a non-embedded admin wallet matches authAddress-style preferred', () => {
    const adminExternal = {
      id: 'external-admin',
      address: ADMIN_EOA,
      walletClientType: 'metamask',
    }
    expect(
      pickPrivyEmbeddedEoaWalletFromList({
        wallets: [adminExternal],
        preferredAddresses: [ADMIN_EOA],
      }),
    ).toBeNull()
  })

  it('skips the canonical smart-wallet address even if typed as privy', () => {
    const csw = {
      id: 'csw',
      address: CANONICAL_CSW,
      walletClientType: 'privy',
    }
    const embedded = {
      id: WALLET_ID,
      address: EMBEDDED,
      walletClientType: 'privy',
    }
    expect(
      pickPrivyEmbeddedEoaWalletFromList({
        wallets: [csw, embedded],
        preferredAddresses: [EMBEDDED],
        canonicalAddress: CANONICAL_CSW,
      }),
    ).toBe(embedded)
  })

  it('returns the first embedded wallet when no preferred address is present', () => {
    const first = {
      id: 'first',
      address: '0x2222222222222222222222222222222222222222',
      wallet_client_type: 'privy',
    }
    const second = {
      id: WALLET_ID,
      address: EMBEDDED,
      walletClientType: 'embedded',
    }
    expect(
      pickPrivyEmbeddedEoaWalletFromList({
        wallets: [first, second],
        preferredAddresses: [],
      }),
    ).toBe(first)
  })
})
