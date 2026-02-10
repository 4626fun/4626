import { Navigate, useLocation } from 'react-router-dom'
import { WaitlistFlow } from '@/components/waitlist/WaitlistFlow'
import { isPublicSiteMode } from '@/lib/flags'
import { getHostMode } from '@/lib/host'

export function Waitlist() {
  const location = useLocation()
  const hostMode = getHostMode()
  const reason = new URLSearchParams(location.search).get('reason')
  // Local dev: render the waitlist flow in-app so you can iterate on UI at /waitlist.
  if (import.meta.env.DEV) return <WaitlistFlow variant="page" />

  // Back-compat: waitlist lives on marketing, but public-mode app hosts an embedded waitlist section.
  const publicMode = isPublicSiteMode()
  const showPending = hostMode === 'app' && !publicMode && reason === 'needs-acceptance'
  if (showPending) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 p-8 text-center space-y-4">
          <div className="label">Waitlist</div>
          <h1 className="headline text-2xl sm:text-3xl">You're on the waitlist</h1>
          <p className="text-sm text-zinc-400">
            Access is granted in batches. We&apos;ll email you as soon as you&apos;re approved.
          </p>
          <a className="btn-accent inline-flex justify-center" href="https://4626.fun/#waitlist">
            View waitlist status
          </a>
        </div>
      </div>
    )
  }
  if (publicMode) return <Navigate to="/#waitlist" replace />

  // Non-public app: keep users in-app instead of forcing a domain redirect.
  return <WaitlistFlow variant="page" />
}

