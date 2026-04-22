import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

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
 *  - Auth: the server requires `X-Privy-Token` on `/api/accounts/me`.
 *    The hook takes a `getAccessToken` fn at call-site and attaches the
 *    token to each fetch. Previously the fetch went out un-authed and
 *    silently 401'd, leaving every caller with `null`.
 *  - Return shape is the full `AccountSetupMe` (or null if the user
 *    isn't authenticated). Callers pick the fields they need.
 */

type GetAccessTokenFn = () => Promise<string | null>

let inFlight: Promise<AccountSetupMe | null> | null = null
let cached: AccountSetupMe | null | undefined = undefined

async function fetchAccountMe(getAccessToken: GetAccessTokenFn | null): Promise<AccountSetupMe | null> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = typeof getAccessToken === 'function' ? await getAccessToken().catch(() => null) : null
      // No token → user isn't authenticated yet. Skip the request rather
      // than burn a predictable 401 that pollutes logs and browser tabs.
      if (!token) return null
      const res = await apiFetch('/api/accounts/me', {
        method: 'GET',
        headers: { 'X-Privy-Token': token },
      })
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

// `usePrivy()` can throw when it runs outside a `PrivyProvider`. Some
// surfaces (marketing-host pages, test shells) render above the Privy
// provider boundary and still import this hook, so guard against the
// throw and fall back to a no-auth stub. The hook returns `null` in that
// case, which is the correct behavior for a user who isn't authed.
function useSafePrivyAccessToken(): GetAccessTokenFn | null {
  try {
    const privy = usePrivy() as any
    const getAccessToken = typeof privy?.getAccessToken === 'function'
      ? (privy.getAccessToken as GetAccessTokenFn)
      : null
    if (!getAccessToken) return null
    if (privy?.ready === false) return null
    if (privy?.authenticated === false) return null
    return getAccessToken
  } catch {
    return null
  }
}

export function useAccountMe(): {
  me: AccountSetupMe | null
  loading: boolean
  refresh: () => void
} {
  const [me, setMe] = useState<AccountSetupMe | null>(cached ?? null)
  const [loading, setLoading] = useState<boolean>(cached === undefined)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const getAccessToken = useSafePrivyAccessToken()

  useEffect(() => {
    let cancelled = false
    if (cached !== undefined && refreshCounter === 0) {
      return () => {
        cancelled = true
      }
    }
    fetchAccountMe(getAccessToken).then((result) => {
      if (cancelled) return
      cached = result
      setMe(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [getAccessToken, refreshCounter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocus = () => {
      clearAccountMeCache()
      setLoading(true)
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
      setLoading(true)
      setRefreshCounter((c) => c + 1)
    },
  }
}
