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
}): { signerType: 'SCW' | 'EOA'; scwChainId: number } {
  if (params.isCanonicalSmartWallet) {
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  if (params.storedSignerType === 'SCW') {
    // If this identity was previously registered as SCW, keep it stable to
    // avoid XMTP "Wrong chain id" errors during identity updates.
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

  // Unknown on-chain code state: preserve the older heuristic that when the
  // wallet is on Base, the identity is *probably* a Base SCW.
  if (params.walletChainId === CANONICAL_SCW_CHAIN_ID) {
    return { signerType: 'SCW', scwChainId: CANONICAL_SCW_CHAIN_ID }
  }

  return { signerType: 'EOA', scwChainId: CANONICAL_SCW_CHAIN_ID }
}

