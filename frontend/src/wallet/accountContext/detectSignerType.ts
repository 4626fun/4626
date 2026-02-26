import type { AccountCapabilities, SignerType } from './types'

function hasSmartWalletCapability(capabilities: AccountCapabilities): boolean {
  if (capabilities.paymasterService) return true
  return capabilities.atomicStatus === 'supported' || capabilities.atomicStatus === 'ready'
}

export function detectSignerType(params: {
  signerAddress?: `0x${string}`
  capabilities: AccountCapabilities
  hasContractCode: boolean | null
}): SignerType {
  if (!params.signerAddress) return 'UNKNOWN'
  if (hasSmartWalletCapability(params.capabilities)) return 'SMART_WALLET'
  if (params.hasContractCode === true) return 'SMART_WALLET'
  return 'EOA'
}

