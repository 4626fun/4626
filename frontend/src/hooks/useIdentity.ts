/**
 * useIdentity — resolve an Ethereum address to a human-readable display name.
 *
 * Resolution order: Farcaster → Lens → ENS → Base Name → truncated address
 * Results are cached in-memory for the session.
 */

import { useEffect, useState } from 'react'
import { createPublicClient, fallback, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getBasenameProfile, formatBasename } from '@/lib/basename-api'
import { apiFetch } from '@/lib/apiBase'

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
  basenameDisplayName: string | null
  basenameAvatar: string | null
}

type IdentityCacheEntry = Omit<IdentityResult, 'loading'>

// ---------------------------------------------------------------------------
// In-memory cache (survives re-renders, cleared on page reload)
// ---------------------------------------------------------------------------
const identityCache = new Map<string, IdentityCacheEntry>()
const pendingLookups = new Map<string, Promise<IdentityCacheEntry>>()
const IS_BROWSER = typeof window !== 'undefined'
const ensClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    (IS_BROWSER
      ? ['/api/rpc?chain=mainnet']
      : ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com']).map((url) =>
      http(url),
    ),
  ),
})

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

type LensUser = {
  displayName: string
  handle: string | null
  username: string | null
  avatar: string | null
  accountAddress: string
  ownerAddress: string | null
}

export function pickIdentityAvatar(params: {
  basenameAvatar: string | null
  farcasterAvatar?: string | null
  lensAvatar?: string | null
}): string | null {
  return params.basenameAvatar ?? params.farcasterAvatar ?? params.lensAvatar ?? null
}

async function fetchFarcasterUser(address: string): Promise<FarcasterUser | null> {
  // Prefer our server-side resolver so we don't require a client-exposed Neynar key.
  // This also allows environments like desktop web to resolve avatars consistently.
  const res = await apiFetch(`/api/social/farcaster?address=${encodeURIComponent(address)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }).catch(() => null)
  if (!res || !res.ok) return null

  const json = (await res.json().catch(() => null)) as any
  const profile = json?.success === true ? json?.data : null
  if (!profile) return null

  const username = typeof profile?.username === 'string' && profile.username.trim() ? profile.username.trim() : null
  const displayNameRaw = typeof profile?.displayName === 'string' ? profile.displayName.trim() : ''
  const displayName = displayNameRaw || (username ? `@${username}` : truncate(address))
  const avatar = typeof profile?.avatar === 'string' && profile.avatar.trim() ? profile.avatar.trim() : null

  return { displayName, username, avatar }
}

// ---------------------------------------------------------------------------
// Lens resolution — uses the Lens V3 GraphQL API directly
// (avoids pnpm-hoisting issues with @lens-protocol/client sub-packages)
// ---------------------------------------------------------------------------

const LENS_API_URL = 'https://api.lens.xyz/graphql'

const ACCOUNTS_BULK_GQL = /* GraphQL */ `
  query AccountsBulk($request: AccountsBulkRequest!) {
    accountsBulk(request: $request) {
      address
      owner
      username { value localName }
      metadata { name picture }
    }
  }
`

async function lensGql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: T; errors?: unknown[] }
    return json.data ?? null
  } catch {
    return null
  }
}

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

function normalizeLensHandle(input: { value?: string | null; localName?: string | null } | null | undefined): string | null {
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

type AccountsBulkData = {
  accountsBulk: Array<{
    address: string | null
    owner: string | null
    username: { value: string | null; localName: string | null } | null
    metadata: { name: string | null; picture: unknown } | null
  }>
}

async function fetchLensUser(address: string): Promise<LensUser | null> {
  try {
    // Try exact address match first
    const exactData = await lensGql<AccountsBulkData>(ACCOUNTS_BULK_GQL, {
      request: { addresses: [address] },
    })
    let best = pickBest(exactData?.accountsBulk ?? [])

    if (!best) {
      // Fall back to ownedBy
      const ownedData = await lensGql<AccountsBulkData>(ACCOUNTS_BULK_GQL, {
        request: { ownedBy: [address] },
      })
      best = pickBest(ownedData?.accountsBulk ?? [])
    }

    if (!best) return null

    const handle = normalizeLensHandle(best.username)
    const displayName = getString(best.metadata?.name) ?? (handle ? `@${handle}` : truncate(String(best.address)))

    return {
      displayName,
      handle,
      username: getString(best.username?.value),
      avatar: extractLensPictureUrl(best.metadata?.picture),
      accountAddress: String(best.address),
      ownerAddress: best.owner ? String(best.owner) : null,
    }
  } catch {
    return null
  }
}

function pickBest(accounts: any[]): any | null {
  if (!accounts.length) return null
  const score = (acct: any): number => {
    let rank = 0
    if (normalizeLensHandle(acct.username)) rank += 3
    if (getString(acct.metadata?.name)) rank += 2
    if (extractLensPictureUrl(acct.metadata?.picture)) rank += 1
    return rank
  }
  return [...accounts].sort((a, b) => score(b) - score(a))[0] ?? null
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
    basenameDisplayName: null,
    basenameAvatar: null,
  }
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return fallback

  // Deduplicate concurrent lookups for the same address
  const pending = pendingLookups.get(address.toLowerCase())
  if (pending) return pending

  const promise = (async () => {
    const [farcaster, lens, ensName, basenameProfile] = await Promise.all([
      fetchFarcasterUser(address).catch(() => null),
      fetchLensUser(address).catch(() => null),
      ensClient.getEnsName({ address: address as `0x${string}` }).catch(() => null),
      getBasenameProfile(address).catch(() => null),
    ])

    const basenameRaw = basenameProfile?.name ?? null
    const basename = basenameRaw ? (formatBasename(basenameRaw) || basenameRaw) : null
    const basenameDisplayName = (basenameProfile?.displayName ?? '').trim() || basename
    const basenameAvatar = basenameProfile?.avatar ?? null

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
        avatar: pickIdentityAvatar({
          basenameAvatar,
          farcasterAvatar: farcaster.avatar,
          lensAvatar: lens?.avatar ?? null,
        }),
        source: 'farcaster',
        secondary,
        farcasterHandle: farcaster.username,
        lensHandle: lens?.handle ?? null,
        lensUsername: lens?.username ?? null,
        lensAccountAddress: lens?.accountAddress ?? null,
        lensOwnerAddress: lens?.ownerAddress ?? null,
        ensName,
        basename,
        basenameDisplayName: basenameDisplayName ?? null,
        basenameAvatar,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (lens) {
      const lensHandle = lens.handle ? `@${lens.handle}` : null
      const result: IdentityCacheEntry = {
        displayName: lens.displayName,
        avatar: pickIdentityAvatar({
          basenameAvatar,
          lensAvatar: lens.avatar,
        }),
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
        basenameDisplayName: basenameDisplayName ?? null,
        basenameAvatar,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (ensName) {
      const result: IdentityCacheEntry = {
        displayName: ensName,
        avatar: basenameAvatar,
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
        basenameDisplayName: basenameDisplayName ?? null,
        basenameAvatar,
      }
      identityCache.set(address.toLowerCase(), result)
      return result
    }

    if (basename) {
      const result: IdentityCacheEntry = {
        displayName: basenameDisplayName ?? basename,
        avatar: basenameAvatar,
        source: 'basename',
        secondary: truncate(address),
        farcasterHandle: null,
        lensHandle: null,
        lensUsername: null,
        lensAccountAddress: null,
        lensOwnerAddress: null,
        ensName: null,
        basename,
        basenameDisplayName: basenameDisplayName ?? null,
        basenameAvatar,
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
  basenameDisplayName: string | null
  basenameAvatar: string | null
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
        basenameDisplayName: null,
        basenameAvatar: null,
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
        basenameDisplayName: null,
        basenameAvatar: null,
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
