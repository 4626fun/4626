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

function nestedWalletEntries(raw: any): any[] {
  const smartWallets = Array.isArray(raw?.smartWallets)
    ? raw.smartWallets
    : Array.isArray(raw?.smart_wallets)
      ? raw.smart_wallets
      : []
  const embeddedWallets = Array.isArray(raw?.embeddedWallets)
    ? raw.embeddedWallets
    : Array.isArray(raw?.embedded_wallets)
      ? raw.embedded_wallets
      : []
  return [...smartWallets, ...embeddedWallets]
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

function extractClientType(raw: any): string {
  return normalizeLower(
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
}

function getWalletType(rawType: string, clientType: string): WalletType {
  if (rawType === 'smart_wallet') return 'smart_wallet'
  if (clientType.includes('base_account') || clientType.includes('coinbase_smart_wallet')) return 'smart_wallet'
  if (clientType.includes('privy') || clientType.includes('embedded')) return 'embedded_eoa'
  return 'external_eoa'
}

function toWalletRecord(raw: any): MappedWallet | null {
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
    : getWalletType(rawType, clientType)
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
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const linkedAccountsSnake = Array.isArray(user?.linked_accounts) ? user.linked_accounts : []
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const nestedLinkedWallets = [...linkedAccounts, ...linkedAccountsSnake].flatMap((raw) => nestedWalletEntries(raw))
  const allRaw = [...primaryWallet, ...wallets, ...linkedAccounts, ...linkedAccountsSnake, ...nestedLinkedWallets]
  const mappedRaw: Array<MappedWallet & { rawType: string }> = []

  for (const raw of allRaw) {
    const record = toWalletRecord(raw as any)
    if (!record) continue
    const rawType = normalizeLower((raw as any)?.type)
    mappedRaw.push({ ...record, rawType })
  }

  // Deduplicate by address, preferring richer records:
  // smart_wallet > embedded_eoa > external_eoa.
  const rank = (walletType: WalletType): number => (walletType === 'smart_wallet' ? 3 : walletType === 'embedded_eoa' ? 2 : 1)
  const byAddress = new Map<string, MappedWallet & { rawType: string }>()
  for (const wallet of mappedRaw) {
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

  const embedded = allWallets.find((w) => w.walletType === 'embedded_eoa' && w.chain === 'evm') ?? null
  const embeddedEoa = embedded
    ? { address: embedded.address, chainType: embedded.chain, clientType: embedded.clientType }
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
