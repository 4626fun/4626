export type WalletType = 'embedded_eoa' | 'external_eoa' | 'smart_wallet'
export type WalletProvider =
  | 'privy'
  | 'coinbase_wallet'
  | 'metamask'
  | 'rabby'
  | 'walletconnect'
  | 'unknown'

export type MappedWallet = {
  address: string
  walletType: WalletType
  provider: WalletProvider
  chain: string
  clientType: string | null
}

export type ClassifiedLinkedAccounts = {
  embeddedEoa: { address: string; chainType: string; clientType: string | null } | null
  activeOwnerWallet: { address: string; provider: WalletProvider; walletType: WalletType } | null
  canonicalSmartWallet: { address: string; provider: WalletProvider } | null
  canonicalSolanaWallet: { address: string; provider: WalletProvider } | null
  operationalSolanaWallet: { address: string; provider: WalletProvider } | null
  allWallets: MappedWallet[]
  primaryWalletAddress: string | null
}

export type PrivyUserLike = {
  id?: string
  wallet?: unknown
  wallets?: unknown
  linkedAccounts?: unknown
  linked_accounts?: unknown
}

type WalletRecordSource = 'smart' | 'embedded' | 'other'

type TaggedWalletRecord = {
  raw: any
  source: WalletRecordSource
}

function nestedSmartWalletEntries(raw: any): any[] {
  return Array.isArray(raw?.smartWallets)
    ? raw.smartWallets
    : Array.isArray(raw?.smart_wallets)
      ? raw.smart_wallets
      : []
}

function nestedEmbeddedWalletEntries(raw: any): any[] {
  return Array.isArray(raw?.embeddedWallets)
    ? raw.embeddedWallets
    : Array.isArray(raw?.embedded_wallets)
      ? raw.embedded_wallets
      : []
}

function isSmartWalletLikeRecord(raw: any): boolean {
  const rawType = normalizeLower(raw?.type)
  if (rawType === 'smart_wallet') return true
  const clientType = extractClientType(raw)
  if (isBaseAccountClientType(rawType) || isBaseAccountClientType(clientType)) return true
  const normalizedClient = clientType.replace(/[\s_-]+/g, '')
  return (
    normalizedClient.includes('smartwallet') ||
    normalizedClient.includes('smartaccount') ||
    clientType.includes('coinbase_smart_wallet')
  )
}

function isEmbeddedWalletLikeRecord(raw: any): boolean {
  if (isSmartWalletLikeRecord(raw)) return false
  const clientType = extractClientType(raw)
  if (clientType.includes('embedded_privy') || clientType === 'embedded_eoa') return true
  if (clientType === 'privy' || clientType.includes('embedded')) return true
  return false
}

function iterTaggedWalletRecords(user: PrivyUserLike): TaggedWalletRecord[] {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const linkedAccountsSnake = Array.isArray(user?.linked_accounts) ? user.linked_accounts : []
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const tagged: TaggedWalletRecord[] = []

  for (const raw of [...primaryWallet, ...wallets, ...linkedAccounts, ...linkedAccountsSnake]) {
    tagged.push({ raw, source: 'other' })
  }

  for (const parent of [...linkedAccounts, ...linkedAccountsSnake]) {
    for (const raw of nestedSmartWalletEntries(parent)) {
      tagged.push({ raw, source: 'smart' })
    }
    for (const raw of nestedEmbeddedWalletEntries(parent)) {
      tagged.push({ raw, source: 'embedded' })
    }
  }

  return tagged
}

export function collectPrivySmartWalletAddresses(user: PrivyUserLike): Set<string> {
  const addresses = new Set<string>()
  for (const { raw, source } of iterTaggedWalletRecords(user)) {
    if (source !== 'smart' && !isSmartWalletLikeRecord(raw)) continue
    const address = normalizeEvmAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
    if (address) addresses.add(address)
  }
  return addresses
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Privy React `connectedAt` is epoch ms; treat small values as seconds.
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Date.parse(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractWalletRecencyMs(raw: any): number {
  const candidates = [
    raw?.latest_verified_at,
    raw?.latestVerifiedAt,
    raw?.last_used_at,
    raw?.lastUsedAt,
    raw?.connected_at,
    raw?.connectedAt,
    raw?.verified_at,
    raw?.verifiedAt,
    raw?.updated_at,
    raw?.updatedAt,
    raw?.created_at,
    raw?.createdAt,
  ]
  let best = 0
  for (const candidate of candidates) {
    const ms = parseTimestampMs(candidate)
    if (ms !== null && ms > best) best = ms
  }
  return best
}

function readConfiguredPrivyWalletOwnerId(): string | null {
  const raw = typeof process !== 'undefined' ? String(process.env?.PRIVY_WALLET_OWNER_ID ?? '').trim() : ''
  return raw ? raw.toLowerCase() : null
}

export function isPrivyServerManagedWalletRecord(raw: any): boolean {
  const policyIds = raw?.policy_ids ?? raw?.policyIds
  if (Array.isArray(policyIds) && policyIds.some((id) => typeof id === 'string' && id.trim())) {
    return true
  }
  const ownerId = normalizeLower(raw?.owner_id ?? raw?.ownerId)
  const configuredOwnerId = readConfiguredPrivyWalletOwnerId()
  if (ownerId && configuredOwnerId && ownerId === configuredOwnerId) return true
  return false
}

export function collectPrivyServerManagedWalletAddresses(user: PrivyUserLike): Set<string> {
  const addresses = new Set<string>()
  for (const { raw } of iterTaggedWalletRecords(user)) {
    if (!isPrivyServerManagedWalletRecord(raw)) continue
    const address = normalizeEvmAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
    if (address) addresses.add(address)
  }
  return addresses
}

type EmbeddedEoaCandidate = {
  address: string
  source: WalletRecordSource
  recencyMs: number
}

function collectEmbeddedEoaCandidates(user: PrivyUserLike): EmbeddedEoaCandidate[] {
  const smartWalletAddresses = collectPrivySmartWalletAddresses(user)
  const serverManagedAddresses = collectPrivyServerManagedWalletAddresses(user)
  const byAddress = new Map<string, EmbeddedEoaCandidate>()

  for (const { raw, source } of iterTaggedWalletRecords(user)) {
    if (source === 'smart' || isSmartWalletLikeRecord(raw) || isPrivyServerManagedWalletRecord(raw)) continue
    if (source !== 'embedded' && !isEmbeddedWalletLikeRecord(raw)) continue
    const address = normalizeEvmAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
    if (!address || smartWalletAddresses.has(address) || serverManagedAddresses.has(address)) continue

    const recencyMs = extractWalletRecencyMs(raw)
    const rank = (value: WalletRecordSource): number => (value === 'embedded' ? 2 : value === 'other' ? 1 : 0)
    const next: EmbeddedEoaCandidate = { address, source, recencyMs }
    const current = byAddress.get(address)
    if (!current) {
      byAddress.set(address, next)
      continue
    }
    if (recencyMs > current.recencyMs) {
      byAddress.set(address, { ...next, source: rank(source) >= rank(current.source) ? source : current.source })
      continue
    }
    if (recencyMs === current.recencyMs && rank(source) > rank(current.source)) {
      byAddress.set(address, next)
    }
  }

  return Array.from(byAddress.values())
}

export function extractPrivyEmbeddedEoaAddress(user: PrivyUserLike): string | null {
  const candidates = collectEmbeddedEoaCandidates(user)
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.recencyMs !== a.recencyMs) return b.recencyMs - a.recencyMs
    const rank = (value: WalletRecordSource): number => (value === 'embedded' ? 2 : value === 'other' ? 1 : 0)
    return rank(b.source) - rank(a.source)
  })

  return candidates[0]?.address ?? null
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function normalizeSolanaAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (raw.length < 32 || raw.length > 44) return null
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(raw)) return null
  return raw
}

function isEvmChain(raw: string): boolean {
  if (!raw) return true
  return raw.includes('eth') || raw.includes('evm') || raw.includes('base')
}

function isSolanaChain(raw: string): boolean {
  return raw.includes('solana')
}

function inferProvider(clientType: string): WalletProvider {
  if (!clientType) return 'unknown'
  if (clientType.includes('privy') || clientType.includes('embedded')) return 'privy'
  if (clientType.includes('coinbase')) return 'coinbase_wallet'
  if (clientType.includes('rabby')) return 'rabby'
  if (clientType.includes('metamask')) return 'metamask'
  if (clientType.includes('walletconnect') || clientType.includes('wallet_connect') || clientType === 'wc') return 'walletconnect'
  return 'unknown'
}

function isBaseAccountClientType(value: string): boolean {
  return (
    value.includes('base_account') ||
    value.includes('coinbase_smart_wallet') ||
    value === 'coinbase_wallet'
  )
}

function extractClientType(raw: any): string {
  const fromFields = normalizeLower(
    raw?.walletClientType ??
      raw?.wallet_client_type ??
      raw?.walletType ??
      raw?.wallet_type ??
      raw?.connectorType ??
      raw?.connector_type ??
      raw?.clientType ??
      raw?.client_type ??
      raw?.provider,
  )
  if (fromFields) return fromFields

  // Privy Base Account login can surface connector identity on `type` instead of
  // `walletClientType` (for example `{ type: "base_account", address: "0x…" }`).
  const rawType = normalizeLower(raw?.type)
  if (isBaseAccountClientType(rawType)) return rawType
  return ''
}

function getWalletType(rawType: string, clientType: string, source: WalletRecordSource = 'other'): WalletType {
  if (source === 'smart') return 'smart_wallet'
  if (rawType === 'smart_wallet') return 'smart_wallet'
  if (isBaseAccountClientType(rawType) || isBaseAccountClientType(clientType)) return 'smart_wallet'
  const normalizedClient = clientType.replace(/[\s_-]+/g, '')
  if (
    normalizedClient.includes('smartwallet') ||
    normalizedClient.includes('smartaccount') ||
    clientType.includes('coinbase_smart_wallet')
  ) {
    return 'smart_wallet'
  }
  if (source === 'embedded') return 'embedded_eoa'
  if (clientType.includes('privy') || clientType.includes('embedded')) return 'embedded_eoa'
  return 'external_eoa'
}

function toWalletRecord(raw: any, source: WalletRecordSource = 'other'): MappedWallet | null {
  const chainType = normalizeLower(raw?.chainType ?? raw?.chain_type ?? raw?.chain ?? raw?.network)
  const solanaChain = isSolanaChain(chainType)
  if (!solanaChain && !isEvmChain(chainType)) return null

  const address = solanaChain
    ? normalizeSolanaAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
    : normalizeEvmAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
  if (!address) return null

  const rawType = normalizeLower(raw?.type)
  const clientType = extractClientType(raw)
  const walletType = solanaChain
    ? (clientType.includes('privy') || clientType.includes('embedded') ? 'embedded_eoa' : 'external_eoa')
    : getWalletType(rawType, clientType, source)
  const provider = inferProvider(clientType)

  return {
    address,
    walletType,
    provider,
    chain: solanaChain ? 'solana' : 'evm',
    clientType: clientType || null,
  }
}

function isCanonicalSmartWalletCandidate(wallet: MappedWallet): boolean {
  if (wallet.chain !== 'evm') return false
  if (wallet.walletType !== 'smart_wallet') return false
  const clientType = normalizeLower(wallet.clientType)
  if (wallet.provider === 'privy') return false
  if (clientType.includes('privy') || clientType.includes('embedded')) return false
  return true
}

export function classifyLinkedAccounts(user: PrivyUserLike): ClassifiedLinkedAccounts {
  const smartWalletAddresses = collectPrivySmartWalletAddresses(user)
  const mappedRaw: Array<MappedWallet & { rawType: string; source: WalletRecordSource }> = []

  for (const { raw, source } of iterTaggedWalletRecords(user)) {
    const record = toWalletRecord(raw as any, source)
    if (!record) continue
    const rawType = normalizeLower((raw as any)?.type)
    mappedRaw.push({ ...record, rawType, source })
  }

  // Deduplicate by address, preferring richer records:
  // smart_wallet > embedded_eoa > external_eoa.
  const rank = (walletType: WalletType): number => (walletType === 'smart_wallet' ? 3 : walletType === 'embedded_eoa' ? 2 : 1)
  const byAddress = new Map<string, MappedWallet & { rawType: string; source: WalletRecordSource }>()
  for (const wallet of mappedRaw) {
    const normalizedAddress = normalizeLower(wallet.address)
    if (smartWalletAddresses.has(normalizedAddress)) {
      wallet.walletType = 'smart_wallet'
    }
    const current = byAddress.get(wallet.address)
    if (!current || rank(wallet.walletType) > rank(current.walletType)) {
      byAddress.set(wallet.address, wallet)
      continue
    }
    // Prefer a known provider/clientType over unknown.
    if (current.provider === 'unknown' && wallet.provider !== 'unknown') {
      byAddress.set(wallet.address, wallet)
    }
  }
  const allWallets = Array.from(byAddress.values()).map((w) => ({
    address: w.address,
    walletType: w.walletType,
    provider: w.provider,
    chain: w.chain,
    clientType: w.clientType,
  }))

  const canonicalCandidates = mappedRaw.filter((w) => isCanonicalSmartWalletCandidate(w))

  let canonicalSmartWallet: { address: string; provider: WalletProvider } | null = null
  const typedSmartWallet = canonicalCandidates.find((w) => w.rawType === 'smart_wallet')
  if (typedSmartWallet) {
    canonicalSmartWallet = { address: typedSmartWallet.address, provider: typedSmartWallet.provider }
  } else {
    const clientSmartWallet = canonicalCandidates.find(
      (w) => (w.clientType || '').includes('base_account') || (w.clientType || '').includes('coinbase_smart_wallet'),
    )
    if (clientSmartWallet) canonicalSmartWallet = { address: clientSmartWallet.address, provider: clientSmartWallet.provider }
  }

  const extractedEmbeddedAddress = extractPrivyEmbeddedEoaAddress(user)
  const serverManagedAddresses = collectPrivyServerManagedWalletAddresses(user)
  const embeddedFromAllWallets =
    allWallets.find(
      (w) =>
        w.chain === 'evm' &&
        w.walletType === 'embedded_eoa' &&
        !smartWalletAddresses.has(normalizeLower(w.address)) &&
        !serverManagedAddresses.has(normalizeLower(w.address)),
    ) ?? null
  const embeddedAddress = extractedEmbeddedAddress ?? embeddedFromAllWallets?.address ?? null
  const embeddedEoa = embeddedAddress
    ? {
        address: embeddedAddress,
        chainType: embeddedFromAllWallets?.chain ?? 'evm',
        clientType: embeddedFromAllWallets?.clientType ?? null,
      }
    : null
  const activeOwner = allWallets.find((w) => w.chain === 'evm' && w.walletType !== 'smart_wallet') ?? null
  const activeOwnerWallet = activeOwner
    ? {
        address: activeOwner.address,
        provider: activeOwner.provider,
        walletType: activeOwner.walletType,
      }
    : null

  const solanaWallets = allWallets.filter((w) => w.chain === 'solana')
  const externalSolana = solanaWallets.find((w) => w.walletType === 'external_eoa') ?? null
  const embeddedSolana = solanaWallets.find((w) => w.walletType === 'embedded_eoa') ?? null
  const canonicalSolanaWallet = externalSolana
    ? { address: externalSolana.address, provider: externalSolana.provider }
    : embeddedSolana
      ? { address: embeddedSolana.address, provider: embeddedSolana.provider }
      : null
  const operationalSolanaWallet =
    embeddedSolana && (!canonicalSolanaWallet || normalizeLower(embeddedSolana.address) !== normalizeLower(canonicalSolanaWallet.address))
      ? { address: embeddedSolana.address, provider: embeddedSolana.provider }
      : null

  const primaryWalletAddress =
    canonicalSmartWallet?.address ??
    embeddedEoa?.address ??
    allWallets.find((w) => w.walletType === 'external_eoa' && w.chain === 'evm')?.address ??
    allWallets.find((w) => w.chain === 'evm')?.address ??
    null

  return {
    embeddedEoa,
    activeOwnerWallet,
    canonicalSmartWallet,
    canonicalSolanaWallet,
    operationalSolanaWallet,
    allWallets,
    primaryWalletAddress,
  }
}
