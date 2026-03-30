import { Suspense, lazy, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import {
  DEFAULT_AUCTION_EPOCH,
  DEFAULT_AUCTION_WINDOW,
  DEFAULT_DEPOSIT_TOKENS,
  SHARE_SPLIT_LABEL,
} from '@/components/home/launchConfig'
import { ShareDistributionSection } from '@/components/home/ShareDistributionSection'
import { StrategyAllocationSection } from '@/components/home/StrategyAllocationSection'
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
  const showDeployVaultCta = hostMode === 'app'
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

      <section className="cinematic-section !py-16 sm:!py-24 lg:!py-28 min-h-[68vh] sm:min-h-[82vh] flex items-center justify-center">
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
                    <Web3Providers>
                      <PrivyClientProvider showWalletLoginFirst={false}>
                        <div className="rounded-[28px] border border-white/10 bg-black/45 p-4 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.95)] backdrop-blur-md sm:p-6 lg:p-8">
                          <LazyThinWaitlistFlow
                            variant="embedded"
                            sectionId="home-waitlist"
                            autoStartAuth={waitlistAutoStart || waitlistInlineOpen}
                            suppressAuthShell
                          />
                        </div>
                      </PrivyClientProvider>
                    </Web3Providers>
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
      </section>

      <section className="cinematic-section !py-10 sm:!py-16 lg:!py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid items-start gap-8 sm:gap-16 lg:grid-cols-2 lg:items-center lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-4 sm:space-y-8"
            >
              <span className="label">For Creators</span>
              <h2 className="headline text-3xl leading-tight sm:text-5xl lg:text-6xl">
                Launch Your
                <br />
                <span className="glow-brand">Vault</span>
              </h2>
              <div className="inline-flex items-center gap-2 text-[10px] font-medium text-zinc-600">
                <span>Powered by</span>
                <img
                  src="/protocols/uniswap.svg"
                  alt="Uniswap"
                  width={16}
                  height={16}
                  className="h-4 w-4 opacity-80"
                  loading="lazy"
                />
                <span className="text-uniswap">Uniswap</span>
              </div>
              <div className="space-y-3 text-base font-light leading-relaxed text-zinc-500 sm:text-lg">
                <p>
                  Launch starts with <span className="font-mono text-zinc-200">{DEFAULT_DEPOSIT_TOKENS} TOKEN</span>, minting{' '}
                  <span className="font-mono text-brand-primary">{DEFAULT_SHARE_TOKENS}</span> for a{' '}
                  <span className="text-uniswap">Uniswap CCA</span> auction.
                </p>
                <p>
                  Auctions open weekly at <span className="font-mono text-zinc-200">{DEFAULT_AUCTION_EPOCH}</span> and run for{' '}
                  {DEFAULT_AUCTION_WINDOW}. The deposit remains vault principal while minted shares are allocated across launch
                  distribution.
                </p>
              </div>
              {showDeployVaultCta ? (
                <div>
                  <Link to="/deploy" className={heroCtaClass}>
                    Deploy Vault
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-0"
            >
              <div
                className="space-y-0 rounded-2xl border border-white/6 bg-white/[0.015] px-4 py-3 sm:px-5 sm:py-4"
                data-launch-section="launch-profile"
              >
                <div className="label text-[9px] sm:text-[10px]">Launch profile</div>

                <div className="mt-3 space-y-0 sm:mt-4">
                  <div className="data-row">
                    <span className="label">Minimum deposit</span>
                    <div className="value mono text-sm sm:text-base" data-launch-key="depositTokens">
                      {DEFAULT_DEPOSIT_TOKENS} TOKEN
                    </div>
                  </div>
                  <div className="data-row">
                    <span className="label">Minted shares</span>
                    <div className="value mono text-sm sm:text-base text-brand-primary" data-launch-key="shareTokens">
                      {DEFAULT_SHARE_TOKENS}
                    </div>
                  </div>
                  <div className="data-row">
                    <span className="label">Auction window</span>
                    <div className="value mono text-sm sm:text-base">{DEFAULT_AUCTION_WINDOW}</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Launch epoch</span>
                    <div className="value mono text-sm sm:text-base">{DEFAULT_AUCTION_EPOCH}</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Share split</span>
                    <div className="value mono text-right text-[11px] leading-relaxed text-sm sm:text-base">
                      {SHARE_SPLIT_LABEL}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <ShareDistributionSection auctionEpoch={DEFAULT_AUCTION_EPOCH} shareTokens={DEFAULT_SHARE_TOKENS} />

      <StrategyAllocationSection depositTokens={DEFAULT_DEPOSIT_TOKENS} />

      <section className="cinematic-section !py-10 sm:!py-24 lg:!py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid gap-8 rounded-[28px] border border-white/6 bg-white/[0.015] p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:p-8"
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
