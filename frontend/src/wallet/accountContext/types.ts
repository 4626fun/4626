export type SignerType = 'EOA' | 'SMART_WALLET' | 'UNKNOWN'

export type AccountModePreference = 'EOA' | 'SMART_WALLET'

export type AtomicStatus = 'supported' | 'ready' | 'unsupported' | 'unknown'

export type AccountCapabilities = {
  paymasterService: boolean
  atomicStatus: AtomicStatus
  supports5792: boolean
}

export type AccountUiFlags = {
  aaAvailable: boolean
  paymasterAvailable: boolean
  canUseSmartWalletMode: boolean
  shouldPromptToLinkOwner: boolean
  shouldShowNetworkMismatch: boolean
}

export type ResolvedAccountContext = {
  chainId: number | null
  chainIdHex: `0x${string}` | null
  signerAddress?: `0x${string}`
  signerType: SignerType
  cswAddress?: `0x${string}`
  eoaIsOwnerOfCsw: boolean | null
  activeAccount?: `0x${string}`
  activeAccountType: 'EOA' | 'SMART_WALLET' | 'UNKNOWN'
  capabilities: AccountCapabilities
  uiFlags: AccountUiFlags
}

