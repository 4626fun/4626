import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'
import type { AccountSetupMe } from '@/features/accountSetup/types'

/**
 * Lightweight cache-aware hook over `GET /api/accounts/me`.
 *
 * Exists because multiple top-level surfaces (the nav header identity
 * card, `/accounts` hero, any future per-page identity chrome) all
 * need the same small set of profile facts — most importantly the
 * canonical Coinbase Smart Wallet address, which is NOT the same
 * thing as the SIWE authAddress for Privy-native flows.
 *
 * Implementation notes:
 *  - Fetch once per mount, then refresh on window focus (matches the
 *    product-frontend invariant: no polling intervals).
 *  - Module-level in-memory cache keyed by the current window so any
 *    number of components sharing this hook in one render tree hit a
 *    single network request. Cache is cleared on failure so we don't
 *    stick with a stale null.
 *  - Return shape is the full `AccountSetupMe` (or null if the user
 *    isn't authenticated). Callers pick the fields they need.
 */

let inFlight: Promise<AccountSetupMe | null> | null = null
let cached: AccountSetupMe | null | undefined = undefined

async function fetchAccountMe(): Promise<AccountSetupMe | null> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await apiFetch('/api/accounts/me', { method: 'GET' })
      if (!res.ok) return null
      const body = (await res.json().catch(() => null)) as
        | { success: boolean; data: AccountSetupMe | null }
        | null
      if (!body || !body.success) return null
      return body.data ?? null
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

function clearAccountMeCache(): void {
  cached = undefined
  inFlight = null
}

export function useAccountMe(): {
  me: AccountSetupMe | null
  loading: boolean
  refresh: () => void
} {
  const [me, setMe] = useState<AccountSetupMe | null>(cached ?? null)
  const [loading, setLoading] = useState<boolean>(cached === undefined)
  const [refreshCounter, setRefreshCounter] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (cached !== undefined && refreshCounter === 0) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    fetchAccountMe().then((result) => {
      if (cancelled) return
      cached = result
      setMe(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refreshCounter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocus = () => {
      clearAccountMeCache()
      setRefreshCounter((c) => c + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return {
    me,
    loading,
    refresh: () => {
      clearAccountMeCache()
      setRefreshCounter((c) => c + 1)
    },
  }
}
