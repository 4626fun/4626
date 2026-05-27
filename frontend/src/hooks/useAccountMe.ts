import { useEffect, useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { apiFetch } from '@/lib/api/apiBase'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { mergeCanonicalWaitlistAccount } from '@/features/waitlist/waitlistFlowState'

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

type BootstrapExecutionSignals = {
  canonicalCswAddress: string
  privyEmbeddedEoaAddress: string
  executionTrack: AccountSetupMe['accountSignals']['executionTrack']
  privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean
  baseSubAccount: AccountSetupMe['accountSignals']['baseSubAccount']
}

let inFlight: Promise<AccountSetupMe | null> | null = null
let cached: AccountSetupMe | null | undefined = undefined

async function fetchBootstrapExecutionSignals(
  getAccessToken: GetAccessTokenFn,
): Promise<BootstrapExecutionSignals | null> {
  const token = await getAccessToken().catch(() => null)
  if (!token) return null
  try {
    const res = await apiFetch('/api/onboarding/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Privy-Token': token,
      },
      body: JSON.stringify({}),
    })
    const body = (await res.json().catch(() => null)) as
      | {
          success: boolean
          data: {
            canonicalCswAddress?: string
            privyEmbeddedEoaAddress?: string
            executionTrack?: AccountSetupMe['accountSignals']['executionTrack']
            privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean
            privyIsOwner?: boolean
            baseSubAccount?: AccountSetupMe['accountSignals']['baseSubAccount']
          } | null
        }
      | null
    if (!res.ok || !body?.success || !body.data) return null
    const ownerFlag =
      body.data.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true || body.data.privyIsOwner === true
    return {
      canonicalCswAddress: String(body.data.canonicalCswAddress ?? ''),
      privyEmbeddedEoaAddress: String(body.data.privyEmbeddedEoaAddress ?? ''),
      executionTrack: body.data.executionTrack ?? 'none-yet',
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: ownerFlag,
      baseSubAccount: body.data.baseSubAccount ?? {
        address: null,
        registered: false,
        isDistinctFromCsw: false,
      },
    }
  } catch {
    return null
  }
}

function mergeBootstrapSignals(
  payload: AccountSetupMe | null,
  bootstrap: BootstrapExecutionSignals,
): AccountSetupMe {
  const baseSignals = payload?.accountSignals
  const executionTrack =
    baseSignals?.executionTrack && baseSignals.executionTrack !== 'none-yet'
      ? baseSignals.executionTrack
      : bootstrap.executionTrack
  const privyEmbeddedEoaIsOwnerOfCanonicalCsw =
    baseSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
      ? true
      : bootstrap.privyEmbeddedEoaIsOwnerOfCanonicalCsw
        ? true
        : baseSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw ?? null

  const mergedAccount = mergeCanonicalWaitlistAccount(
    {
      privyUserId: payload?.privyUserId ?? '',
      email: payload?.email ?? null,
      emailVerified: payload?.emailVerified ?? false,
      appAccessStatus: payload?.appAccessStatus ?? null,
      baseSubAccount: payload?.baseSubAccount ?? bootstrap.baseSubAccount.address,
      linkedMethods: payload?.linkedMethods ?? {},
      score: payload?.score ?? { points: 0, tier: 0 },
      accountSignals: {
        linked: baseSignals?.linked ?? false,
        canonicalCswAddress: baseSignals?.canonicalCswAddress ?? bootstrap.canonicalCswAddress ?? null,
        creatorCoin: baseSignals?.creatorCoin ?? null,
        zoraHandle: baseSignals?.zoraHandle ?? null,
        lastResolvedAt: baseSignals?.lastResolvedAt ?? null,
        baseSubAccount: baseSignals?.baseSubAccount ?? bootstrap.baseSubAccount,
        executionTrack,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw,
      },
    },
    bootstrap,
  )

  return mergedAccount
}

async function fetchAccountMe(getAccessToken: GetAccessTokenFn | null): Promise<AccountSetupMe | null> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = typeof getAccessToken === 'function' ? await getAccessToken().catch(() => null) : null
      // No token → user isn't authenticated yet. Skip the request rather
      // than burn a predictable 401 that pollutes logs and browser tabs.
      if (!token) return null

      let payload: AccountSetupMe | null = null
      const res = await apiFetch('/api/accounts/me', {
        method: 'GET',
        headers: { 'X-Privy-Token': token },
      })
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { success: boolean; data: AccountSetupMe | null }
          | null
        if (body?.success) payload = body.data ?? null
      }

      if (!getAccessToken) return payload
      const bootstrap = await fetchBootstrapExecutionSignals(getAccessToken)
      if (!bootstrap) return payload
      return mergeBootstrapSignals(payload, bootstrap)
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
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [settledCounter, setSettledCounter] = useState<number>(() => (cached !== undefined ? 0 : -1))
  const getAccessToken = useSafePrivyAccessToken()
  const loading = useMemo(() => {
    if (cached != null && refreshCounter === 0) return false
    if (!getAccessToken) return true
    return settledCounter !== refreshCounter
  }, [getAccessToken, refreshCounter, settledCounter])

  useEffect(() => {
    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | undefined
    // Reuse a successful module cache on first mount only. Do not skip when
    // `cached === null` — that often means Privy was not ready on the first
    // tick and we must refetch once `getAccessToken` becomes available.
    if (cached != null && refreshCounter === 0) {
      return () => {
        cancelled = true
      }
    }
    if (!getAccessToken) {
      return () => {
        cancelled = true
      }
    }
    fetchAccountMe(getAccessToken).then((result) => {
      if (cancelled) return
      if (result !== null) {
        cached = result
      } else {
        // Do not cache failed/null responses — a transient 503 or Privy-not-ready
        // window should not stick the whole app on `me === null` until focus.
        cached = undefined
      }
      setMe(result)
      setSettledCounter(refreshCounter)
      if (result === null && refreshCounter < 3) {
        retryTimeout = window.setTimeout(() => {
          if (!cancelled) setRefreshCounter((count) => count + 1)
        }, 1_500)
      }
    })
    return () => {
      cancelled = true
      if (retryTimeout !== undefined) window.clearTimeout(retryTimeout)
    }
  }, [getAccessToken, refreshCounter])

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
