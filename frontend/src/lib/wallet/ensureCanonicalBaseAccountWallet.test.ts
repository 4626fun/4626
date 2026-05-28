import { describe, expect, it } from 'vitest'

import {
  isCanonicalBaseAccountWalletReady,
  normalizeWalletAddress,
} from '@/lib/wallet/ensureCanonicalBaseAccountWallet'

const CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'

describe('ensureCanonicalBaseAccountWallet', () => {
  it('requires provider or privy wallet address to match canonical CSW', () => {
    const wallets = [
      {
        address: '0x1111111111111111111111111111111111111111',
        walletClientType: 'coinbase_wallet',
      },
    ]
    expect(
      isCanonicalBaseAccountWalletReady({
        wallets,
        canonicalCswAddress: CSW,
        providerAccounts: [],
      }),
    ).toBe(false)
    expect(
      isCanonicalBaseAccountWalletReady({
        wallets,
        canonicalCswAddress: CSW,
        providerAccounts: [CSW],
      }),
    ).toBe(true)
  })

  it('normalizes checksum addresses', () => {
    expect(normalizeWalletAddress(CSW)).toBe(CSW.toLowerCase())
  })
})
