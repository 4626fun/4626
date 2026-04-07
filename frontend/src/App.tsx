import { useMemo } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'

import { APP_ORIGIN, getHostMode } from '@/lib/host'

import { useOptionalAccessContext, waitlistEntryHref } from './app/accessShared'
import {
  ACCOUNT_ROUTES,
  ADMIN_CHILD_ROUTES,
  APP_ACCEPTED_ROUTES,
  EXPLORE_ROUTES,
  MARKETING_ONLY_ROUTES,
  renderPathRoutes,
} from './app/routeDefinitions'
import {
  AuthenticatedAppLayout,
  HostGuard,
  PublicAppLayout,
  SessionAcceptedRoute,
  getGenericNotFoundCta,
  marketingOnlyElement,
} from './app/routeGuards'
import {
  LazyAccessBoundary,
  LazyAuthWalletBoundary,
  LazyGuardedOutlet,
  LazyPrivyBoundary,
  LazyRequireAdmin,
  Leaderboard,
} from './app/lazyRoutes'
import { AdminLayout } from './components/layout/AdminLayout'
import { Layout } from './components/layout/Layout'

export {
  computeAcceptedFromAppAccessStatus,
  getInitialTelegramMiniAppEntryResolution,
  hasTelegramLinkEntryContext,
  hasTelegramLinkQueryContext,
  resolveAccess,
  resolveTelegramMiniAppEntryBootstrap,
} from './app/accessShared'
export { getGenericNotFoundCta } from './app/routeGuards'

function NotFoundPage() {
  const location = useLocation()
  const access = useOptionalAccessContext()
  const genericCta = useMemo(() => getGenericNotFoundCta(getHostMode()), [])

  const appCta = useMemo(() => {
    if (!access) return genericCta
    if (!access.sessionValid) {
      return {
        href: waitlistEntryHref(access.marketingUrl),
        label: 'Sign In',
        hint: 'Sign in to get started.',
      }
    }
    if (!access.accepted) {
      return {
        href: waitlistEntryHref(access.marketingUrl),
        label: 'Join Waitlist',
        hint: 'This route requires accepted app access.',
      }
    }
    const tradeHref = access.hostMode === 'marketing' ? APP_ORIGIN + '/swap' : '/swap'
    return {
      href: tradeHref,
      label: 'Go To Trade',
      hint: 'Your session is valid. Continue to the canonical app landing route.',
    }
  }, [access, genericCta])

  const isExternalHref =
    appCta.href.startsWith('http://') || appCta.href.startsWith('https://')

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">4626</div>
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl font-medium">Route Not Found</div>
          <div className="text-sm text-zinc-400">
            No page matches{' '}
            <span className="font-mono text-zinc-300">{location.pathname}</span>.
          </div>
          <div className="space-y-3">
            <div className="text-xs text-zinc-500">{appCta.hint}</div>
            <div className="flex flex-wrap gap-3">
              {isExternalHref ? (
                <a className="btn-accent btn-no-icon inline-flex" href={appCta.href}>
                  {appCta.label}
                </a>
              ) : (
                <Link className="btn-accent btn-no-icon inline-flex" to={appCta.href}>
                  {appCta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route
        element={
          <>
            <HostGuard />
            <Outlet />
          </>
        }
      >
        <Route path="/404" element={<NotFoundPage />} />

        <Route element={<Layout interactive={false} />}>
          {renderPathRoutes(MARKETING_ONLY_ROUTES, marketingOnlyElement)}
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        <Route
          element={<LazyGuardedOutlet guard={LazyAuthWalletBoundary} />}
        >
          <Route element={<AuthenticatedAppLayout />}>
            {renderPathRoutes(ACCOUNT_ROUTES)}
          </Route>
        </Route>

        <Route
          element={<LazyGuardedOutlet guard={LazyAccessBoundary} />}
        >
          <Route element={<PublicAppLayout />}>
            <Route element={<SessionAcceptedRoute />}>
              {renderPathRoutes(EXPLORE_ROUTES)}
            </Route>
          </Route>

          <Route
            element={<LazyGuardedOutlet guard={LazyPrivyBoundary} />}
          >
            <Route element={<AuthenticatedAppLayout />}>
              <Route element={<SessionAcceptedRoute />}>
                {renderPathRoutes(APP_ACCEPTED_ROUTES)}

                <Route element={<LazyGuardedOutlet guard={LazyRequireAdmin} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/waitlist" replace />} />
                    {renderPathRoutes(ADMIN_CHILD_ROUTES)}
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
