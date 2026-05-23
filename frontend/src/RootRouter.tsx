import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { APP_ORIGIN, MARKETING_ORIGIN, getHostMode, isCurrentWindowUrl } from '@/lib/env/host'
import { isAppOnlyPath } from '@/lib/auth/appOnlyPaths'
import { MarketingWaitlistRoute } from '@/app/routeGuards'
import { AppCanvas } from '@/components/layout/AppCanvas'
import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { getLoadingIntentFromPath } from '@/components/layout/appLoadingIntents'
import { Layout } from '@/components/layout/Layout'
import App from './App'
import { AppQueryProvider } from './web3/Web3Providers'

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
  const location = useLocation()
  const intent = getLoadingIntentFromPath(location.pathname)
  return <Suspense fallback={<AppLoadingState intent={intent} />}>{props.children}</Suspense>
}

const Home = lazyNamed(() => import('./pages/Home'), 'Home')
const WaitlistInviteEntry = lazyNamed(
  () => import('./pages/WaitlistInviteEntry'),
  'WaitlistInviteEntry',
)
const Waitlist = lazyNamed(() => import('./pages/Waitlist'), 'Waitlist')

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

  return <AppLoadingState intent="redirect" />
}

function AppHostRedirect(props: { target: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isCurrentWindowUrl(props.target)) return
    window.location.replace(props.target)
  }, [props.target])

  return <AppLoadingState intent="redirect" />
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
      <AppCanvas />
      {shouldRouteAppHostRootToMarketing ? (
        <AppHostRedirect target={marketingHomeTarget} />
      ) : shouldRouteToApp ? (
        <AppHostRedirect target={appRedirectTarget} />
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
    </>
  )
}
