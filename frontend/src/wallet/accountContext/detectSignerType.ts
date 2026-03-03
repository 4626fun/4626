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
  if (params.hasContractCode === true) return 'SMART_WALLET'
  // Treat known-EOA bytecode checks as authoritative to avoid misclassifying
  // EOAs when capability probing returns noisy smart-wallet hints.
  if (params.hasContractCode === false) return 'EOA'
  if (hasSmartWalletCapability(params.capabilities)) return 'SMART_WALLET'
  return 'EOA'
}

