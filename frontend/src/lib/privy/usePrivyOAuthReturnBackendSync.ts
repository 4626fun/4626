import { useEffect, useRef } from 'react'

import {
  isPrivyProviderLinked,
  OAUTH_RETURN_SYNC_PROVIDERS,
  type OAuthReturnSyncProvider,
} from './privyLinkedAccounts'
import { syncAccountsProviderLink } from './providerLink'

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
  const syncAttemptRef = useRef<Partial<Record<OAuthReturnSyncProvider, boolean>>>({})
  const onSyncedRef = useRef(params.onSynced)
  const onErrorRef = useRef(params.onError)
  const getAccessTokenRef = useRef(params.getAccessToken)

  useEffect(() => {
    onSyncedRef.current = params.onSynced
    onErrorRef.current = params.onError
    getAccessTokenRef.current = params.getAccessToken
  }, [params.getAccessToken, params.onError, params.onSynced])

  useEffect(() => {
    if (params.enabled === false) return
    if (params.privyReady === false) return
    if (!params.privyAuthenticated) return

    const providers = params.providers ?? OAUTH_RETURN_SYNC_PROVIDERS
    let cancelled = false
    const pending: OAuthReturnSyncProvider[] = []

    for (const provider of providers) {
      const backendLinked = (params.linkedMethods?.[provider] ?? []).length > 0
      if (backendLinked) {
        syncAttemptRef.current[provider] = false
        continue
      }
      if (!isPrivyProviderLinked(params.privyUser, provider)) continue
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
          if (!cancelled) onSyncedRef.current?.()
        } catch (error) {
          syncAttemptRef.current[provider] = false
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
  ])
}
