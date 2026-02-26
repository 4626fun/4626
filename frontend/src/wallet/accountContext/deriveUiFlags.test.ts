import { describe, expect, it } from 'vitest'

import { deriveAccountUiFlags } from './deriveUiFlags'

describe('deriveAccountUiFlags', () => {
  it('enables AA flags when smart-wallet mode and capabilities are available', () => {
    const flags = deriveAccountUiFlags({
      activeAccountType: 'SMART_WALLET',
      signerType: 'SMART_WALLET',
      cswAddress: '0x1111111111111111111111111111111111111111',
      eoaIsOwnerOfCsw: null,
      chainId: 8453,
      canUseSmartWalletMode: true,
      capabilities: {
        paymasterService: true,
        atomicStatus: 'ready',
        supports5792: true,
      },
    })

    expect(flags).toEqual({
      aaAvailable: true,
      paymasterAvailable: true,
      canUseSmartWalletMode: true,
      shouldPromptToLinkOwner: false,
      shouldShowNetworkMismatch: false,
    })
  })

  it('prompts EOA users to link only when CSW is known and ownership is false', () => {
    const missingCsw = deriveAccountUiFlags({
      activeAccountType: 'EOA',
      signerType: 'EOA',
      cswAddress: undefined,
      eoaIsOwnerOfCsw: null,
      chainId: 8453,
      canUseSmartWalletMode: false,
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })
    const notOwner = deriveAccountUiFlags({
      activeAccountType: 'EOA',
      signerType: 'EOA',
      cswAddress: '0x1111111111111111111111111111111111111111',
      eoaIsOwnerOfCsw: false,
      chainId: 8453,
      canUseSmartWalletMode: false,
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })

    expect(missingCsw.shouldPromptToLinkOwner).toBe(false)
    expect(notOwner.shouldPromptToLinkOwner).toBe(true)
  })

  it('shows network mismatch only for EOA with known CSW on wrong chain', () => {
    const flags = deriveAccountUiFlags({
      activeAccountType: 'EOA',
      signerType: 'EOA',
      cswAddress: '0x1111111111111111111111111111111111111111',
      eoaIsOwnerOfCsw: null,
      chainId: 1,
      expectedCswChainId: 8453,
      canUseSmartWalletMode: false,
      capabilities: {
        paymasterService: false,
        atomicStatus: 'unknown',
        supports5792: false,
      },
    })
    expect(flags.shouldShowNetworkMismatch).toBe(true)
  })
})

