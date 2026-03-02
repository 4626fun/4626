import { getAddress, isAddress } from 'viem'
import type { OwnerInstallMappingStatus } from './waitlistTypes'

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  try {
    return getAddress(raw).toLowerCase()
  } catch {
    return null
  }
}

function uniqueAddresses(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeEvmAddress(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export type ZoraCrossAppAddressSet = {
  providerAddresses: string[]
  smartWalletAddresses: string[]
  embeddedWalletAddresses: string[]
}

export type ZoraCrossAppAuthAction = 'link' | 'login'

export function selectZoraCrossAppAuthAction(params: {
  privyAuthed: boolean
  linkCrossAppAccount: unknown
  loginWithCrossAppAccount: unknown
}): ZoraCrossAppAuthAction | null {
  const hasLink = typeof params.linkCrossAppAccount === 'function'
  const hasLogin = typeof params.loginWithCrossAppAccount === 'function'

  if (params.privyAuthed) {
    if (hasLink) return 'link'
    if (hasLogin) return 'login'
    return null
  }

  if (hasLogin) return 'login'
  if (hasLink) return 'link'
  return null
}

export function readLinkedAccounts(user: unknown): any[] {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return []
  const camel = Array.isArray(record.linkedAccounts) ? (record.linkedAccounts as any[]) : []
  const snake = Array.isArray(record.linked_accounts) ? (record.linked_accounts as any[]) : []
  return [...camel, ...snake]
}

function providerAppId(account: any): string {
  return normalizeLower(
    account?.providerAppId ??
      account?.provider_app_id ??
      account?.providerApp?.id ??
      account?.provider_app?.id ??
      account?.appId ??
      account?.app_id,
  )
}

export function extractZoraCrossAppAccounts(user: unknown, zoraPrivyAppId: string): any[] {
  const target = normalizeLower(zoraPrivyAppId)
  if (!target) return []
  const linked = readLinkedAccounts(user)
  return linked.filter((account) => {
    const type = normalizeLower((account as any)?.type)
    if (type !== 'cross_app') return false
    return providerAppId(account) === target
  })
}

function extractAccountWalletAddresses(account: any, keyCamel: string, keySnake: string): string[] {
  const wallets = Array.isArray(account?.[keyCamel])
    ? (account[keyCamel] as any[])
    : Array.isArray(account?.[keySnake])
      ? (account[keySnake] as any[])
      : []
  return uniqueAddresses(wallets.map((wallet) => wallet?.address))
}

export function extractZoraProviderAddresses(accounts: any[]): ZoraCrossAppAddressSet {
  const safeAccounts = Array.isArray(accounts) ? accounts : []
  const providerAddresses = uniqueAddresses(safeAccounts.map((account) => (account as any)?.address))
  const smartWalletAddresses = uniqueAddresses(
    safeAccounts.flatMap((account) => extractAccountWalletAddresses(account, 'smartWallets', 'smart_wallets')),
  )
  const embeddedWalletAddresses = uniqueAddresses(
    safeAccounts.flatMap((account) => extractAccountWalletAddresses(account, 'embeddedWallets', 'embedded_wallets')),
  )

  return {
    providerAddresses: uniqueAddresses([...providerAddresses, ...smartWalletAddresses, ...embeddedWalletAddresses]),
    smartWalletAddresses,
    embeddedWalletAddresses,
  }
}

export async function resolveCanonicalZoraCswCandidate(params: {
  knownCanonicalAddress: string | null
  smartWalletAddresses: string[]
  providerAddresses: string[]
  profileFallbackAddress: string | null
  isContractAddress?: (address: string) => Promise<boolean>
}): Promise<string | null> {
  const knownCanonical = normalizeEvmAddress(params.knownCanonicalAddress)
  if (knownCanonical) {
    // If we already have a known canonical address from integration state, trust it first.
    return knownCanonical
  }

  const smartCandidates = uniqueAddresses(params.smartWalletAddresses)
  const providerCandidates = uniqueAddresses(params.providerAddresses)
  const profileFallback = normalizeEvmAddress(params.profileFallbackAddress)

  if (!params.isContractAddress) {
    return smartCandidates[0] ?? profileFallback ?? providerCandidates[0] ?? null
  }

  for (const candidate of smartCandidates) {
    if (await params.isContractAddress(candidate)) return candidate
  }
  if (profileFallback) return profileFallback
  for (const candidate of providerCandidates) {
    if (await params.isContractAddress(candidate)) return candidate
  }

  return null
}

export function deriveOwnerInstallMappingStatus(params: {
  privyAuthed: boolean
  walletsReady: boolean
  embeddedEoaAddress: string | null
  embeddedWalletCreating: boolean
  zoraLinked: boolean
  zoraLinking: boolean
  canonicalZoraCswAddress: string | null
  canonicalResolving: boolean
}): OwnerInstallMappingStatus {
  const {
    privyAuthed,
    walletsReady,
    embeddedEoaAddress,
    embeddedWalletCreating,
    zoraLinked,
    zoraLinking,
    canonicalZoraCswAddress,
    canonicalResolving,
  } = params

  if (!privyAuthed) return 'NEEDS_PRIVY_AUTH'
  if (!walletsReady) return 'WAITING_FOR_WALLETS'
  if (!embeddedEoaAddress) return embeddedWalletCreating ? 'EMBEDDED_WALLET_CREATING' : 'EMBEDDED_WALLET_MISSING'
  // If we already have a canonical CSW from profile/wallet inference, do not block on cross-app linking.
  if (canonicalZoraCswAddress) return 'READY_FOR_OWNER_INSTALL'
  if (!zoraLinked) return zoraLinking ? 'ZORA_LINKING' : 'ZORA_LINK_REQUIRED'
  if (!canonicalZoraCswAddress) return canonicalResolving ? 'CANONICAL_RESOLVING' : 'CANONICAL_UNRESOLVED'
  return 'READY_FOR_OWNER_INSTALL'
}

