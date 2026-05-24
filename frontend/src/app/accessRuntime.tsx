import { useMemo, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { useTelegramMiniAppEntryStatus } from '@/hooks/useTelegramMiniAppEntryStatus'
import { useAdminStatusFromSession } from '@/hooks/useAdminStatus'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { getHostMode, getMarketingBaseUrl } from '@/lib/env/host'
import { isScreenshotMode } from '@/lib/ui/screenshotMode'
import {
  AccessContext,
  computeAcceptedFromAppAccessStatus,
  resolveAccess,
  type AccessState,
  type RouteId,
  useAccessContext,
} from './accessShared'

type WaitlistMeResponse = {
  appAccessStatus: string | null
}

function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function useResolvedAccessState(): AccessState {
  const location = useLocation()
  const screenshotMode = isScreenshotMode(location.search)
  const { address: connectedAddressRaw, isConnected } = useAccount()
  const siwe = useSiweAuth()
  const shouldLoadAdminStatus = location.pathname.startsWith('/admin')
  const adminStatus = useAdminStatusFromSession({
    authAddress: typeof siwe.authAddress === 'string' ? siwe.authAddress : null,
    sessionHydrated: siwe.sessionHydrated,
    enabled: shouldLoadAdminStatus,
  })

  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )
  const siweAuthAddress = useMemo(() => {
    const raw = typeof siwe.authAddress === 'string' ? siwe.authAddress : ''
    return isValidEvmAddress(raw) ? raw.toLowerCase() : null
  }, [siwe.authAddress])
  const hasSession = Boolean(siweAuthAddress)
  const acceptedStateQuery = useQuery({
    queryKey: ['appAccessStatus', 'waitlist-me'],
    enabled: hasSession && !screenshotMode,
    queryFn: async (): Promise<WaitlistMeResponse | null> => {
      const res = await apiFetch('/api/waitlist/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeResponse | null> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
    staleTime: 15_000,
    retry: 0,
  })
  const accepted = computeAcceptedFromAppAccessStatus(acceptedStateQuery.data?.appAccessStatus ?? null)

  // Keep the route guard in a loading state while the session is hydrated but
  // the waitlist-me query has not yet produced data. react-query's `isLoading`
  // only reports `true` while actively fetching, so there is a render window
  // right after `hasSession` flips true where `isLoading === false` and
  // `data === undefined`. Treating that window as "not loading" causes an
  // erroneous redirect back to the marketing waitlist page (bounce) before the
  // first fetch resolves. Guard on `data === undefined` to close the race.
  const acceptedUnknown =
    hasSession && !screenshotMode && acceptedStateQuery.data === undefined && !acceptedStateQuery.isError
  const loading =
    !siwe.sessionHydrated ||
    siwe.busy ||
    acceptedUnknown ||
    (hasSession && adminStatus.isLoading)

  if (screenshotMode) {
    return {
      loading: false,
      walletConnected: false,
      sessionValid: true,
      accepted: true,
      creator: true,
      admin: false,
      allowlistEnforced: true,
      effectiveAddress: null,
      marketingUrl: getMarketingBaseUrl(),
      hostMode: getHostMode(),
    }
  }

  return {
    loading,
    walletConnected: isConnected,
    sessionValid: hasSession,
    accepted,
    creator: accepted,
    admin: adminStatus.isAdmin,
    allowlistEnforced: true,
    effectiveAddress: connectedAddress ?? siweAuthAddress,
    marketingUrl: getMarketingBaseUrl(),
    hostMode: getHostMode(),
  }
}

export function AccessStateProvider(props: { children: ReactNode }) {
  const value = useResolvedAccessState()
  return <AccessContext.Provider value={value}>{props.children}</AccessContext.Provider>
}

function RequireRouteAccess(props: { routeId: RouteId; children?: React.ReactNode }) {
  const access = useAccessContext()
  const decision = resolveAccess(props.routeId, access)
  if (!decision.allow) {
    if (decision.reason === 'loading') return <AppLoadingRegistrar />
    const to = decision.redirectTo ?? '/'
    if (to.startsWith('http://') || to.startsWith('https://')) {
      if (typeof window !== 'undefined') window.location.replace(to)
      return null
    }
    return <Navigate to={to} replace />
  }
  return props.children ? <>{props.children}</> : <Outlet />
}

export function RequireSession(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="session">{props.children}</RequireRouteAccess>
}

export function RequireAccepted(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="accepted">{props.children}</RequireRouteAccess>
}

export function RequireAdmin(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="admin">{props.children}</RequireRouteAccess>
}

export function RequireTelegramMiniAppEntry(props: { children?: React.ReactNode }) {
  const access = useAccessContext()
  const location = useLocation()
  const entryStatus = useTelegramMiniAppEntryStatus(location.search)

  if (entryStatus === 'ready') {
    return props.children ? <>{props.children}</> : <Outlet />
  }

  if (entryStatus === 'checking') {
    return <AppLoadingRegistrar />
  }

  const acceptedDecision = resolveAccess('accepted', access)
  if (acceptedDecision.reason === 'loading') return <AppLoadingRegistrar />
  if (acceptedDecision.allow) {
    return <Navigate to="/swap" replace state={{ from: location.pathname }} />
  }
  const to = acceptedDecision.redirectTo ?? '/'
  if (to.startsWith('http://') || to.startsWith('https://')) {
    if (typeof window !== 'undefined') window.location.replace(to)
    return null
  }
  return <Navigate to={to} replace />
}
