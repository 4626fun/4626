import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { APP_ORIGIN, getHostMode } from '@/lib/host'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { Home } from './pages/Home'

const ProtectedApp = lazy(async () => import('./ProtectedApp'))

function LoadingAppShell() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="card rounded-xl p-8 space-y-3">
          <div className="text-lg font-medium">Loading app…</div>
          <div className="text-sm text-zinc-400">Preparing wallet and session providers.</div>
        </div>
      </div>
    </div>
  )
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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="*"
        element={
          <Suspense fallback={<LoadingAppShell />}>
            <ProtectedApp />
          </Suspense>
        }
      />
    </Routes>
  )
}
