import { useEffect, useRef } from 'react'

import { hasZoraReadOnlySignals, resolveZoraReadOnlySignals } from '@/lib/zora/zoraReadOnlyResolve'

import { syncAccountsProviderLink } from './providerLink'
import {
  consumeWaitlistZoraOAuthPending,
  isPrivyZoraCrossAppLinked,
  isZoraCrossAppOAuthReturnLocation,
} from './zoraCrossAppAccounts'
import { assertPrivySessionMarkerCookie } from './loopbackSessionMarkerShim'

const PRIVY_AUTO_LINK_GRACE_MS = 1_800

/**
 * After a full-page Zora OAuth redirect, Privy's CrossAppAuthScreen may run
 * oauth/link before the loopback session marker/token is ready. Recover by
 * syncing the backend link or falling back to read-only Zora resolve.
 */
export function useWaitlistZoraOAuthReturnRecovery(params: {
  enabled?: boolean
  privyReady?: boolean
  privyAuthenticated?: boolean
  privyUser: unknown
  zoraLinked: boolean
  getAccessToken: (() => Promise<string | null>) | null | undefined
  onRecovered?: () => void
  onFallbackNotice?: (message: string) => void
}): void {
  const recoveryAttemptRef = useRef(false)
  const onRecoveredRef = useRef(params.onRecovered)
  const onFallbackNoticeRef = useRef(params.onFallbackNotice)
  const getAccessTokenRef = useRef(params.getAccessToken)

  useEffect(() => {
    onRecoveredRef.current = params.onRecovered
    onFallbackNoticeRef.current = params.onFallbackNotice
    getAccessTokenRef.current = params.getAccessToken
  }, [params.getAccessToken, params.onFallbackNotice, params.onRecovered])

  useEffect(() => {
    if (params.enabled === false) return
    if (params.privyReady === false) return
    if (!params.privyAuthenticated) return
    if (params.zoraLinked) return
    if (recoveryAttemptRef.current) return

    const oauthReturn =
      consumeWaitlistZoraOAuthPending() ||
      (typeof window !== 'undefined' && isZoraCrossAppOAuthReturnLocation(window.location)) ||
      isPrivyZoraCrossAppLinked(params.privyUser)
    if (!oauthReturn) return

    recoveryAttemptRef.current = true
    let cancelled = false

    void (async () => {
      assertPrivySessionMarkerCookie()
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, PRIVY_AUTO_LINK_GRACE_MS)
      })
      if (cancelled) return

      const getAccessToken = getAccessTokenRef.current
      if (typeof getAccessToken !== 'function') return

      try {
        await syncAccountsProviderLink({
          provider: 'zora_cross_app',
          getAccessToken,
        })
        if (!cancelled) onRecoveredRef.current?.()
        return
      } catch {
        // Privy cross-app link may still be syncing — fall through to read-only resolve.
      }

      try {
        const resolvedSignals = await resolveZoraReadOnlySignals({ getAccessToken })
        if (!hasZoraReadOnlySignals(resolvedSignals)) return
        if (!cancelled) {
          onFallbackNoticeRef.current?.(
            'Zora OAuth did not finish in this browser. Read-only Zora signals were detected instead.',
          )
          onRecoveredRef.current?.()
        }
      } catch {
        // User can retry Connect Zora manually.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    params.enabled,
    params.getAccessToken,
    params.privyAuthenticated,
    params.privyReady,
    params.privyUser,
    params.zoraLinked,
  ])
}
