import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { PublicWaitlistOverview } from '@/components/waitlist/PublicWaitlistOverview'
import {
  buildCanonicalMarketingWaitlistUrl,
  clearStoredWaitlistAuthState,
  clearStoredWaitlistReferralCode,
  consumeStoredWaitlistAuthAutoStart,
  getCanonicalMarketingWaitlistPath,
  readStoredWaitlistReferralCode,
  readStoredWaitlistAuthArmed,
  writeStoredWaitlistAuthArmed,
} from '@/lib/auth/waitlistEntry'
import { getHostMode, getMarketingBaseUrl } from '@/lib/host'
import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'

const LazyThinWaitlistFlow = lazy(async () => {
  const mod = await import('@/components/waitlist/ThinWaitlistFlow')
  return { default: mod.ThinWaitlistFlow }
})
const PRIMARY_BUTTON_CLASS =
  'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

export function WaitlistPage() {
  const hostMode = getHostMode()
  const [waitlistAuthArmed, setWaitlistAuthArmed] = useState(() => readStoredWaitlistAuthArmed())
  const [autoStartAuth, setAutoStartAuth] = useState(() => consumeStoredWaitlistAuthAutoStart())
  const activeReferralCode = readStoredWaitlistReferralCode()

  if (hostMode === 'app') {
    if (typeof window !== 'undefined') {
      window.location.replace(buildCanonicalMarketingWaitlistUrl(getMarketingBaseUrl()))
    }
    return null
  }

  const openWaitlistAuth = () => {
    writeStoredWaitlistAuthArmed(true)
    setWaitlistAuthArmed(true)
    setAutoStartAuth(true)
  }

  const leaveWaitlist = () => {
    clearStoredWaitlistAuthState()
    clearStoredWaitlistReferralCode()
    setWaitlistAuthArmed(false)
    setAutoStartAuth(false)
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <PageMeta
        title="4626.fun - Waitlist"
        description="Sign up for the 4626 waitlist by verifying your email address."
        canonicalPath={getCanonicalMarketingWaitlistPath()}
      />

      <section className="cinematic-section !py-14 sm:!py-20 lg:!py-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="label">Waitlist</div>
              <h1 className="headline text-3xl leading-tight sm:text-5xl lg:text-6xl">
                Sign up for
                <br />
                the waitlist
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
                Verify your email here first. Your referral link and waitlist ranking unlock after signup is complete.
              </p>
            </div>
            <Link
              to="/"
              onClick={leaveWaitlist}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back home
            </Link>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/40 p-3.5 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.95)] backdrop-blur-md sm:rounded-[28px] sm:p-6 lg:p-8">
            {waitlistAuthArmed ? (
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-zinc-300">
                    Loading waitlist…
                  </div>
                }
              >
                <Web3Providers>
                  <PrivyClientProvider showWalletLoginFirst={false}>
                    <LazyThinWaitlistFlow variant="page" sectionId="waitlist-flow" autoStartAuth={autoStartAuth} />
                  </PrivyClientProvider>
                </Web3Providers>
              </Suspense>
            ) : (
              <PublicWaitlistOverview
                referralCode={activeReferralCode}
                onContinueWithEmail={openWaitlistAuth}
                primaryButtonClassName={PRIMARY_BUTTON_CLASS}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
