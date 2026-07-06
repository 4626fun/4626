import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useSafePrivyAccessToken } from '@/lib/privy/safeHooks'

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

const ACCOUNTS_ME_RATE_LIMIT_BACKOFF_MS = 8_000
// Prevent bursty UI triggers from spamming identical `/accounts/me` + bootstrap
// fetches in quick succession (click storms, rapid provider state churn).
const ACCOUNTS_ME_REFRESH_DEDUPE_WINDOW_MS = 1_200
// Window-focus refreshes are useful for stale tabs, but when the data just
// settled moments ago they only create visible "flicker" with no user value.
const ACCOUNTS_ME_FOCUS_STALE_MS = 12_000

let inFlight: Promise<AccountSetupMe | null> | null = null
let cached: AccountSetupMe | null | undefined = undefined
let accountsMeRateLimitedUntil = 0
let lastRefreshRequestedAtMs = 0
let lastSettledAtMs = 0

function readRetryAfterMs(res: Response): number {
  const raw = res.headers.get('retry-after')
  if (!raw) return ACCOUNTS_ME_RATE_LIMIT_BACKOFF_MS
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000)
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now())
  return ACCOUNTS_ME_RATE_LIMIT_BACKOFF_MS
}

/** GET `/api/accounts/me` only — identity, linked methods, and score. Split out from
 * `fetchAccountMe` so it can run concurrently with the bootstrap fetch below. */
async function fetchAccountMePayload(token: string): Promise<AccountSetupMe | null> {
  const res = await apiFetch('/api/accounts/me', {
    method: 'GET',
    headers: { 'X-Privy-Token': token },
  })
  if (res.status === 429) {
    accountsMeRateLimitedUntil = Date.now() + readRetryAfterMs(res)
    return null
  }
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as
    | { success: boolean; data: AccountSetupMe | null }
    | null
  return body?.success ? (body.data ?? null) : null
}

async function fetchAccountMe(getAccessToken: GetAccessTokenFn | null): Promise<AccountSetupMe | null> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const tokenFn = typeof getAccessToken === 'function' ? getAccessToken : null
      const token = tokenFn ? await tokenFn().catch(() => null) : null
      // No token → user isn't authenticated yet. Skip the request rather
      // than burn a predictable 401 that pollutes logs and browser tabs.
      if (!token || !tokenFn) return null
      if (Date.now() < accountsMeRateLimitedUntil) return null

      return await fetchAccountMePayload(token)
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

/** Call after wallet sign-in remounts Privy so `/api/accounts/me` refetches. */
export function invalidateAccountMeCache(): void {
  clearAccountMeCache()
}

export function useAccountMe(options?: { enabled?: boolean }): {
  me: AccountSetupMe | null
  loading: boolean
  refresh: () => void
} {
  const enabled = options?.enabled !== false
  const [me, setMe] = useState<AccountSetupMe | null>(cached ?? null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [settledCounter, setSettledCounter] = useState<number>(() => (cached !== undefined ? 0 : -1))
  const getAccessToken = useSafePrivyAccessToken()
  const accessTokenReady = getAccessToken != null

  const loading = useMemo(() => {
    if (!enabled) return false
    if (cached != null && refreshCounter === 0) return false
    if (!accessTokenReady) return true
    return settledCounter !== refreshCounter
  }, [accessTokenReady, enabled, refreshCounter, settledCounter])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let retryTimeout: number | undefined
    // Reuse a successful module cache on first mount only. Do not skip when
    // `cached === null` — that often means Privy was not ready on the first
    // tick and we must refetch once `getAccessToken` becomes available.
    if (cached != null && refreshCounter === 0) {
      return () => {
        cancelled = true
      }
    }
    if (!accessTokenReady) {
      return () => {
        cancelled = true
      }
    }
    if (Date.now() < accountsMeRateLimitedUntil && refreshCounter === 0) {
      retryTimeout = window.setTimeout(() => {
        if (!cancelled) setRefreshCounter((count) => count + 1)
      }, Math.max(500, accountsMeRateLimitedUntil - Date.now()))
      return () => {
        cancelled = true
        if (retryTimeout !== undefined) window.clearTimeout(retryTimeout)
      }
    }
    fetchAccountMe(getAccessToken).then((result) => {
      if (cancelled) return
      if (result !== null) {
        cached = result
        lastSettledAtMs = Date.now()
      } else {
        // Do not cache failed/null responses — a transient 503 or Privy-not-ready
        // window should not stick the whole app on `me === null` until focus.
        cached = undefined
      }
      setMe(result)
      setSettledCounter(refreshCounter)
      if (result === null && refreshCounter < 3) {
        if (Date.now() < accountsMeRateLimitedUntil) return
        retryTimeout = window.setTimeout(() => {
          if (!cancelled) setRefreshCounter((count) => count + 1)
        }, 1_500)
      }
    })
    return () => {
      cancelled = true
      if (retryTimeout !== undefined) window.clearTimeout(retryTimeout)
    }
  }, [accessTokenReady, enabled, getAccessToken, refreshCounter])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    const onFocus = () => {
      if (Date.now() - lastSettledAtMs < ACCOUNTS_ME_FOCUS_STALE_MS) return
      clearAccountMeCache()
      setRefreshCounter((c) => c + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled])

  const refresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRequestedAtMs < ACCOUNTS_ME_REFRESH_DEDUPE_WINDOW_MS) return
    lastRefreshRequestedAtMs = now
    if (inFlight) return
    clearAccountMeCache()
    setRefreshCounter((c) => c + 1)
  }, [])

  return {
    me,
    loading,
    refresh,
  }
}
