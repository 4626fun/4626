import { Suspense, lazy, useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PublicWaitlistOverview } from '@/components/waitlist/PublicWaitlistOverview'
import { PageMeta } from '@/components/seo/PageMeta'
import { ShareDistributionSection } from '@/components/home/ShareDistributionSection'
import { StrategyAllocationSection } from '@/components/home/StrategyAllocationSection'
import { Modal } from '@/components/ui/Modal'
import { clearStoredWaitlistAuthState } from '@/lib/auth/waitlistEntry'
import { getHostMode } from '@/lib/host'
import { PrivyClientProvider } from '@/lib/privy/client'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { Web3Providers } from '@/web3/Web3Providers'

const LazyThinWaitlistFlow = lazy(async () => {
  const mod = await import('@/components/waitlist/ThinWaitlistFlow')
  return { default: mod.ThinWaitlistFlow }
})

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const DEFAULT_DEPOSIT_TOKENS = '50,000,000'
const DEFAULT_SHARE_TOKENS = `${DEFAULT_DEPOSIT_TOKENS} ${SHARE_TOKEN}`
const DEFAULT_AUCTION_WINDOW = '7 days'
const DEFAULT_AUCTION_EPOCH = 'Thursday 00:00 UTC'
const WAITLIST_JOURNEY_STEPS = ['Deposit', 'CCA launch', 'Allocate', 'Redeem'] as const

export function Home() {
  const hostMode = getHostMode()
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const showDeployVaultCta = hostMode === 'app'
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistAuthArmed, setWaitlistAuthArmed] = useState(false)
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

  const openWaitlistModal = useCallback(() => {
    clearStoredWaitlistAuthState()
    setWaitlistAuthArmed(false)
    setWaitlistModalOpen(true)
  }, [])

  const closeWaitlistModal = useCallback(() => {
    clearStoredWaitlistAuthState()
    setWaitlistAuthArmed(false)
    setWaitlistModalOpen(false)
  }, [])

  const openWaitlistEmailAuth = useCallback(() => {
    clearStoredWaitlistAuthState()
    setWaitlistAuthArmed(true)
  }, [])

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
              <button type="button" onClick={openWaitlistModal} className={heroCtaClass}>
                Join waitlist
                <ArrowRight className="h-4 w-4" />
              </button>
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
                  Minimum deposit: <span className="font-mono text-zinc-200">{DEFAULT_DEPOSIT_TOKENS} TOKEN</span>. In the default
                  launch, this mints <span className="font-mono text-brand-primary">{DEFAULT_SHARE_TOKENS}</span> and runs a{' '}
                  <span className="text-uniswap">Uniswap CCA</span> auction.
                </p>
                <p>
                  The auction opens on the weekly epoch reset at{' '}
                  <span className="font-mono text-zinc-200">{DEFAULT_AUCTION_EPOCH}</span> and runs for {DEFAULT_AUCTION_WINDOW}.
                </p>
                <p>
                  The deposited <span className="font-mono text-zinc-200">{DEFAULT_DEPOSIT_TOKENS} TOKEN</span> stays as the vault’s
                  underlying asset base, while the newly minted <span className="font-mono text-brand-primary">{DEFAULT_SHARE_TOKENS}</span>{' '}
                  gets split across launch distribution.
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
              <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_80px_-44px_rgba(0,82,255,0.35)] backdrop-blur-sm sm:p-6">
                <div className="text-[10px] font-medium text-zinc-600">Default launch mechanics</div>

                <div className="mt-4 space-y-0 sm:mt-6">
                  <div className="data-row">
                    <span className="label">Minimum deposit</span>
                    <div className="value mono text-sm sm:text-base">{DEFAULT_DEPOSIT_TOKENS} TOKEN</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Minted shares</span>
                    <div className="value mono text-sm sm:text-base text-brand-primary">{DEFAULT_SHARE_TOKENS}</div>
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
                      40 / 40 / 20
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <StrategyAllocationSection depositTokens={DEFAULT_DEPOSIT_TOKENS} />

      <ShareDistributionSection auctionEpoch={DEFAULT_AUCTION_EPOCH} shareTokens={DEFAULT_SHARE_TOKENS} />

      <section className="cinematic-section !py-10 sm:!py-24 lg:!py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="overflow-hidden rounded-[32px] border border-white/8 bg-linear-to-br from-white/[0.05] via-white/[0.025] to-transparent p-6 shadow-[0_28px_90px_-50px_rgba(0,82,255,0.32)] backdrop-blur-sm sm:p-8 lg:p-10"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
              <div className="space-y-4 sm:space-y-6">
                <span className="label">FAQ</span>
                <h2 className="headline mt-2 text-3xl sm:text-4xl lg:text-5xl">See the full walkthrough</h2>
                <p className="max-w-2xl text-[13px] font-light text-zinc-500 sm:text-sm">
                  The FAQ now carries the whole launch sequence in one place, from deposit mechanics through CCA launch, strategy
                  allocation, and redemption.
                </p>
                <div className="flex flex-wrap gap-2">
                  {WAITLIST_JOURNEY_STEPS.map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-300 sm:text-[11px]"
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-white/8 bg-black/35 p-5 sm:p-6">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">Read before launch</div>
                <p className="text-sm font-light leading-relaxed text-zinc-400">
                  If someone lands on the homepage and wants the full mechanics, this should be the bottom-of-page next step.
                </p>
                <div>
                  <Link to="/faq/how-it-works" className="btn-primary inline-flex items-center">
                    How it works
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Modal
        open={waitlistModalOpen}
        onClose={closeWaitlistModal}
        title="Join waitlist"
        description="Sign up for the waitlist by verifying your email address."
        maxWidth={waitlistAuthArmed ? 'sm:max-w-4xl' : 'sm:max-w-xl'}
        placement="center"
        className="border border-white/10 bg-black/90"
      >
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
                <LazyThinWaitlistFlow variant="modal" sectionId="home-waitlist" autoStartAuth />
              </PrivyClientProvider>
            </Web3Providers>
          </Suspense>
        ) : (
          <PublicWaitlistOverview
            referralCode={null}
            onContinueWithEmail={openWaitlistEmailAuth}
            primaryButtonClassName={heroCtaClass}
          />
        )}
      </Modal>
    </div>
  )
}
