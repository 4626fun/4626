/**
 * useIdentity — resolve an Ethereum address to a human-readable display name.
 *
 * Resolution order: Base Name → ENS → Farcaster → truncated address
 * Results are cached in-memory for the session.
 */

import { useEffect, useState } from 'react'
import { getBasename, formatBasename } from '@/lib/basename-api'

// ---------------------------------------------------------------------------
// In-memory cache (survives re-renders, cleared on page reload)
// ---------------------------------------------------------------------------
const identityCache = new Map<string, { displayName: string; avatar: string | null }>()
const pendingLookups = new Map<string, Promise<{ displayName: string; avatar: string | null }>>()

function truncate(addr: string): string {
  if (!addr || addr.length <= 10) return addr || '?'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

async function resolveIdentity(address: string): Promise<{ displayName: string; avatar: string | null }> {
  const fallback = { displayName: truncate(address), avatar: null }
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return fallback

  // Deduplicate concurrent lookups for the same address
  const pending = pendingLookups.get(address.toLowerCase())
  if (pending) return pending

  const promise = (async () => {
    try {
      // 1. Try Base Name (fastest for Base ecosystem)
      const basename = await getBasename(address)
      if (basename) {
        const result = { displayName: formatBasename(basename) || basename, avatar: null }
        identityCache.set(address.toLowerCase(), result)
        return result
      }
    } catch { /* continue to fallback */ }

    try {
      // 2. Try Farcaster via Neynar (client-side, VITE key)
      const neynarKey = (import.meta.env.VITE_NEYNAR_API_KEY as string | undefined) ?? ''
      if (neynarKey) {
        const res = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
          { headers: { api_key: neynarKey } },
        )
        if (res.ok) {
          const data = await res.json()
          const key = Object.keys(data)[0]
          const user = key && Array.isArray(data[key]) ? data[key][0] : null
          if (user?.username) {
            const result = {
              displayName: `@${user.username}`,
              avatar: user.pfp_url ?? user.pfp?.url ?? null,
            }
            identityCache.set(address.toLowerCase(), result)
            return result
          }
        }
      }
    } catch { /* continue to fallback */ }

    // 3. Fallback: truncated address
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
} {
  const [displayName, setDisplayName] = useState(() => {
    if (!address) return '?'
    const cached = identityCache.get(address.toLowerCase())
    return cached?.displayName ?? truncate(address)
  })
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (!address) return null
    return identityCache.get(address.toLowerCase())?.avatar ?? null
  })
  const [loading, setLoading] = useState(() => {
    if (!address) return false
    return !identityCache.has(address.toLowerCase())
  })

  useEffect(() => {
    if (!address) {
      setDisplayName('?')
      setAvatar(null)
      setLoading(false)
      return
    }

    const lc = address.toLowerCase()
    const cached = identityCache.get(lc)
    if (cached) {
      setDisplayName(cached.displayName)
      setAvatar(cached.avatar)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    resolveIdentity(address).then((result) => {
      if (cancelled) return
      setDisplayName(result.displayName)
      setAvatar(result.avatar)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [address])

  return { displayName, avatar, loading }
}

/** Batch resolve — useful for pre-warming the cache */
export function prefetchIdentities(addresses: string[]) {
  for (const addr of addresses) {
    if (addr && !identityCache.has(addr.toLowerCase())) {
      void resolveIdentity(addr)
    }
  }
}
