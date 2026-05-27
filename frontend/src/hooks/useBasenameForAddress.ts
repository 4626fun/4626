import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { isAddress } from 'viem'

import { formatBasename, getBasenameProfile } from '@/lib/basename/basename-api'

/**
 * Cached, component-friendly wrapper over `getBasenameProfile`. Exposes
 * just what the identity card needs — name + avatar URL + loading
 * state. The underlying library already memoizes per (address, chainId)
 * so hitting this hook from multiple components doesn't refetch.
 *
 * Resolution order inside `getBasenameProfile`:
 *   1. Base L2 reverse resolver -> basename (e.g. `akita.base.eth`)
 *   2. Mainnet ENS reverse resolver -> ENS (e.g. `akita.eth`)
 *   3. Null when nothing resolves
 */

export type BasenameResult = {
  /** Resolved name with `.base.eth` / `.eth` suffix, or null. */
  name: string | null
  /** Display form — usually same as `name` but can be pre-formatted. */
  displayName: string | null
  /** Avatar URL from the name's text records, or null. */
  avatar: string | null
  loading: boolean
}

const EMPTY: BasenameResult = { name: null, displayName: null, avatar: null, loading: false }
type BasenameEntry = Omit<BasenameResult, 'loading'>
const basenameCache = new Map<string, BasenameEntry>()
const basenamePending = new Map<string, Promise<BasenameEntry>>()

async function resolveBasename(address: Address): Promise<BasenameEntry> {
  const key = address.toLowerCase()
  const cached = basenameCache.get(key)
  if (cached) return cached
  const pending = basenamePending.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const profile = await getBasenameProfile(address)
      const entry: BasenameEntry = {
        name: profile.name ?? null,
        displayName: profile.name ? formatBasename(profile.name) : null,
        avatar: profile.avatar ?? null,
      }
      basenameCache.set(key, entry)
      return entry
    } catch {
      const entry: BasenameEntry = { name: null, displayName: null, avatar: null }
      basenameCache.set(key, entry)
      return entry
    } finally {
      basenamePending.delete(key)
    }
  })()

  basenamePending.set(key, promise)
  return promise
}

/** Warm the session cache as soon as wallet addresses are known (e.g. at app launch). */
export function prefetchBasenameForAddresses(addresses: Array<Address | null | undefined>): void {
  for (const address of addresses) {
    if (!address || !isAddress(address)) continue
    void resolveBasename(address)
  }
}

export function useBasenameForAddress(address: Address | null | undefined): BasenameResult {
  const [resolvedAsync, setResolvedAsync] = useState<{ address: string; entry: BasenameEntry } | null>(
    null,
  )
  const normalizedAddress = address && isAddress(address) ? address : null
  const key = normalizedAddress ? normalizedAddress.toLowerCase() : null
  const cached = key ? (basenameCache.get(key) ?? null) : null

  useEffect(() => {
    if (!normalizedAddress) return
    const cacheKey = normalizedAddress.toLowerCase()
    if (basenameCache.has(cacheKey)) return
    let cancelled = false
    resolveBasename(normalizedAddress).then((entry) => {
      if (!cancelled) setResolvedAsync({ address: cacheKey, entry })
    })
    return () => {
      cancelled = true
    }
  }, [normalizedAddress])

  if (!normalizedAddress || !key) return EMPTY
  const asyncEntry = resolvedAsync?.address === key ? resolvedAsync.entry : null
  const entry = cached ?? asyncEntry
  if (!entry) {
    return { ...EMPTY, loading: true }
  }

  return {
    name: entry.name,
    displayName: entry.displayName,
    avatar: entry.avatar,
    loading: false,
  }
}
