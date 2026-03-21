import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { APP_ORIGIN, getHostMode } from '@/lib/host'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { AppLoadingState } from '@/components/AppLoadingState'
import { Home } from './pages/Home'

const ProtectedApp = lazy(async () => import('./ProtectedApp'))

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
        <Route path="/" element={<Home />} />
        <Route
          path="*"
          element={
            <Suspense fallback={<AppLoadingState />}>
              <ProtectedApp />
            </Suspense>
          }
        />
      </Routes>
    </>
  )
}
