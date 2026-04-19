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
 *   1. Base L2 reverse resolver → basename (e.g. `akita.base.eth`)
 *   2. Mainnet ENS reverse resolver → ENS (e.g. `akita.eth`)
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

export function useBasenameForAddress(address: Address | null | undefined): BasenameResult {
  const [result, setResult] = useState<BasenameResult>(EMPTY)

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setResult(EMPTY)
      return
    }
    let cancelled = false
    setResult((prev) => ({ ...prev, loading: true }))
    getBasenameProfile(address)
      .then((profile) => {
        if (cancelled) return
        setResult({
          name: profile.name ?? null,
          displayName: profile.name ? formatBasename(profile.name) : null,
          avatar: profile.avatar ?? null,
          loading: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setResult({ ...EMPTY, loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [address])

  return result
}
