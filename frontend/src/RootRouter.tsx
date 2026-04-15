import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { APP_ORIGIN, getHostMode, isCurrentWindowUrl } from '@/lib/env/host'
import { isAppOnlyPath } from '@/lib/auth/appOnlyPaths'
import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { getLoadingIntentFromPath } from '@/components/layout/appLoadingIntents'
import { Layout } from '@/components/layout/Layout'

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
const LazyProtectedAppBoundary = lazy(async () => {
  const [appModule, web3Module] = await Promise.all([
    import('./App'),
    import('./web3/Web3Providers'),
  ])
  const App = appModule.default
  const AppQueryProvider = web3Module.AppQueryProvider
  return {
    default: function ProtectedAppBoundary() {
      return (
        <AppQueryProvider>
          <App />
        </AppQueryProvider>
      )
    },
  }
})

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
  const isMarketingHost = getHostMode() === 'marketing'
  const appRedirectTarget = `${APP_ORIGIN}${location.pathname}${location.search}${location.hash}`
  const shouldRouteToApp =
    isMarketingHost &&
    isAppOnlyPath(location.pathname) &&
    !isCurrentWindowUrl(appRedirectTarget)

  return (
    <>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl shadow-void text-sm',
            success: 'border-emerald-400/20',
            error: 'border-rose-400/20',
            warning: 'border-amber-400/20',
            info: 'border-cyan-400/20',
          },
        }}
      />

      {shouldRouteToApp ? (
        <AppHostRedirect target={appRedirectTarget} />
      ) : (
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/waitlist" element={<Waitlist />} />
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
                <LazyProtectedAppBoundary />
              </LazyRouteBoundary>
            }
          />
        </Routes>
      )}
    </>
  )
}
