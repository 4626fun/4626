import type { AccountModePreference, SignerType } from './types'

export function resolveActiveAccount(params: {
  signerType: SignerType
  signerAddress?: `0x${string}`
  cswAddress?: `0x${string}`
  eoaIsOwnerOfCsw: boolean | null
  preferredMode: AccountModePreference | null
}): {
  activeAccount?: `0x${string}`
  activeAccountType: 'EOA' | 'SMART_WALLET' | 'UNKNOWN'
  canUseSmartWalletMode: boolean
} {
  if (!params.signerAddress) {
    return {
      activeAccount: undefined,
      activeAccountType: 'UNKNOWN',
      canUseSmartWalletMode: false,
    }
  }

  if (params.signerType === 'SMART_WALLET') {
    return {
      activeAccount: params.signerAddress,
      activeAccountType: 'SMART_WALLET',
      canUseSmartWalletMode: true,
    }
  }

  if (params.signerType === 'EOA') {
    const eoaCanUseCsw = Boolean(params.cswAddress && params.eoaIsOwnerOfCsw === true)
    const preferredSmart = params.preferredMode === 'SMART_WALLET'
    if (eoaCanUseCsw && preferredSmart) {
      return {
        activeAccount: params.cswAddress,
        activeAccountType: 'SMART_WALLET',
        canUseSmartWalletMode: true,
      }
    }
    return {
      activeAccount: params.signerAddress,
      activeAccountType: 'EOA',
      canUseSmartWalletMode: eoaCanUseCsw,
    }
  }

  return {
    activeAccount: params.signerAddress,
    activeAccountType: 'UNKNOWN',
    canUseSmartWalletMode: false,
  }
}

