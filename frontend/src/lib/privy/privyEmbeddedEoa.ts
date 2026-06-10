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
  if (isPrivyServerManagedWallet(wallet)) return false

  const walletType = getWalletClientType(wallet)
  if (isSmartWalletLikeType(walletType)) return false
  if (walletType.includes('coinbase_smart_wallet') || walletType.includes('base_account')) return false
  if (!(walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded'))) return false

  return true
}

function parseWalletRecencyMs(wallet: WalletLike | null | undefined): number {
  const record = wallet as Record<string, unknown> | null | undefined
  if (!record || typeof record !== 'object') return 0
  const candidates = [
    record.connectedAt,
    record.connected_at,
    record.latestVerifiedAt,
    record.latest_verified_at,
    record.lastUsedAt,
    record.last_used_at,
    record.updatedAt,
    record.updated_at,
    record.createdAt,
    record.created_at,
  ]
  let best = 0
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const ms = candidate > 1_000_000_000_000 ? candidate : candidate * 1000
      if (ms > best) best = ms
      continue
    }
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate.trim())
      if (Number.isFinite(parsed) && parsed > best) best = parsed
    }
  }
  return best
}

export function isPrivyServerManagedWallet(wallet: WalletLike | null | undefined): boolean {
  const record = wallet as Record<string, unknown> | null | undefined
  if (!record || typeof record !== 'object') return false
  const policyIds = record.policy_ids ?? record.policyIds
  if (Array.isArray(policyIds) && policyIds.some((id) => typeof id === 'string' && id.trim())) {
    return true
  }
  return false
}

export function collectPrivySmartWalletAddressesFromWallets(
  wallets: readonly WalletLike[] | null | undefined,
): string[] {
  const candidates = Array.isArray(wallets) ? wallets : []
  const addresses: string[] = []
  for (const wallet of candidates) {
    const rawAddress = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
    if (!isAddressLike(rawAddress)) continue
    const walletType = getWalletClientType(wallet)
    if (!isSmartWalletLikeType(walletType) && !walletType.includes('coinbase_smart_wallet') && !walletType.includes('base_account')) {
      continue
    }
    addresses.push(rawAddress.toLowerCase())
  }
  return addresses
}

export function pickPrivyEmbeddedEoaWallet<T extends WalletLike>(
  wallets: readonly T[] | null | undefined,
  excludedWalletAddress?: string | null,
): T | null {
  const candidates = Array.isArray(wallets) ? wallets : []
  const excluded = new Set<string>()
  if (excludedWalletAddress) excluded.add(excludedWalletAddress.trim().toLowerCase())
  for (const smartWalletAddress of collectPrivySmartWalletAddressesFromWallets(candidates)) {
    excluded.add(smartWalletAddress)
  }

  const matches = candidates.filter((wallet) => {
    const rawAddress = typeof wallet?.address === 'string' ? String(wallet.address).trim().toLowerCase() : ''
    if (rawAddress && excluded.has(rawAddress)) return false
    return isEmbeddedPrivyEoaCandidate(wallet, excludedWalletAddress)
  })

  if (matches.length === 0) return null
  matches.sort((a, b) => parseWalletRecencyMs(b) - parseWalletRecencyMs(a))
  return matches[0] ?? null
}
