/**
 * useIdentity — resolve an Ethereum address to a human-readable display name.
 *
 * Resolution order: Farcaster → Lens → ENS → Base Name → truncated address
 * Results are cached in-memory for the session.
 */

import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getBasename, formatBasename } from '@/lib/basename-api'

export type IdentitySource = 'farcaster' | 'lens' | 'ens' | 'basename' | 'address'

export type IdentityResult = {
  displayName: string
  avatar: string | null
  loading: boolean
  source: IdentitySource
  secondary: string | null
  farcasterHandle: string | null
  lensHandle: string | null
  lensUsername: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  ensName: string | null
  basename: string | null
}

type IdentityCacheEntry = Omit<IdentityResult, 'loading'>

// ---------------------------------------------------------------------------
// In-memory cache (survives re-renders, cleared on page reload)
// ---------------------------------------------------------------------------
const identityCache = new Map<string, IdentityCacheEntry>()
const pendingLookups = new Map<string, Promise<IdentityCacheEntry>>()
const ensClient = createPublicClient({ chain: mainnet, transport: http() })

function truncate(addr: string): string {
  if (!addr || addr.length <= 10) return addr || '?'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function lc(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function compactUnique(parts: Array<string | null | undefined>): string | null {
  const out: string[] = []
  for (const part of parts) {
    const trimmed = (part ?? '').trim()
    if (!trimmed) continue
    if (out.some((p) => lc(p) === lc(trimmed))) continue
    out.push(trimmed)
  }
  return out.length > 0 ? out.join(' · ') : null
}

type FarcasterUser = {
  displayName: string
  username: string | null
  avatar: string | null
}

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

type LensUser = {
  displayName: string
  handle: string | null
  username: string | null
  avatar: string | null
  accountAddress: string
  ownerAddress: string | null
}

async function fetchFarcasterUser(address: string): Promise<FarcasterUser | null> {
  const neynarKey = (import.meta.env.VITE_NEYNAR_API_KEY as string | undefined) ?? ''
  if (!neynarKey) return null

  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
    { headers: { api_key: neynarKey } },
  )
  if (!res.ok) return null

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!data) return null

  const direct = data[address.toLowerCase()]
  const rows = Array.isArray(direct)
    ? direct
    : Object.values(data).find((value) => Array.isArray(value))
  const user = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined
  const username = typeof user?.username === 'string' ? user.username : null
  if (!username) return null

  const displayName =
    (typeof user?.display_name === 'string' && user.display_name.trim()) ||
    `@${username}`
  const avatar =
    (typeof user?.pfp_url === 'string' && user.pfp_url) ||
    (typeof (user?.pfp as Record<string, unknown> | undefined)?.url === 'string'
      ? String((user?.pfp as Record<string, unknown>).url)
      : null)

  return {
    displayName,
    username,
    avatar,
  }
}

const LENS_API_URL = 'https://api.lens.xyz/graphql'

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

async function fetchLensAccounts(request: {
  addresses?: string[]
  ownedBy?: string[]
}): Promise<LensAccount[]> {
  const hasAddresses = Array.isArray(request.addresses) && request.addresses.length > 0
  const hasOwnedBy = Array.isArray(request.ownedBy) && request.ownedBy.length > 0
  if (hasAddresses === hasOwnedBy) return []

  const body = {
    query: `
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
    `,
    variables: { request },
  }

  const res = await fetch(LENS_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []

  const payload = (await res.json().catch(() => null)) as
    | { data?: { accountsBulk?: unknown }; errors?: unknown[] }
    | null
  if (!payload || !payload.data || !Array.isArray(payload.data.accountsBulk)) return []

  return payload.data.accountsBulk
    .map((item): LensAccount | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const address = getString(row.address)
      if (!address) return null
      const owner = getString(row.owner)
      const usernameValue =
        row.username && typeof row.username === 'object'
          ? (row.username as Record<string, unknown>)
          : null
      const metadata =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null

      return {
        address,
        owner,
        username: usernameValue
          ? {
              value: getString(usernameValue.value),
              localName: getString(usernameValue.localName),
            }
          : null,
        metadata: metadata
          ? {
              name: getString(metadata.name),
              picture: metadata.picture,
            }
          : null,
      }
    })
    .filter((value): value is LensAccount => Boolean(value))
}

async function fetchLensUser(address: string): Promise<LensUser | null> {
  const exactAccounts = await fetchLensAccounts({ addresses: [address] })
  const pickedExact = pickBestLensAccount(exactAccounts)
  const account = pickedExact ?? pickBestLensAccount(await fetchLensAccounts({ ownedBy: [address] }))
  if (!account) return null

  const handle = normalizeLensHandle(account.username)
  const displayName = getString(account.metadata?.name) ?? (handle ? `@${handle}` : truncate(account.address))

  return {
    displayName,
    handle,
    username: getString(account.username?.value),
    avatar: extractLensPictureUrl(account.metadata?.picture),
    accountAddress: account.address,
    ownerAddress: account.owner,
  }
}

async function resolveIdentity(address: string): Promise<IdentityCacheEntry> {
  const fallback: IdentityCacheEntry = {
    displayName: truncate(address),
    avatar: null,
    source: 'address',
    secondary: null,
    farcasterHandle: null,
    lensHandle: null,
    lensUsername: null,
    lensAccountAddress: null,
    lensOwnerAddress: null,
    ensName: null,
    basename: null,
  }
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return fallback

  // Deduplicate concurrent lookups for the same address
  const pending = pendingLookups.get(address.toLowerCase())
  if (pending) return pending

  const promise = (async () => {
    const [farcaster, lens, ensName, basenameRaw] = await Promise.all([
      fetchFarcasterUser(address).catch(() => null),
      fetchLensUser(address).catch(() => null),
      ensClient.getEnsName({ address: address as `0x${string}` }).catch(() => null),
      getBasename(address).catch(() => null),
    ])

    const basename = basenameRaw ? (formatBasename(basenameRaw) || basenameRaw) : null

    if (farcaster) {
      const handle = farcaster.username ? `@${farcaster.username}` : null
      const lensHandle = lens?.handle ? `@${lens.handle}` : null
      const secondary = compactUnique([
        lc(farcaster.displayName) === lc(handle) ? null : handle,
        lensHandle && lc(lensHandle) !== lc(farcaster.displayName) ? lensHandle : null,
        ensName && lc(ensName) !== lc(farcaster.displayName) ? ensName : null,
        basename && lc(basename) !== lc(farcaster.displayName) ? basename : null,
      ])
      const result: IdentityCacheEntry = {
        displayName: farcaster.displayName,
        avatar: farcaster.avatar ?? lens?.avatar ?? null,
        source: 'farcaster',
        secondary,
        farcasterHandle: farcaster.username,
        lensHandle: lens?.handle ?? null,
        lensUsername: lens?.username ?? null,
        lensAccountAddress: lens?.accountAddress ?? null,
        lensOwnerAddress: lens?.ownerAddress ?? null,
        ensName,
        basename,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (lens) {
      const lensHandle = lens.handle ? `@${lens.handle}` : null
      const result: IdentityCacheEntry = {
        displayName: lens.displayName,
        avatar: lens.avatar,
        source: 'lens',
        secondary: compactUnique([
          lensHandle && lc(lensHandle) !== lc(lens.displayName) ? lensHandle : null,
          ensName && lc(ensName) !== lc(lens.displayName) ? ensName : null,
          basename && lc(basename) !== lc(lens.displayName) ? basename : null,
          truncate(address),
        ]),
        farcasterHandle: null,
        lensHandle: lens.handle,
        lensUsername: lens.username,
        lensAccountAddress: lens.accountAddress,
        lensOwnerAddress: lens.ownerAddress,
        ensName,
        basename,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (ensName) {
      const result: IdentityCacheEntry = {
        displayName: ensName,
        avatar: null,
        source: 'ens',
        secondary: compactUnique([
          basename && lc(basename) !== lc(ensName) ? basename : null,
          truncate(address),
        ]),
        farcasterHandle: null,
        lensHandle: null,
        lensUsername: null,
        lensAccountAddress: null,
        lensOwnerAddress: null,
        ensName,
        basename,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (basename) {
      const result: IdentityCacheEntry = {
        displayName: basename,
        avatar: null,
        source: 'basename',
        secondary: truncate(address),
        farcasterHandle: null,
        lensHandle: null,
        lensUsername: null,
        lensAccountAddress: null,
        lensOwnerAddress: null,
        ensName: null,
        basename,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    identityCache.set(address.toLowerCase(), fallback)
    return fallback
  })()

  pendingLookups.set(address.toLowerCase(), promise)
  promise.finally(() => pendingLookups.delete(address.toLowerCase()))

  return promise
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIdentity(address: string | null | undefined): {
  displayName: string
  avatar: string | null
  loading: boolean
  source: IdentitySource
  secondary: string | null
  farcasterHandle: string | null
  lensHandle: string | null
  lensUsername: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  ensName: string | null
  basename: string | null
} {
  const normalizedAddress = address?.toLowerCase() ?? null
  const cached = normalizedAddress ? identityCache.get(normalizedAddress) ?? null : null
  const fallback: IdentityCacheEntry = address
    ? {
        displayName: truncate(address),
        avatar: null,
        source: 'address',
        secondary: null,
        farcasterHandle: null,
        lensHandle: null,
        lensUsername: null,
        lensAccountAddress: null,
        lensOwnerAddress: null,
        ensName: null,
        basename: null,
      }
    : {
        displayName: '?',
        avatar: null,
        source: 'address',
        secondary: null,
        farcasterHandle: null,
        lensHandle: null,
        lensUsername: null,
        lensAccountAddress: null,
        lensOwnerAddress: null,
        ensName: null,
        basename: null,
      }

  const [resolvedAsync, setResolvedAsync] = useState<{ address: string; entry: IdentityCacheEntry } | null>(null)

  useEffect(() => {
    if (!address) return
    const current = address.toLowerCase()
    if (identityCache.has(current)) return

    let cancelled = false
    resolveIdentity(address).then((result) => {
      if (cancelled) return
      setResolvedAsync({ address: current, entry: result })
    })
    return () => { cancelled = true }
  }, [address])

  const asyncEntry =
    normalizedAddress && resolvedAsync?.address === normalizedAddress
      ? resolvedAsync.entry
      : null
  const entry = cached ?? asyncEntry ?? fallback
  const loading = Boolean(address && !cached && !asyncEntry)

  return { ...entry, loading }
}

/** Batch resolve — useful for pre-warming the cache */
export function prefetchIdentities(addresses: string[]) {
  for (const addr of addresses) {
    if (addr && !identityCache.has(addr.toLowerCase())) {
      void resolveIdentity(addr)
    }
  }
}
