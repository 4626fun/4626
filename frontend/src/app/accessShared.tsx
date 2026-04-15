import { createContext, useContext } from 'react'

import { buildWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { APP_ORIGIN } from '@/lib/env/host'
export {
  getInitialTelegramMiniAppEntryResolution,
  hasTelegramLinkEntryContext,
  hasTelegramLinkQueryContext,
  resolveTelegramMiniAppEntryBootstrap,
} from '@/lib/telegram/telegramMiniAppRouteGuard'

export type RouteId = 'public' | 'session' | 'accepted' | 'creator' | 'admin'
export type AccessReason = 'ok' | 'loading' | 'needs-session' | 'needs-acceptance' | 'needs-admin' | 'needs-creator' | 'not-found'
export type AccessDecision = { allow: true; reason: 'ok' } | { allow: false; reason: Exclude<AccessReason, 'ok'>; redirectTo?: string }

export type AccessState = {
  loading: boolean
  walletConnected: boolean
  sessionValid: boolean
  accepted: boolean
  creator: boolean
  admin: boolean
  allowlistEnforced: boolean
  effectiveAddress: string | null
  marketingUrl: string
  hostMode: import('@/lib/env/host').HostMode
}

const ROUTE_REQUIREMENTS: Record<RouteId, { session?: boolean; accepted?: boolean; creator?: boolean; admin?: boolean }> = {
  public: {},
  session: { session: true },
  accepted: { session: true, accepted: true },
  creator: { session: true, accepted: true, creator: true },
  admin: { session: true, admin: true },
}

export function computeAcceptedFromAppAccessStatus(appAccessStatus: string | null): boolean {
  return String(appAccessStatus ?? '').trim().toLowerCase() === 'approved'
}

export function waitlistEntryHref(marketingUrl: string): string {
  return buildWaitlistEntryUrl(marketingUrl)
}

export function resolveAccess(routeId: RouteId, state: AccessState): AccessDecision {
  if (state.loading) return { allow: false, reason: 'loading' }
  const req = ROUTE_REQUIREMENTS[routeId]
  if (req.session && !state.sessionValid) {
    return { allow: false, reason: 'needs-session', redirectTo: waitlistEntryHref(state.marketingUrl) }
  }
  if (req.accepted && !state.accepted) {
    return {
      allow: false,
      reason: 'needs-acceptance',
      redirectTo: waitlistEntryHref(state.marketingUrl),
    }
  }
  if (req.creator && !state.creator) {
    const deployPrefix = state.hostMode === 'marketing' ? APP_ORIGIN : ''
    return { allow: false, reason: 'needs-creator', redirectTo: `${deployPrefix}/deploy` }
  }
  if (req.admin && !state.admin) {
    return { allow: false, reason: 'needs-admin', redirectTo: '/' }
  }
  return { allow: true, reason: 'ok' }
}

export const AccessContext = createContext<AccessState | null>(null)

export function useAccessContext(): AccessState {
  const value = useContext(AccessContext)
  if (!value) {
    throw new Error('AccessContext is not available')
  }
  return value
}

export function useOptionalAccessContext(): AccessState | null {
  return useContext(AccessContext)
}
