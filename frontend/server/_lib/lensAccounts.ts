/**
 * Lens account resolution — uses the official `@lens-protocol/client` SDK.
 *
 * Replaces raw GraphQL `fetch()` with typed SDK queries for type safety,
 * pagination, and access to the full Lens V3 API surface.
 */
import { AccountsBulkQuery, evmAddress } from '@lens-protocol/client'

import { getLensPublicClient } from './lensClient.js'

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
// SDK-based account fetching
// ---------------------------------------------------------------------------

async function fetchLensAccounts(request: { ownedBy?: string[] }): Promise<LensAccount[]> {
  const hasOwnedBy = Array.isArray(request.ownedBy) && request.ownedBy.length > 0
  if (!hasOwnedBy) return []

  const client = getLensPublicClient()

  try {
    const result = await client.query(AccountsBulkQuery, {
      request: {
        addresses: request.ownedBy!.map((addr) => evmAddress(addr)),
      },
    })

    // The SDK returns { value: Account[] } or similar
    const accounts = result?.value
    if (!Array.isArray(accounts)) return []

    return accounts
      .map((item: any): LensAccount | null => {
        if (!item || typeof item !== 'object') return null
        const address = getString(item.address)
        if (!address) return null
        const owner = getString(item.owner)
        const usernameObj = item.username
        const metadataObj = item.metadata
        const username = usernameObj
          ? { value: getString(usernameObj.value), localName: getString(usernameObj.localName) }
          : null
        return {
          address,
          owner,
          username,
          metadata: metadataObj
            ? { name: getString(metadataObj.name), picture: metadataObj.picture }
            : null,
        }
      })
      .filter((item): item is LensAccount => Boolean(item))
  } catch (err) {
    console.error('[lensAccounts] SDK query failed:', err instanceof Error ? err.message : err)
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
