import { Suspense, lazy, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import {
  DEFAULT_DEPOSIT_TOKENS,
} from '@/components/home/launchConfig'
import { VaultFlowScroll } from '@/components/home/VaultFlowScroll'
import {
  clearStoredWaitlistAuthState,
  clearStoredWaitlistReferralCode,
  consumeStoredWaitlistAuthArmed,
  consumeStoredWaitlistAuthAutoStart,
} from '@/lib/auth/waitlistEntry'
import { getHostMode } from '@/lib/host'
import { PrivyClientProvider } from '@/lib/privy/client'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { Web3Providers } from '@/web3/Web3Providers'

const LazyThinWaitlistFlow = lazy(async () => {
  const mod = await import('@/components/waitlist/ThinWaitlistFlow')
  return { default: mod.ThinWaitlistFlow }
})

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const DEFAULT_SHARE_TOKENS = `${DEFAULT_DEPOSIT_TOKENS} ${SHARE_TOKEN}`
const WAITLIST_JOURNEY_STEPS = ['Deposit', 'CCA launch', 'Allocate', 'Redeem'] as const

export function Home() {
  const hostMode = getHostMode()
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const [initialWaitlistState] = useState(() => {
    const autoStart = consumeStoredWaitlistAuthAutoStart()
    const open = consumeStoredWaitlistAuthArmed() || autoStart
    return { open, autoStart }
  })
  const [waitlistInlineOpen, setWaitlistInlineOpen] = useState(initialWaitlistState.open)
  const [waitlistAutoStart] = useState(initialWaitlistState.autoStart)
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

  const openWaitlistDirectAuth = () => {
    clearStoredWaitlistAuthState()
    clearStoredWaitlistReferralCode()
    setWaitlistInlineOpen(true)
  }

  if (hostMode === 'app') {
    return <Navigate to="/swap" replace />
  }

  return (
    <div className="relative">
      <PageMeta
        title="4626.fun - Creator Vaults"
        description="Deposit creator coins into vaults on Base. Earn from trading fees. Everyone earns together."
        canonicalPath="/"
      />

      <div className="particles">
        <div
          className="absolute left-1/3 top-1/4 h-px w-px rounded-full bg-brand-primary"
          style={{ animation: 'particle-float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute right-1/4 top-1/2 h-px w-px rounded-full bg-brand-primary/80"
          style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-1/3 left-1/2 h-px w-px rounded-full bg-brand-primary/60"
          style={{ animation: 'particle-float 12s ease-in-out infinite', animationDelay: '4s' }}
        />
      </div>

      <section className="cinematic-section no-divider-bottom !py-16 sm:!py-24 lg:!py-28 min-h-screen flex items-center justify-center relative">
        <div className="mx-auto max-w-7xl space-y-8 px-4 text-center sm:px-6 sm:space-y-14">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-3"
          >
            <div className="status-active">
              <span className="label">Live on Base</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.428 }}
            className="space-y-4 sm:space-y-6"
          >
            <h1 className="headline text-4xl leading-[0.94] tracking-[-0.05em] sm:text-6xl md:text-7xl lg:text-[7.5rem] xl:text-[8.25rem]">
              Turn Creator Coins
              <br />
              <span className="glow-brand">Into Earnings</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.856 }}
            className="mx-auto max-w-2xl text-base font-light tracking-wide text-zinc-400 sm:text-xl"
          >
            Deposit tokens · Earn from trades · Grow together
          </motion.p>

          {showJoinWaitlistCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.12 }}
              className="pt-2 sm:pt-6"
            >
              {waitlistInlineOpen ? (
                <div className="mx-auto w-full max-w-3xl text-left">
                  <Suspense
                    fallback={
                      <div className="rounded-[28px] border border-white/10 bg-black/45 px-4 py-6 text-sm text-zinc-300 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.95)] backdrop-blur-md sm:px-6">
                        Loading waitlist…
                      </div>
                    }
                  >
                    <PrivyClientProvider showWalletLoginFirst={false}>
                      <Web3Providers>
                        <div className="rounded-[28px] bg-black/45 p-4 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.95)] backdrop-blur-md sm:p-6 lg:p-8">
                          <LazyThinWaitlistFlow
                            variant="embedded"
                            sectionId="home-waitlist"
                            autoStartAuth={waitlistAutoStart}
                          />
                        </div>
                      </Web3Providers>
                    </PrivyClientProvider>
                  </Suspense>
                </div>
              ) : (
                <button type="button" onClick={openWaitlistDirectAuth} className={heroCtaClass}>
                  Join waitlist
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          ) : null}

          {showExploreCreatorsCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.12 }}
              className="pt-2 sm:pt-6"
            >
              <Link to="/explore/creators" className={heroCtaClass}>
                Explore Creators
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : null}
        </div>

        {/* Scroll cue — anchored to hero bottom, desktop only */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-8 hidden flex-col items-center gap-2 sm:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <motion.div
            className="flex flex-col items-center gap-2"
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.26em] text-zinc-600">
              Scroll to explore
            </p>
            <div className="h-7 w-px rounded-full bg-gradient-to-b from-zinc-700/60 to-transparent" />
            <svg width="9" height="5" viewBox="0 0 9 5" fill="none" aria-hidden="true">
              <path d="M1 1L4.5 4L8 1" stroke="rgba(120,120,140,0.5)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>

        {/* Bottom fade — blends hero into VaultFlowScroll */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 sm:h-40"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--color-vault-bg, #020202))' }}
          aria-hidden="true"
        />
      </section>

      <VaultFlowScroll depositTokens={DEFAULT_DEPOSIT_TOKENS} shareTokens={DEFAULT_SHARE_TOKENS} />

      <section className="cinematic-section !py-10 sm:!py-24 lg:!py-32">
        <div className="mx-auto max-w-5xl space-y-10 px-4 sm:space-y-14 sm:px-6">
          {/* ── FAQ */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid gap-8 rounded-[28px] bg-white/[0.015] p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:p-8"
          >
            <div className="space-y-4 sm:space-y-6">
              <span className="label">FAQ</span>
              <h2 className="headline mt-2 text-3xl sm:text-4xl lg:text-5xl">Read the full launch flow</h2>
              <p className="max-w-2xl text-[13px] font-light text-zinc-500 sm:text-sm">
                One concise walkthrough covering deposit mechanics, CCA launch, strategy allocation, and redemptions.
              </p>
              <div className="flex flex-wrap gap-2">
                {WAITLIST_JOURNEY_STEPS.map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-300 sm:text-[11px]"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/6 bg-black/10 p-4 sm:p-5 lg:max-w-sm lg:justify-self-end">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Before you launch</div>
              <p className="text-sm font-light leading-relaxed text-zinc-400">
                Use this as the final homepage step when you want the complete mechanics in one place.
              </p>
              <div>
                <Link to="/faq/how-it-works" className="btn-primary btn-no-icon inline-flex items-center">
                  How it works
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

    </div>
  )
}
