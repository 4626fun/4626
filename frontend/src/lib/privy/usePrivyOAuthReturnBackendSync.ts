import { useEffect, useRef, useState } from 'react'

import {
  isPrivyProviderLinked,
  OAUTH_RETURN_SYNC_PROVIDERS,
  type OAuthReturnSyncProvider,
} from './privyLinkedAccounts'
import {
  isPendingAccountsProviderLinkError,
  syncAccountsProviderLink,
} from './providerLink'

const OAUTH_SYNC_RATE_LIMIT_BACKOFF_MS = 20_000
const OAUTH_SYNC_AUTH_BACKOFF_MS = 30_000
const OAUTH_SYNC_HYDRATION_BACKOFF_MS = 5_000
const OAUTH_SYNC_MAX_HYDRATION_CYCLES = 3
const oauthSyncBackoffUntilMs: Partial<Record<OAuthReturnSyncProvider, number>> = {}

function shouldRetryOAuthBackendSync(error: unknown): boolean {
  const status = typeof (error as { status?: unknown })?.status === 'number'
    ? (error as { status: number }).status
    : null
  if (status === 429) return true
  if (status != null && status >= 500) return false
  if (status === 401 || status === 403) return true
  if ((error as { recoveryRequired?: unknown })?.recoveryRequired === true) return false
  return true
}

/**
 * After a full-page OAuth redirect, Privy may show the linked provider before
 * `/api/accounts/link` has run. Sync once when Privy has the link but 4626 does not.
 */
export function usePrivyOAuthReturnBackendSync(params: {
  enabled?: boolean
  providers?: readonly OAuthReturnSyncProvider[]
  privyReady?: boolean
  privyAuthenticated?: boolean
  privyUser: unknown
  linkedMethods: Partial<Record<OAuthReturnSyncProvider, string[]>> | null | undefined
  getAccessToken: (() => Promise<string | null>) | null | undefined
  onSynced?: () => void
  onError?: (error: unknown, provider: OAuthReturnSyncProvider) => void
}): void {
  const [retryRevision, setRetryRevision] = useState(0)
  const syncAttemptRef = useRef<Partial<Record<OAuthReturnSyncProvider, boolean>>>({})
  const hydrationCycleRef = useRef<Partial<Record<OAuthReturnSyncProvider, number>>>({})
  const hydrationRetryTimerRef = useRef<
    Partial<Record<OAuthReturnSyncProvider, ReturnType<typeof setTimeout>>>
  >({})
  const onSyncedRef = useRef(params.onSynced)
  const onErrorRef = useRef(params.onError)
  const getAccessTokenRef = useRef(params.getAccessToken)

  useEffect(() => {
    onSyncedRef.current = params.onSynced
    onErrorRef.current = params.onError
    getAccessTokenRef.current = params.getAccessToken
  }, [params.getAccessToken, params.onError, params.onSynced])

  useEffect(
    () => () => {
      for (const timer of Object.values(hydrationRetryTimerRef.current)) {
        if (timer) clearTimeout(timer)
      }
    },
    [],
  )

  useEffect(() => {
    if (params.enabled === false) return
    if (params.privyReady === false) return
    if (!params.privyAuthenticated) return

    const providers = params.providers ?? OAUTH_RETURN_SYNC_PROVIDERS
    let cancelled = false
    const pending: OAuthReturnSyncProvider[] = []

    for (const provider of providers) {
      if (Date.now() < (oauthSyncBackoffUntilMs[provider] ?? 0)) continue
      const backendLinked = (params.linkedMethods?.[provider] ?? []).length > 0
      if (backendLinked) {
        syncAttemptRef.current[provider] = false
        hydrationCycleRef.current[provider] = 0
        const timer = hydrationRetryTimerRef.current[provider]
        if (timer) clearTimeout(timer)
        delete hydrationRetryTimerRef.current[provider]
        oauthSyncBackoffUntilMs[provider] = 0
        continue
      }
      if (!isPrivyProviderLinked(params.privyUser, provider)) {
        syncAttemptRef.current[provider] = false
        hydrationCycleRef.current[provider] = 0
        const timer = hydrationRetryTimerRef.current[provider]
        if (timer) clearTimeout(timer)
        delete hydrationRetryTimerRef.current[provider]
        continue
      }
      if (syncAttemptRef.current[provider]) continue
      pending.push(provider)
    }

    if (pending.length === 0) return

    void (async () => {
      for (const provider of pending) {
        if (cancelled) return
        syncAttemptRef.current[provider] = true
        try {
          await syncAccountsProviderLink({
            provider,
            getAccessToken: getAccessTokenRef.current,
          })
          hydrationCycleRef.current[provider] = 0
          if (!cancelled) onSyncedRef.current?.()
        } catch (error) {
          if (cancelled) {
            syncAttemptRef.current[provider] = false
            return
          }
          if (isPendingAccountsProviderLinkError(error, provider)) {
            const cycle = (hydrationCycleRef.current[provider] ?? 0) + 1
            hydrationCycleRef.current[provider] = cycle
            if (cycle < OAUTH_SYNC_MAX_HYDRATION_CYCLES) {
              const currentTimer = hydrationRetryTimerRef.current[provider]
              if (currentTimer) clearTimeout(currentTimer)
              hydrationRetryTimerRef.current[provider] = setTimeout(() => {
                delete hydrationRetryTimerRef.current[provider]
                syncAttemptRef.current[provider] = false
                setRetryRevision((revision) => revision + 1)
              }, OAUTH_SYNC_HYDRATION_BACKOFF_MS)
            }
            continue
          }

          const status = typeof (error as { status?: unknown })?.status === 'number'
            ? (error as { status: number }).status
            : null
          if (status === 429) {
            const retryAfterMs = Number((error as { retryAfterMs?: unknown })?.retryAfterMs)
            const backoffMs =
              Number.isFinite(retryAfterMs) && retryAfterMs > 0
                ? retryAfterMs
                : OAUTH_SYNC_RATE_LIMIT_BACKOFF_MS
            oauthSyncBackoffUntilMs[provider] = Date.now() + backoffMs
          } else if (status === 401 || status === 403) {
            oauthSyncBackoffUntilMs[provider] = Date.now() + OAUTH_SYNC_AUTH_BACKOFF_MS
          }
          if (shouldRetryOAuthBackendSync(error)) {
            syncAttemptRef.current[provider] = false
          }
          if (!cancelled) onErrorRef.current?.(error, provider)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    params.enabled,
    params.linkedMethods,
    params.privyAuthenticated,
    params.privyReady,
    params.privyUser,
    params.providers,
    retryRevision,
  ])
}
