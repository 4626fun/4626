import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'

import { AppLoadingState } from '@/components/AppLoadingState'
import { useCreatorAllowlist } from '@/hooks'
import { useAdminStatusFromSession } from '@/hooks/useAdminStatus'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'
import { API_ENDPOINTS } from '@/lib/apiEndpoints'
import type { ApiEnvelope } from '@/lib/apiEnvelope'
import { getHostMode, getMarketingBaseUrl } from '@/lib/host'
import {
  AccessContext,
  computeAcceptedFromAllowlist,
  getInitialTelegramMiniAppEntryResolution,
  resolveAccess,
  resolveAllowlistMode,
  resolveTelegramMiniAppEntryBootstrap,
  type AccessState,
  type CreatorAllowlistMode,
  type RouteId,
  useAccessContext,
} from './accessShared'

type CreatorAllowlistStatus = {
  address: string | null
  coin: string | null
  creator: string | null
  payoutRecipient: string | null
  mode: CreatorAllowlistMode
  allowed: boolean
}

function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function useResolvedAccessState(): AccessState {
  const location = useLocation()
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
  const effectiveAddress = connectedAddress ?? siweAuthAddress
  const hasSession = Boolean(siweAuthAddress)

  const allowlistModeQuery = useQuery({
    queryKey: ['creatorAllowlist', 'mode'],
    queryFn: async (): Promise<CreatorAllowlistStatus> => {
      const res = await apiFetch(API_ENDPOINTS.creator.allowlist, { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<CreatorAllowlistStatus> | null
      if (!res.ok || !json) throw new Error('Allowlist check failed')
      if (!json.success || !json.data) throw new Error(json.error || 'Allowlist check failed')
      return json.data
    },
    staleTime: 30_000,
    retry: 0,
  })

  const allowQuery = useCreatorAllowlist(effectiveAddress)
  const allowlistMode = resolveAllowlistMode({
    modeFromGlobal: allowlistModeQuery.data?.mode ?? null,
    modeFromAddress: allowQuery.data?.mode ?? null,
  })
  const allowlistEnforced = allowlistMode !== 'disabled'
  const allowlisted = allowQuery.data?.allowed === true
  const accepted = computeAcceptedFromAllowlist({ mode: allowlistMode, allowlisted })
  const allowlistModeLoading = allowlistModeQuery.isLoading || allowlistModeQuery.isFetching
  const allowlistAddressLoading =
    allowlistEnforced &&
    !!effectiveAddress &&
    (allowQuery.isLoading || allowQuery.isFetching)

  const loading =
    !siwe.sessionHydrated ||
    siwe.busy ||
    allowlistModeLoading ||
    allowlistAddressLoading ||
    (hasSession && adminStatus.isLoading)

  return {
    loading,
    walletConnected: isConnected,
    sessionValid: hasSession,
    accepted,
    creator: accepted,
    admin: adminStatus.isAdmin,
    allowlistEnforced,
    effectiveAddress,
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
    if (decision.reason === 'loading') return <AppLoadingState />
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
  const hasImmediateEntryContext = getInitialTelegramMiniAppEntryResolution(location.search) === 'ready'
  const [entryBootstrapState, setEntryBootstrapState] = useState(() => ({
    search: location.search,
    resolved: hasImmediateEntryContext,
    ready: hasImmediateEntryContext,
  }))

  useEffect(() => {
    if (hasImmediateEntryContext) {
      return
    }

    let cancelled = false
    const search = location.search
    void resolveTelegramMiniAppEntryBootstrap({ search }).then((ready) => {
      if (cancelled) return
      setEntryBootstrapState({
        search,
        resolved: true,
        ready,
      })
    })

    return () => {
      cancelled = true
    }
  }, [hasImmediateEntryContext, location.search])

  if (hasImmediateEntryContext) {
    return props.children ? <>{props.children}</> : <Outlet />
  }

  if (entryBootstrapState.search !== location.search || !entryBootstrapState.resolved) {
    return <AppLoadingState />
  }

  if (entryBootstrapState.ready) {
    return props.children ? <>{props.children}</> : <Outlet />
  }

  const acceptedDecision = resolveAccess('accepted', access)
  if (acceptedDecision.reason === 'loading') return <AppLoadingState />
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
