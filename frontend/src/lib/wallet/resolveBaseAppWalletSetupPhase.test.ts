import { describe, expect, it } from 'vitest'

import { resolveBaseAppWalletSetupPhase } from '@/lib/wallet/resolveBaseAppWalletSetupPhase'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const CSW = CANONICAL_CSW_ADDRESS
const EOA = '0x1111111111111111111111111111111111111111'

describe('resolveBaseAppWalletSetupPhase', () => {
  it('requires privy session and embedded EOA first', () => {
    expect(
      resolveBaseAppWalletSetupPhase({
        privyAuthenticated: false,
        embeddedEoaAddress: EOA,
        canonicalCswAddress: CSW,
        wallets: [],
      }),
    ).toBe('needs-privy-session')
  })

  it('requires canonical CSW on profile before wallet connect', () => {
    expect(
      resolveBaseAppWalletSetupPhase({
        privyAuthenticated: true,
        embeddedEoaAddress: EOA,
        canonicalCswAddress: null,
        wallets: [],
      }),
    ).toBe('needs-canonical-csw')
  })

  it('requires Base Account wallet to match canonical CSW', () => {
    expect(
      resolveBaseAppWalletSetupPhase({
        privyAuthenticated: true,
        embeddedEoaAddress: EOA,
        canonicalCswAddress: CSW,
        wallets: [{ address: '0x2222222222222222222222222222222222222222', walletClientType: 'base_account' }],
        providerAccounts: [],
      }),
    ).toBe('needs-base-wallet-connect')
  })

  it('requires owner install when wallet is connected but signing is not enabled', () => {
    expect(
      resolveBaseAppWalletSetupPhase({
        privyAuthenticated: true,
        embeddedEoaAddress: EOA,
        canonicalCswAddress: CSW,
        wallets: [{ address: CSW, walletClientType: 'base_account' }],
        providerAccounts: [CSW],
        parentEmbeddedOwnerOnChain: false,
        executionTrack: 'none-yet',
      }),
    ).toBe('needs-owner-install')
  })

  it('is ready when embedded owner is confirmed on-chain', () => {
    expect(
      resolveBaseAppWalletSetupPhase({
        privyAuthenticated: true,
        embeddedEoaAddress: EOA,
        canonicalCswAddress: CSW,
        wallets: [{ address: CSW, walletClientType: 'base_account' }],
        providerAccounts: [CSW],
        parentEmbeddedOwnerOnChain: true,
      }),
    ).toBe('ready')
  })
})
