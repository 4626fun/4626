import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { VaultFlowRoot } from '@/components/home/vault-flow/VaultFlowRoot'
import { STORY_CONTENT } from '@/components/home/vault-flow/model/storyContent'
import { getHostMode } from '@/lib/host'

const DEFAULT_DEPOSIT_TOKENS = STORY_CONTENT.defaultDepositTokens
const DEFAULT_SHARE_TOKENS = `${DEFAULT_DEPOSIT_TOKENS} ${STORY_CONTENT.shareTokenSymbol}`
const WAITLIST_JOURNEY_STEPS = ['Deposit', 'CCA launch', 'Allocate', 'Redeem'] as const

export function Home() {
  const hostMode = getHostMode()
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

  if (hostMode === 'app') {
    return <Navigate to="/swap" replace />
  }

  return (
    <div className="relative">
      <PageMeta
        title="4626.fun — Creator Vaults on Base"
        description="Deposit your creator coin once. Earn trading fees, yield, and lottery rewards — shared with every holder."
        canonicalPath="/"
      />

      <section className="cinematic-section no-divider-bottom !py-16 sm:!py-24 lg:!py-28 min-h-screen flex items-center justify-center relative z-10">
        <div className="mx-auto max-w-4xl space-y-8 px-4 text-center sm:px-6 sm:space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3"
          >
            <div className="status-active">
              <span className="label">Live on Base</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="headline text-4xl leading-[0.94] tracking-[-0.05em] sm:text-6xl md:text-7xl lg:text-[5.75rem] xl:text-[6.5rem]">
              <span className="whitespace-nowrap">Turn Creator Coins</span>
              <br />
              <span className="glow-brand">Into Earnings</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mx-auto max-w-lg text-[15px] font-light leading-relaxed text-zinc-500 sm:text-lg"
          >
            Deposit once. Earn from every trade, forever.
          </motion.p>

          {showJoinWaitlistCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="pt-2 sm:pt-4"
            >
              <Link to="/waitlist" className={heroCtaClass}>
                Join waitlist
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : null}

          {showExploreCreatorsCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="pt-2 sm:pt-4"
            >
              <Link to="/explore/creators" className={heroCtaClass}>
                Explore Creators
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : null}
        </div>

        {/* Bottom fade — blends hero into VaultFlowScroll */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 sm:h-40"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--color-vault-bg, #020202))' }}
          aria-hidden="true"
        />
      </section>

      <VaultFlowRoot depositTokens={DEFAULT_DEPOSIT_TOKENS} shareTokens={DEFAULT_SHARE_TOKENS} />

      {/* How it works — 4 clean steps */}
      <section className="cinematic-section !py-14 sm:!py-24 lg:!py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-col items-center gap-12"
          >
            <div className="text-center space-y-2">
              <span className="label">How it works</span>
              <h2 className="headline text-2xl sm:text-3xl lg:text-4xl mt-2">Four steps. No complexity.</h2>
            </div>

            <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
              {WAITLIST_JOURNEY_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col gap-2">
                  <span className="font-mono text-[9px] tracking-[0.22em] text-zinc-700">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-sm font-medium text-white">{step}</h3>
                  <div className="h-px w-6 bg-white/10" />
                </div>
              ))}
            </div>

            <Link
              to="/faq/how-it-works"
              className="btn-secondary btn-no-icon inline-flex items-center gap-2 text-xs"
            >
              Read the full launch flow
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
