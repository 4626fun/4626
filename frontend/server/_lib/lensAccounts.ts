/**
 * Lens account resolution — uses the Lens V3 GraphQL API directly.
 *
 * Avoids importing from `@lens-protocol/client` sub-packages which are
 * not hoisted by pnpm, causing TS2305 errors at build time.
 */
import { lensGql } from './lensClient.js'

// ---------------------------------------------------------------------------
// Types — kept backward-compatible with all existing callers.
// ---------------------------------------------------------------------------

type LensAccount = {
  address: string
  owner: string | null
  username: {
    value: string | null
    localName: string | null
  } | null
  metadata: {
    name: string | null
    picture: unknown
  } | null
}

export type LensUser = {
  displayName: string
  handle: string | null
  username: string | null
  avatar: string | null
  accountAddress: string
  ownerAddress: string | null
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const ACCOUNTS_BULK_QUERY = /* GraphQL */ `
  query AccountsBulk($request: AccountsBulkRequest!) {
    accountsBulk(request: $request) {
      address
      owner
      username {
        value
        localName
      }
      metadata {
        name
        picture
      }
    }
  }
`

type AccountsBulkResponse = {
  accountsBulk: Array<{
    address: string | null
    owner: string | null
    username: { value: string | null; localName: string | null } | null
    metadata: { name: string | null; picture: unknown } | null
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function extractLensPictureUrl(value: unknown): string | null {
  const direct = getString(value)
  if (direct) return direct
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return (
    getString(record.uri) ??
    getString(record.url) ??
    getString(record.optimized) ??
    getString(record.original) ??
    null
  )
}

function normalizeLensHandle(input: LensAccount['username']): string | null {
  const local = getString(input?.localName)
  if (local) return local
  const value = getString(input?.value)
  if (!value) return null
  if (value.includes('/')) {
    const last = value.slice(value.lastIndexOf('/') + 1)
    return getString(last)
  }
  return value
}

function pickBestLensAccount(accounts: LensAccount[]): LensAccount | null {
  if (!accounts.length) return null
  const score = (account: LensAccount): number => {
    let rank = 0
    if (normalizeLensHandle(account.username)) rank += 3
    if (getString(account.metadata?.name)) rank += 2
    if (extractLensPictureUrl(account.metadata?.picture)) rank += 1
    return rank
  }
  return [...accounts].sort((a, b) => score(b) - score(a))[0] ?? null
}

// ---------------------------------------------------------------------------
// GraphQL-based account fetching
// ---------------------------------------------------------------------------

function mapAccounts(data: AccountsBulkResponse | null | undefined): LensAccount[] {
  const accounts = data?.accountsBulk
  if (!Array.isArray(accounts)) return []
  return accounts
    .map((item): LensAccount | null => {
      if (!item || typeof item !== 'object') return null
      const address = getString(item.address)
      if (!address) return null
      return {
        address,
        owner: getString(item.owner),
        username: item.username
          ? { value: getString(item.username.value), localName: getString(item.username.localName) }
          : null,
        metadata: item.metadata
          ? { name: getString(item.metadata.name), picture: item.metadata.picture }
          : null,
      }
    })
    .filter((item): item is LensAccount => Boolean(item))
}

async function fetchLensAccounts(request: { ownedBy?: string[] }): Promise<LensAccount[]> {
  const hasOwnedBy = Array.isArray(request.ownedBy) && request.ownedBy.length > 0
  if (!hasOwnedBy) return []

  try {
    // Owner resolution should use ownedBy semantics first.
    const ownedByData = await lensGql<AccountsBulkResponse>(ACCOUNTS_BULK_QUERY, {
      request: { ownedBy: request.ownedBy },
    })
    const ownedByAccounts = mapAccounts(ownedByData)
    if (ownedByAccounts.length > 0) return ownedByAccounts

    // Backward-compatible fallback for indexers that only support direct address lookup.
    const addressData = await lensGql<AccountsBulkResponse>(ACCOUNTS_BULK_QUERY, {
      request: { addresses: request.ownedBy },
    })
    return mapAccounts(addressData)
  } catch (err) {
    console.error('[lensAccounts] GraphQL query failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function resolveLensUserByOwner(address: string): Promise<LensUser | null> {
  const accounts = await fetchLensAccounts({ ownedBy: [address] })
  const best = pickBestLensAccount(accounts)
  if (!best) return null

  const handle = normalizeLensHandle(best.username)
  const displayName = getString(best.metadata?.name) ?? (handle ? `@${handle}` : best.address)
  const avatar = extractLensPictureUrl(best.metadata?.picture)

  return {
    displayName,
    handle,
    username: getString(best.username?.value),
    avatar,
    accountAddress: best.address,
    ownerAddress: best.owner,
  }
}
