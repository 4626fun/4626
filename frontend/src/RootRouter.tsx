import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { APP_ORIGIN, getHostMode } from '@/lib/host'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { AppLoadingState } from '@/components/AppLoadingState'
import { Layout } from '@/components/Layout'

const Home = lazy(async () => {
  const m = await import('./pages/Home')
  return { default: m.Home }
})
const WaitlistInviteEntry = lazy(async () => {
  const m = await import('./pages/WaitlistInviteEntry')
  return { default: m.WaitlistInviteEntry }
})
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

  return <AppLoadingState />
}

export function RootRouter() {
  const location = useLocation()
  const mode = getHostMode()
  const shouldRouteToApp = mode === 'marketing' && isAppOnlyPath(location.pathname)
  if (shouldRouteToApp) {
    if (typeof window !== 'undefined') {
      window.location.replace(`${APP_ORIGIN}${location.pathname}${location.search}${location.hash}`)
    }
    return null
  }

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
      <Routes>
        <Route
          element={<Layout interactive={false} chatEnabled={false} />}
        >
          <Route path="/" element={<Home />} />
          <Route path="/r/:referralCode" element={<WaitlistInviteEntry />} />
        </Route>
        <Route
          path="/telegram/link"
          element={<StandaloneDocumentRedirect htmlPath="/telegram-link.html" />}
        />
        <Route
          path="/telegram/menu"
          element={<StandaloneDocumentRedirect htmlPath="/telegram-link.html" />}
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<AppLoadingState />}>
              <LazyProtectedAppBoundary />
            </Suspense>
          }
        />
      </Routes>
    </>
  )
}
