import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { APP_ORIGIN, MARKETING_ORIGIN, getHostMode, isCurrentWindowUrl } from '@/lib/env/host'
import { isAppOnlyPath } from '@/lib/auth/appOnlyPaths'
import { MarketingWaitlistRoute } from '@/app/routeGuards'
import { AppCanvas } from '@/components/layout/AppCanvas'
import { AppLoadingOverlay, AppLoadingProvider, AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { Layout } from '@/components/layout/Layout'
import { apiFetch } from '@/lib/api/apiBase'
import { AppQueryProvider } from './web3/AppQueryProvider'

function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType<any> }
  })
}

function LazyRouteBoundary(props: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingRegistrar label="root-route-suspense" />}>{props.children}</Suspense>
}

const Home = lazyNamed(() => import('./pages/Home'), 'Home')
const WaitlistInviteEntry = lazyNamed(
  () => import('./pages/WaitlistInviteEntry'),
  'WaitlistInviteEntry',
)
const Waitlist = lazyNamed(() => import('./pages/Waitlist'), 'Waitlist')
const App = lazyNamed(() => import('./App'), 'default')

function ProtectedAppBoundary() {
  return (
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  )
}

function StandaloneDocumentRedirect(props: { htmlPath: '/telegram-link.html' }) {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.location.replace(`${props.htmlPath}${location.search}${location.hash}`)
  }, [location.hash, location.search, props.htmlPath])

  return <AppLoadingRegistrar label="standalone-doc-redirect" />
}

type AuthHandoffCreateResponse = {
  code: string
}

const AUTH_HANDOFF_QUERY_KEY = 'cv_handoff'

async function createCrossHostHandoffCode(): Promise<string> {
  const response = await apiFetch('/api/auth/handoff/create', {
    method: 'POST',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  }).catch(() => null)
  if (!response?.ok) return ''

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: AuthHandoffCreateResponse | null }
    | null
  if (!payload?.success) return ''
  const code = typeof payload.data?.code === 'string' ? payload.data.code.trim() : ''
  return code || ''
}

function AppHostRedirect(props: { target: string; withSessionHandoff?: boolean }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    void (async () => {
      let nextTarget = props.target

      if (props.withSessionHandoff) {
        try {
          const parsed = new URL(nextTarget)
          if (!parsed.searchParams.has(AUTH_HANDOFF_QUERY_KEY)) {
            const handoffCode = await createCrossHostHandoffCode()
            if (handoffCode) {
              parsed.searchParams.set(AUTH_HANDOFF_QUERY_KEY, handoffCode)
              nextTarget = parsed.toString()
            }
          }
        } catch {
          nextTarget = props.target
        }
      }

      if (cancelled) return
      if (isCurrentWindowUrl(nextTarget)) return
      window.location.replace(nextTarget)
    })()

    return () => {
      cancelled = true
    }
  }, [props.target, props.withSessionHandoff])

  return <AppLoadingRegistrar label="app-host-redirect" />
}

function MarketingLayout() {
  return <Layout interactive={false} chatEnabled={false} />
}

export function RootRouter() {
  const location = useLocation()
  const hostMode = getHostMode()
  const isMarketingHost = hostMode === 'marketing'
  const appRedirectTarget = `${APP_ORIGIN}${location.pathname}${location.search}${location.hash}`
  const shouldRouteToApp =
    isMarketingHost &&
    isAppOnlyPath(location.pathname) &&
    !isCurrentWindowUrl(appRedirectTarget)
  const marketingHomeTarget = `${MARKETING_ORIGIN}${location.pathname}${location.search}${location.hash}`
  const shouldRouteAppHostRootToMarketing =
    hostMode === 'app' &&
    location.pathname === '/' &&
    !isCurrentWindowUrl(marketingHomeTarget)

  return (
    <>
      <AppLoadingProvider>
        <AppCanvas />
        <AppLoadingOverlay />
        {shouldRouteAppHostRootToMarketing ? (
        <AppHostRedirect target={marketingHomeTarget} />
      ) : shouldRouteToApp ? (
        <AppHostRedirect target={appRedirectTarget} withSessionHandoff />
      ) : (
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/waitlist"
              element={
                <MarketingWaitlistRoute>
                  <Waitlist />
                </MarketingWaitlistRoute>
              }
            />
            <Route path="/r/:referralCode" element={<WaitlistInviteEntry />} />
          </Route>

          {['/telegram/link', '/telegram/menu'].map((path) => (
            <Route
              key={path}
              path={path}
              element={<StandaloneDocumentRedirect htmlPath="/telegram-link.html" />}
            />
          ))}

          <Route
            path="*"
            element={
              <LazyRouteBoundary>
                <ProtectedAppBoundary />
              </LazyRouteBoundary>
            }
          />
        </Routes>
      )}
      </AppLoadingProvider>
    </>
  )
}
