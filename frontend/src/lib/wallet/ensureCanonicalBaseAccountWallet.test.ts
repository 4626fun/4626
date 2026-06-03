import { describe, expect, it } from 'vitest'

import {
  isCanonicalBaseAccountWalletReady,
  normalizeWalletAddress,
} from '@/lib/wallet/ensureCanonicalBaseAccountWallet'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const CSW = CANONICAL_CSW_ADDRESS

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
