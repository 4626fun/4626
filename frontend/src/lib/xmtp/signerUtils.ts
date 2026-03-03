export type StoredSignerType = 'SCW' | 'EOA' | null

export const CANONICAL_SCW_CHAIN_ID = 8453 // Base mainnet

export function resolveXmtpChainId(walletChainId: unknown): number {
  // XMTP SCW identities are registered against a specific EVM chain.
  // Some wallets briefly report chain id `0` during hydration/reconnect;
  // treat non-positive/non-finite values as unknown and default to Base.
  if (typeof walletChainId !== 'number' || !Number.isFinite(walletChainId) || walletChainId <= 0) {
    return CANONICAL_SCW_CHAIN_ID
  }
  return Math.floor(walletChainId)
}

export function isCoinbaseWalletConnector(connector: unknown): boolean {
  const c = (connector ?? {}) as any
  const id = String(c?.id ?? '').trim().toLowerCase()
  const name = String(c?.name ?? '').trim().toLowerCase()
  // We treat Coinbase Wallet connector as SCW because our wagmi config pins it
  // to `preference: 'smartWalletOnly'`.
  return id.includes('coinbase') || name.includes('coinbase')
}

export function decideXmtpSignerType(params: {
  isCanonicalSmartWallet: boolean
  storedSignerType: StoredSignerType
  connector?: unknown
  /**
   * Whether the identity address has contract code on-chain.
   * - true: definitely a contract
   * - false: definitely no code
   * - null: unknown (RPC error / unsupported)
   */
  hasContractCode: boolean | null
  /** Sanitized chain id of the connected wallet (defaults applied). */
  walletChainId: number
  modeOverride?: 'EOA' | 'SMART_WALLET'
}): { signerType: 'SCW' | 'EOA'; scwChainId: number } {
  if (params.modeOverride === 'EOA') {
    return { signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  const resolvedSmartWalletContract = params.isCanonicalSmartWallet || params.hasContractCode === true

  if (params.modeOverride === 'SMART_WALLET') {
    if (!resolvedSmartWalletContract) {
      return { signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID }
    }
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (params.isCanonicalSmartWallet) {
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (params.storedSignerType === 'SCW') {
    // If this identity was previously registered as SCW, keep it stable to
    // avoid XMTP "Wrong chain id" errors during identity updates/revocations.
    // EOA signer does not pass chain id; API receives 0 and rejects.
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (isCoinbaseWalletConnector(params.connector)) {
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (params.hasContractCode === true) {
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (params.hasContractCode === false) {
    return { signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  // Unknown on-chain code state: default to EOA to avoid misclassifying EOAs
  // as SCWs. If this identity was actually SCW, provider.tsx retries with SCW
  // when XMTP returns an explicit "Wrong chain id" signal.
  return { signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID }
}

