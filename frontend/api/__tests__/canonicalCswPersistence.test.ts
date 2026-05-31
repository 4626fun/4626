import { describe, expect, it } from 'vitest'

import {
  applyCanonicalCswPolicyToClassification,
  resolveStoredCanonicalCswAddress,
} from '../../server/_lib/wallet/canonicalCswPersistence.ts'
import { CANONICAL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.ts'

describe('resolveStoredCanonicalCswAddress', () => {
  it('maps allowed-owner embedded signers to the project canonical CSW', () => {
    expect(
      resolveStoredCanonicalCswAddress({
        candidate: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        embeddedEoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      }),
    ).toBe(CANONICAL_CSW_ADDRESS)
  })

  it('rejects allowed-owner EOAs when no qualifying signer is present', () => {
    expect(
      resolveStoredCanonicalCswAddress({
        candidate: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      }),
    ).toBeNull()
  })

  it('keeps unrelated deployed Base CSW addresses', () => {
    expect(
      resolveStoredCanonicalCswAddress({
        candidate: '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef',
        embeddedEoa: '0xb2aad65a5402714bf428a66731ae62ba5c45cac0',
      }),
    ).toBe('0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef')
  })
})

describe('applyCanonicalCswPolicyToClassification', () => {
  it('rewrites a misclassified owner EOA into the project CSW', () => {
    const next = applyCanonicalCswPolicyToClassification({
      embeddedEoa: {
        address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
        chainType: 'evm',
        clientType: 'privy',
      },
      activeOwnerWallet: null,
      canonicalSmartWallet: {
        address: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        provider: 'unknown',
      },
      canonicalSolanaWallet: null,
      operationalSolanaWallet: null,
      allWallets: [],
      primaryWalletAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
    })

    expect(next.canonicalSmartWallet?.address).toBe(CANONICAL_CSW_ADDRESS)
  })
})
