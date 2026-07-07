import type { PrivyUserLike } from './walletMapping.js'

/** Persisted on `profile_wallets.canonical_source`. */
export const CANONICAL_SOURCE_BASE_ACCOUNT = 'base_account'
export const CANONICAL_SOURCE_WALLET_SYNC = 'wallet_sync'
export const CANONICAL_SOURCE_PRIVY_CSW = 'privy_csw'

const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function readLinkedAccounts(user: PrivyUserLike): unknown[] {
  const record = user as Record<string, unknown> | null
  if (!record) return []
  if (Array.isArray(record.linkedAccounts)) return record.linkedAccounts
  if (Array.isArray(record.linked_accounts)) return record.linked_accounts
  return []
}

/** True when the user linked via Base App (`type: base_account`), not Privy-provisioned CSW alone. */
export function hasBaseAccountLinkedAccount(user: PrivyUserLike): boolean {
  for (const account of readLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    const type = normalizeLower(record.type)
    const clientType = normalizeLower(
      record.walletClientType ??
        record.wallet_client_type ??
        record.connectorType ??
        record.connector_type ??
        '',
    )
    if (type === 'base_account' || clientType.includes('base_account')) return true
  }
  return false
}

export function hasZoraCrossAppAccount(user: PrivyUserLike): boolean {
  for (const account of readLinkedAccounts(user)) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    if (normalizeLower(record.type) !== 'cross_app') continue
    const appId = normalizeLower(record.providerAppId ?? record.provider_app_id ?? '')
    if (appId === ZORA_PRIVY_APP_ID) return true
  }
  return false
}

export function isBaseAppPopulationCanonicalSource(
  canonicalSource: string | null | undefined,
): boolean {
  return normalizeLower(canonicalSource) === CANONICAL_SOURCE_BASE_ACCOUNT
}

/**
 * Infer canonical_source for a freshly synced Privy CSW.
 * Privy-provisioned Coinbase Smart Wallets must not be tagged `base_account`.
 */
export function resolveSyncedCanonicalSource(params: {
  privyUser: PrivyUserLike
  canonicalSmartWallet: { address: string; provider: string } | null
  persistedCanonicalSource?: string | null
}): string | null {
  const persisted = typeof params.persistedCanonicalSource === 'string' ? params.persistedCanonicalSource.trim() : ''
  if (persisted) return persisted
  if (!params.canonicalSmartWallet) return null
  if (hasBaseAccountLinkedAccount(params.privyUser)) return CANONICAL_SOURCE_BASE_ACCOUNT
  if (hasZoraCrossAppAccount(params.privyUser)) return CANONICAL_SOURCE_WALLET_SYNC
  if (params.canonicalSmartWallet.provider === 'coinbase_wallet') return CANONICAL_SOURCE_PRIVY_CSW
  return CANONICAL_SOURCE_WALLET_SYNC
}
