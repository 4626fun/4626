import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCreateWallet, usePrivy } from '@privy-io/react-auth'
import { getAddress, isAddress, type Address } from 'viem'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizePrivyText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeAddressOrNull(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function isEmbeddedEthereumWalletRecord(value: unknown): value is { address?: unknown } {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!record) return false
  const chainType = normalizePrivyText(record.chain_type ?? record.chainType)
  if (chainType.includes('solana')) return false
  const walletClientType = normalizePrivyText(
    record.wallet_client_type ?? record.walletClientType ?? record.connector_type ?? record.connectorType ?? record.type ?? record.provider,
  )
  return walletClientType === 'privy' || walletClientType.includes('embedded') || walletClientType.includes('privy')
}

function normalizedWalletRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function walletDedupKey(record: Record<string, unknown>): string {
  const address = normalizeAddressOrNull(record.address)?.toLowerCase() ?? ''
  const chainType = normalizePrivyText(record.chain_type ?? record.chainType ?? '')
  const walletClientType = normalizePrivyText(
    record.wallet_client_type ?? record.walletClientType ?? record.connector_type ?? record.connectorType ?? '',
  )
  const type = normalizePrivyText(record.type ?? record.provider ?? '')
  return `${address}|${chainType}|${walletClientType}|${type}`
}

function pushWalletRecord(params: {
  target: Record<string, unknown>[]
  seen: Set<string>
  value: unknown
  defaults?: Record<string, unknown>
}) {
  const record = normalizedWalletRecord(params.value)
  if (!record) return
  const merged = params.defaults ? { ...params.defaults, ...record } : record
  const key = walletDedupKey(merged)
  if (params.seen.has(key)) return
  params.seen.add(key)
  params.target.push(merged)
}

export function extractPrivyWalletsFromUser(user: unknown): Record<string, unknown>[] {
  const record = normalizedWalletRecord(user)
  if (!record) return []

  const wallets: Record<string, unknown>[] = []
  const seen = new Set<string>()

  pushWalletRecord({ target: wallets, seen, value: record.wallet })
  if (Array.isArray(record.wallets)) {
    for (const wallet of record.wallets) {
      pushWalletRecord({ target: wallets, seen, value: wallet })
    }
  }

  const linkedAccounts = Array.isArray(record.linkedAccounts)
    ? record.linkedAccounts
    : Array.isArray(record.linked_accounts)
      ? record.linked_accounts
      : []
  for (const account of linkedAccounts) {
    const linkedRecord = normalizedWalletRecord(account)
    if (!linkedRecord) continue

    const linkedType = normalizePrivyText(linkedRecord.type)
    if (linkedType.includes('wallet') || linkedType === 'cross_app' || linkedRecord.address) {
      pushWalletRecord({ target: wallets, seen, value: linkedRecord })
    }

    const embeddedWallets = Array.isArray(linkedRecord.embeddedWallets)
      ? linkedRecord.embeddedWallets
      : Array.isArray(linkedRecord.embedded_wallets)
        ? linkedRecord.embedded_wallets
        : []
    for (const embeddedWallet of embeddedWallets) {
      pushWalletRecord({
        target: wallets,
        seen,
        value: embeddedWallet,
        defaults: {
          type: 'wallet',
          wallet_client_type: 'privy',
          chain_type: 'ethereum',
        },
      })
    }
  }

  return wallets
}

function isSmartWalletLikeRecord(value: unknown): boolean {
  const record = normalizedWalletRecord(value)
  if (!record) return false
  const rawType = normalizePrivyText(record.type ?? record.provider)
  if (rawType === 'smart_wallet' || rawType.includes('smart_wallet')) return true
  const walletClientType = normalizePrivyText(
    record.wallet_client_type ?? record.walletClientType ?? record.connector_type ?? record.connectorType ?? record.type ?? record.provider,
  )
  const normalized = walletClientType.replace(/[\s_-]+/g, '')
  return (
    normalized.includes('smartwallet') ||
    normalized.includes('smartaccount') ||
    walletClientType.includes('coinbase_smart_wallet') ||
    walletClientType.includes('base_account')
  )
}

function collectSmartWalletAddressesFromUser(user: unknown): Set<string> {
  const addresses = new Set<string>()
  const record = normalizedWalletRecord(user)
  if (!record) return addresses

  const linkedAccounts = Array.isArray(record.linkedAccounts)
    ? record.linkedAccounts
    : Array.isArray(record.linked_accounts)
      ? record.linked_accounts
      : []

  for (const account of linkedAccounts) {
    const linkedRecord = normalizedWalletRecord(account)
    if (!linkedRecord) continue
    const smartWallets = Array.isArray(linkedRecord.smartWallets)
      ? linkedRecord.smartWallets
      : Array.isArray(linkedRecord.smart_wallets)
        ? linkedRecord.smart_wallets
        : []
    for (const wallet of smartWallets) {
      const address = normalizeAddressOrNull((wallet as Record<string, unknown>).address)
      if (address) addresses.add(address.toLowerCase())
    }
  }

  for (const wallet of extractPrivyWalletsFromUser(user)) {
    if (!isSmartWalletLikeRecord(wallet)) continue
    const address = normalizeAddressOrNull(wallet.address)
    if (address) addresses.add(address.toLowerCase())
  }

  return addresses
}

function collectEmbeddedWalletRecordsFromUser(user: unknown): Record<string, unknown>[] {
  const record = normalizedWalletRecord(user)
  if (!record) return []

  const embeddedRecords: Record<string, unknown>[] = []
  const linkedAccounts = Array.isArray(record.linkedAccounts)
    ? record.linkedAccounts
    : Array.isArray(record.linked_accounts)
      ? record.linked_accounts
      : []

  for (const account of linkedAccounts) {
    const linkedRecord = normalizedWalletRecord(account)
    if (!linkedRecord) continue
    const embeddedWallets = Array.isArray(linkedRecord.embeddedWallets)
      ? linkedRecord.embeddedWallets
      : Array.isArray(linkedRecord.embedded_wallets)
        ? linkedRecord.embedded_wallets
        : []
    for (const wallet of embeddedWallets) {
      const embeddedRecord = normalizedWalletRecord(wallet)
      if (embeddedRecord) embeddedRecords.push(embeddedRecord)
    }
  }

  return embeddedRecords
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Date.parse(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractWalletRecencyMs(record: Record<string, unknown>): number {
  const candidates = [
    record.latest_verified_at,
    record.latestVerifiedAt,
    record.last_used_at,
    record.lastUsedAt,
    record.connected_at,
    record.connectedAt,
    record.verified_at,
    record.verifiedAt,
    record.updated_at,
    record.updatedAt,
    record.created_at,
    record.createdAt,
  ]
  let best = 0
  for (const candidate of candidates) {
    const ms = parseTimestampMs(candidate)
    if (ms !== null && ms > best) best = ms
  }
  return best
}

function isPrivyServerManagedWalletRecord(value: unknown): boolean {
  const record = normalizedWalletRecord(value)
  if (!record) return false
  const policyIds = record.policy_ids ?? record.policyIds
  if (Array.isArray(policyIds) && policyIds.some((id) => typeof id === 'string' && id.trim())) {
    return true
  }
  const ownerId = normalizePrivyText(record.owner_id ?? record.ownerId)
  const configuredOwnerId = normalizePrivyText(import.meta.env?.VITE_PRIVY_WALLET_OWNER_ID ?? '')
  if (ownerId && configuredOwnerId && ownerId === configuredOwnerId) return true
  return false
}

function collectServerManagedWalletAddressesFromUser(user: unknown): Set<string> {
  const addresses = new Set<string>()
  for (const wallet of extractPrivyWalletsFromUser(user)) {
    if (!isPrivyServerManagedWalletRecord(wallet)) continue
    const address = normalizeAddressOrNull(wallet.address)
    if (address) addresses.add(address.toLowerCase())
  }
  for (const wallet of collectEmbeddedWalletRecordsFromUser(user)) {
    if (!isPrivyServerManagedWalletRecord(wallet)) continue
    const address = normalizeAddressOrNull(wallet.address)
    if (address) addresses.add(address.toLowerCase())
  }
  return addresses
}

export function pickPrivyEmbeddedEoaAddressFromWallets(
  wallets: unknown,
  excludedWalletAddresses: readonly string[] = [],
): Address | null {
  const excluded = new Set(
    excludedWalletAddresses
      .map((value) => normalizeAddressOrNull(value)?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
  const entries = Array.isArray(wallets) ? wallets : []
  const candidates: Array<{ address: Address; recencyMs: number }> = []

  for (const wallet of entries) {
    if (!isEmbeddedEthereumWalletRecord(wallet)) continue
    if (isSmartWalletLikeRecord(wallet)) continue
    if (isPrivyServerManagedWalletRecord(wallet)) continue
    const record = wallet as Record<string, unknown>
    const address = normalizeAddressOrNull(record.address)
    if (!address || excluded.has(address.toLowerCase())) continue
    candidates.push({ address, recencyMs: extractWalletRecencyMs(record) })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.recencyMs - a.recencyMs)
  return candidates[0]?.address ?? null
}

export function pickPrivyEmbeddedEoaAddressFromUser(user: unknown): Address | null {
  const smartWalletAddresses = collectSmartWalletAddressesFromUser(user)
  const serverManagedAddresses = collectServerManagedWalletAddressesFromUser(user)
  const excluded = Array.from(new Set([...smartWalletAddresses, ...serverManagedAddresses]))
  const candidates: Array<{ address: Address; recencyMs: number; fromNested: boolean }> = []

  for (const wallet of collectEmbeddedWalletRecordsFromUser(user)) {
    if (isSmartWalletLikeRecord(wallet)) continue
    if (isPrivyServerManagedWalletRecord(wallet)) continue
    const address = normalizeAddressOrNull(wallet.address)
    if (!address || smartWalletAddresses.has(address.toLowerCase()) || serverManagedAddresses.has(address.toLowerCase())) {
      continue
    }
    candidates.push({ address, recencyMs: extractWalletRecencyMs(wallet), fromNested: true })
  }

  for (const wallet of extractPrivyWalletsFromUser(user)) {
    if (!isEmbeddedEthereumWalletRecord(wallet)) continue
    if (isSmartWalletLikeRecord(wallet)) continue
    if (isPrivyServerManagedWalletRecord(wallet)) continue
    const address = normalizeAddressOrNull(wallet.address)
    if (!address || smartWalletAddresses.has(address.toLowerCase()) || serverManagedAddresses.has(address.toLowerCase())) {
      continue
    }
    candidates.push({ address, recencyMs: extractWalletRecencyMs(wallet), fromNested: false })
  }

  if (candidates.length === 0) {
    return pickPrivyEmbeddedEoaAddressFromWallets(extractPrivyWalletsFromUser(user), excluded)
  }

  candidates.sort((a, b) => {
    if (b.recencyMs !== a.recencyMs) return b.recencyMs - a.recencyMs
    return Number(b.fromNested) - Number(a.fromNested)
  })
  return candidates[0]?.address ?? null
}

type CreateWalletFn = (() => Promise<unknown>) | null

type EmbeddedWalletSnapshot = {
  authenticated: boolean
  user: unknown
  wallets: unknown[]
  createWallet: CreateWalletFn
}

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      user: null,
    } as any
  }
}

function useSafeCreateWallet() {
  try {
    return useCreateWallet() as any
  } catch {
    return {
      createWallet: null,
    } as any
  }
}

export function useEnsurePrivyEmbeddedWallet() {
  const privy = useSafePrivy()
  const { createWallet } = useSafeCreateWallet()
  const [isCreatingEmbeddedWallet, setIsCreatingEmbeddedWallet] = useState(false)
  const wallets = useMemo(() => extractPrivyWalletsFromUser(privy.user), [privy.user])

  const embeddedEoaAddress = useMemo(() => {
    return pickPrivyEmbeddedEoaAddressFromWallets(wallets)
  }, [wallets])

  const snapshotRef = useRef<EmbeddedWalletSnapshot>({
    authenticated: Boolean(privy.authenticated),
    user: privy.user ?? null,
    wallets: Array.isArray(wallets) ? wallets : [],
    createWallet: typeof createWallet === 'function' ? createWallet : null,
  })

  useEffect(() => {
    snapshotRef.current = {
      authenticated: Boolean(privy.authenticated),
      user: privy.user ?? null,
      wallets: Array.isArray(wallets) ? wallets : [],
      createWallet: typeof createWallet === 'function' ? createWallet : null,
    }
  }, [createWallet, privy.authenticated, privy.user, wallets])

  const readLatestEmbeddedWallet = useCallback((): Address | null => {
    const snapshot = snapshotRef.current
    return pickPrivyEmbeddedEoaAddressFromWallets(snapshot.wallets) ?? pickPrivyEmbeddedEoaAddressFromUser(snapshot.user)
  }, [])

  const waitForEmbeddedWallet = useCallback(async (): Promise<Address | null> => {
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const address = readLatestEmbeddedWallet()
      if (address) return address
      await sleep(250)
    }
    return null
  }, [readLatestEmbeddedWallet])

  const ensureEmbeddedWallet = useCallback(async (): Promise<{ address: Address; created: boolean }> => {
    const existingAddress = readLatestEmbeddedWallet()
    if (existingAddress) {
      return {
        address: existingAddress,
        created: false,
      }
    }

    const snapshot = snapshotRef.current
    if (!snapshot.authenticated) {
      throw new Error('Sign in with Privy before provisioning your embedded wallet.')
    }
    if (!snapshot.createWallet) {
      throw new Error('Privy embedded wallet creation is unavailable in this session.')
    }

    setIsCreatingEmbeddedWallet(true)
    try {
      const createdWallet = await snapshot.createWallet()
      const createdWalletRecord = createdWallet && typeof createdWallet === 'object'
        ? (createdWallet as Record<string, unknown>)
        : null
      const createdWalletAccount =
        createdWalletRecord?.account && typeof createdWalletRecord.account === 'object'
          ? (createdWalletRecord.account as Record<string, unknown>)
          : null
      const createdAddress =
        normalizeAddressOrNull(createdWalletRecord?.address) ??
        normalizeAddressOrNull(createdWalletAccount?.address)
      if (createdAddress) {
        return {
          address: createdAddress,
          created: true,
        }
      }

      const settledAddress = await waitForEmbeddedWallet()
      if (settledAddress) {
        return {
          address: settledAddress,
          created: true,
        }
      }

      throw new Error('Privy embedded wallet provisioning did not complete. Retry in a moment.')
    } catch (error) {
      const message = typeof (error as { message?: unknown } | null)?.message === 'string'
        ? String((error as { message: string }).message)
        : String(error ?? '')
      if (/already has an embedded wallet/i.test(message)) {
        const settledAddress = await waitForEmbeddedWallet()
        if (settledAddress) {
          return {
            address: settledAddress,
            created: false,
          }
        }
      }
      throw error instanceof Error ? error : new Error(message || 'Privy embedded wallet provisioning failed.')
    } finally {
      setIsCreatingEmbeddedWallet(false)
    }
  }, [readLatestEmbeddedWallet, waitForEmbeddedWallet])

  return {
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    isCreatingEmbeddedWallet,
  }
}
