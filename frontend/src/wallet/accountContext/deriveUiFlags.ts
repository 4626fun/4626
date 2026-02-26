import type { AccountCapabilities, AccountUiFlags, SignerType } from './types'

export function deriveAccountUiFlags(params: {
  activeAccountType: 'EOA' | 'SMART_WALLET' | 'UNKNOWN'
  signerType: SignerType
  cswAddress?: `0x${string}`
  eoaIsOwnerOfCsw: boolean | null
  chainId: number | null
  expectedCswChainId?: number
  canUseSmartWalletMode: boolean
  capabilities: AccountCapabilities
}): AccountUiFlags {
  const expectedChainId = params.expectedCswChainId ?? 8453
  const isSmartActive = params.activeAccountType === 'SMART_WALLET'
  const atomicReady =
    params.capabilities.atomicStatus === 'supported' || params.capabilities.atomicStatus === 'ready'

  return {
    aaAvailable: isSmartActive && (params.capabilities.paymasterService || atomicReady),
    paymasterAvailable: isSmartActive && params.capabilities.paymasterService,
    canUseSmartWalletMode: params.canUseSmartWalletMode,
    shouldPromptToLinkOwner:
      params.signerType === 'EOA' && Boolean(params.cswAddress) && params.eoaIsOwnerOfCsw === false,
    shouldShowNetworkMismatch:
      params.signerType === 'EOA' && Boolean(params.cswAddress) && params.chainId !== expectedChainId,
  }
}

