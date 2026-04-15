type WalletLike = {
  address?: unknown
  wallet_client_type?: unknown
  walletClientType?: unknown
  connector_type?: unknown
  connectorType?: unknown
  type?: unknown
  provider?: unknown
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function getWalletClientType(wallet: WalletLike | null | undefined): string {
  return String(
    wallet?.wallet_client_type ??
      wallet?.walletClientType ??
      wallet?.connector_type ??
      wallet?.connectorType ??
      wallet?.type ??
      wallet?.provider ??
      '',
  )
    .trim()
    .toLowerCase()
}

export function isSmartWalletLikeType(walletType: string): boolean {
  const normalized = walletType.replace(/[\s_-]+/g, '')
  return normalized.includes('smartwallet') || normalized.includes('smartaccount')
}

export function isEmbeddedPrivyEoaCandidate(
  wallet: WalletLike | null | undefined,
  excludedWalletAddress?: string | null,
): boolean {
  const rawAddress = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
  if (!isAddressLike(rawAddress)) return false
  if (excludedWalletAddress && rawAddress.toLowerCase() === excludedWalletAddress.trim().toLowerCase()) return false

  const walletType = getWalletClientType(wallet)
  if (!(walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded'))) return false
  if (isSmartWalletLikeType(walletType)) return false

  return true
}

export function pickPrivyEmbeddedEoaWallet<T extends WalletLike>(
  wallets: readonly T[] | null | undefined,
  excludedWalletAddress?: string | null,
): T | null {
  const candidates = Array.isArray(wallets) ? wallets : []
  return candidates.find((wallet) => isEmbeddedPrivyEoaCandidate(wallet, excludedWalletAddress)) ?? null
}
