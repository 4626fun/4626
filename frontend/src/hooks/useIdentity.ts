/**
 * useIdentity — resolve an Ethereum address to a human-readable display name.
 *
 * Resolution order: Farcaster → ENS → Base Name → truncated address
 * Results are cached in-memory for the session.
 */

import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getBasename, formatBasename } from '@/lib/basename-api'

export type IdentitySource = 'farcaster' | 'ens' | 'basename' | 'address'

export type IdentityResult = {
  displayName: string
  avatar: string | null
  loading: boolean
  source: IdentitySource
  secondary: string | null
  farcasterHandle: string | null
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

async function resolveIdentity(address: string): Promise<IdentityCacheEntry> {
  const fallback: IdentityCacheEntry = {
    displayName: truncate(address),
    avatar: null,
    source: 'address',
    secondary: null,
    farcasterHandle: null,
    ensName: null,
    basename: null,
  }
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return fallback

  // Deduplicate concurrent lookups for the same address
  const pending = pendingLookups.get(address.toLowerCase())
  if (pending) return pending

  const promise = (async () => {
    const [farcaster, ensName, basenameRaw] = await Promise.all([
      fetchFarcasterUser(address).catch(() => null),
      ensClient.getEnsName({ address: address as `0x${string}` }).catch(() => null),
      getBasename(address).catch(() => null),
    ])

    const basename = basenameRaw ? (formatBasename(basenameRaw) || basenameRaw) : null

    if (farcaster) {
      const handle = farcaster.username ? `@${farcaster.username}` : null
      const secondary = compactUnique([
        lc(farcaster.displayName) === lc(handle) ? null : handle,
        ensName && lc(ensName) !== lc(farcaster.displayName) ? ensName : null,
        basename && lc(basename) !== lc(farcaster.displayName) ? basename : null,
      ])
      const result: IdentityCacheEntry = {
        displayName: farcaster.displayName,
        avatar: farcaster.avatar,
        source: 'farcaster',
        secondary,
        farcasterHandle: farcaster.username,
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
        ensName: null,
        basename: null,
      }
    : {
        displayName: '?',
        avatar: null,
        source: 'address',
        secondary: null,
        farcasterHandle: null,
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
