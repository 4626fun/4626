import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { Layout } from '@/components/layout/Layout'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { getCanonicalMarketingWaitlistPath } from '@/lib/auth/waitlistEntry'
import { APP_ORIGIN, MARKETING_ORIGIN, getHostMode, isCurrentWindowUrl, type HostMode } from '@/lib/host'
import { AccountContextProvider } from '@/wallet/accountContext'

import {
  LazyRequireAccepted,
  LazyRequireSession,
  LazyRouteBoundary,
  SmartWalletsRouteProvider,
} from './lazyRoutes'

function ReplaceOnMount(props: { to: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.location.replace(props.to)
  }, [props.to])

  return <AppLoadingState />
}

/** Redirect from 4626.fun to v1.4626.fun when user hits app-only routes. */
export function HostGuard() {
  const location = useLocation()
  const mode = getHostMode()
  if (mode !== 'marketing') return null
  const { pathname, search, hash } = location
  if (!isAppOnlyPath(pathname)) return null
  const target = `${APP_ORIGIN}${pathname}${search}${hash}`
  if (isCurrentWindowUrl(target)) return null
  return <ReplaceOnMount to={target} />
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
