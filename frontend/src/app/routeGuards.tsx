import { useEffect, useRef, type ReactNode } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLocation } from 'react-router-dom'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { Layout } from '@/components/layout/Layout'
import { isAppOnlyPath } from '@/lib/auth/appOnlyPaths'
import { getCanonicalMarketingWaitlistPath } from '@/lib/auth/waitlistEntry'
import { APP_ORIGIN, MARKETING_ORIGIN, getHostMode, isCurrentWindowUrl, type HostMode } from '@/lib/env/host'
import { bridgePrivySession, createAuthHandoffCode } from '@/features/waitlist/waitlistHandoff'
import { AccountContextProvider } from '@/wallet/accountContext'

import {
  LazyRequireAccepted,
  LazyRequireSession,
  LazyRouteBoundary,
  SmartWalletsRouteProvider,
} from './lazyRoutes'

const HANDOFF_QUERY_KEY = 'cv_handoff'

/** Plain cross-origin redirect without session transfer (used for marketing↔app direction swaps). */
function ReplaceOnMount(props: { to: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.location.replace(props.to)
  }, [props.to])

  return <AppLoadingRegistrar />
}

/**
 * Cross-origin redirect that carries a cv_handoff session code for authenticated users.
 * Waits for Privy to be ready, creates a one-time handoff code, then redirects so the
 * destination can restore the session without a second sign-in.
 */
function HandoffOnMount(props: { to: string }) {
  const { ready, authenticated, getAccessToken } = usePrivy()
  const fired = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!ready) return
    if (fired.current) return
    fired.current = true

    void (async () => {
      let target = props.to

      if (authenticated) {
        try {
          const privyToken = await getAccessToken().catch(() => null)
          if (privyToken) {
            // Establishes the cv_auth_session cookie on this origin via
            // FINDING-02 cookie-only contract; createAuthHandoffCode then
            // authenticates with that cookie via `withCredentials: true`.
            await bridgePrivySession(privyToken)
            const handoffCode = await createAuthHandoffCode({ privyToken })
            if (handoffCode) {
              const parsed = new URL(target)
              parsed.searchParams.set(HANDOFF_QUERY_KEY, handoffCode)
              target = parsed.toString()
            }
          }
        } catch {
          // Fall back to redirect without handoff on any error.
        }
      }

      window.location.replace(target)
    })()
  }, [props.to, ready, authenticated, getAccessToken])

  return <AppLoadingRegistrar />
}

/** Redirect from 4626.fun to app.4626.fun when user hits app-only routes. */
export function HostGuard() {
  const location = useLocation()
  const mode = getHostMode()
  if (mode !== 'marketing') return null
  const { pathname, search, hash } = location
  if (!isAppOnlyPath(pathname)) return null
  const target = `${APP_ORIGIN}${pathname}${search}${hash}`
  if (isCurrentWindowUrl(target)) return null
  return <HandoffOnMount to={target} />
}

/** Restrict route content to marketing domain; app host redirects cross-origin. */
export function MarketingOnlyRoute(props: { children: ReactNode }) {
  const location = useLocation()
  const mode = getHostMode()
  if (mode === 'marketing') return <>{props.children}</>

  const target = `${MARKETING_ORIGIN}${location.pathname}${location.search}${location.hash}`
  if (isCurrentWindowUrl(target)) return <>{props.children}</>
  return <ReplaceOnMount to={target} />
}

/** Waitlist onboarding must run on 4626.fun so sub-accounts bind to the marketing domain. */
export function MarketingWaitlistRoute(props: { children: ReactNode }) {
  return <MarketingOnlyRoute>{props.children}</MarketingOnlyRoute>
}

export function marketingOnlyElement(element: ReactNode) {
  return <MarketingOnlyRoute>{element}</MarketingOnlyRoute>
}

export function AuthenticatedAppLayout() {
  return (
    <AccountContextProvider>
      <Layout />
    </AccountContextProvider>
  )
}

export function PublicAppLayout() {
  return <Layout interactive={false} chatEnabled={false} />
}

export function SmartWalletRoute(props: { children: ReactNode }) {
  return <SmartWalletsRouteProvider>{props.children}</SmartWalletsRouteProvider>
}

export function SessionAcceptedRoute(props: { children?: ReactNode }) {
  return (
    <LazyRouteBoundary>
      <LazyRequireSession>
        <LazyRouteBoundary>
          <LazyRequireAccepted>{props.children}</LazyRequireAccepted>
        </LazyRouteBoundary>
      </LazyRequireSession>
    </LazyRouteBoundary>
  )
}

export function getGenericNotFoundCta(hostMode: HostMode): {
  href: string
  label: string
  hint: string
} {
  if (hostMode === 'marketing') {
    return {
      href: getCanonicalMarketingWaitlistPath(),
      label: 'Join Waitlist',
      hint: 'Start from the canonical waitlist entry.',
    }
  }
  return {
    href: '/swap',
    label: 'Go To Trade',
    hint: 'Continue to the canonical app landing route.',
  }
}
