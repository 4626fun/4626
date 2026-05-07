import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { VaultFlowRoot } from '@/features/home/vault-flow/VaultFlowRoot'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'
import { getHostMode, MARKETING_ORIGIN } from '@/lib/env/host'

const DEFAULT_DEPOSIT_TOKENS = STORY_CONTENT.defaultDepositTokens
const DEFAULT_SHARE_TOKENS = `${DEFAULT_DEPOSIT_TOKENS} ${STORY_CONTENT.shareTokenSymbol}`
const WAITLIST_JOURNEY_STEPS = [
  { label: 'Deposit',       sub: `${STORY_CONTENT.defaultDepositTokens} ${STORY_CONTENT.creatorTokenSymbol.toLowerCase()} opens the vault` },
  { label: 'Mint ■AKITA',  sub: 'vault share tokens are issued to depositors' },
  { label: 'CCA',           sub: 'shares distributed to the public over 7 days' },
  { label: 'Route strategies',    sub: 'deposited tokens enter variable strategy infrastructure' },
] as const

export function Home() {
  const hostMode = getHostMode()
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'
  const homeStructuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: '4626.fun',
          url: 'https://4626.fun/',
        },
        {
          '@type': 'WebPage',
          name: META.home.title,
          url: 'https://4626.fun/',
          description: META.home.description,
        },
      ],
    }),
    [],
  )

  if (hostMode === 'app') {
    return <Navigate to="/swap" replace />
  }

  // When the SPA renders "/" on the marketing host (e.g. via bfcache or mobile
  // desktop-mode cache), redirect to the immersive landing page served by Vercel
  // at the domain root. A hard navigation ensures we exit the SPA shell.
  if (hostMode === 'marketing' && typeof window !== 'undefined') {
    window.location.replace(MARKETING_ORIGIN)
    return null
  }

  return (
    <div className="relative">
      <PageMeta
        title={META.home.title}
        description={META.home.description}
        canonicalPath="/"
        structuredData={homeStructuredData}
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
            <span className="whitespace-nowrap">ERC-4626 Creator Vaults</span>
              <br />
            <span className="glow-brand">On Base</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mx-auto max-w-lg text-[15px] font-light leading-relaxed text-zinc-500 sm:text-lg"
          >
            Turn creator coins into redeemable vault shares. Experimental software. Vaults are not live yet.
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

      {/* How it works — footer summary */}
      <section className="relative !py-20 sm:!py-28 lg:!py-36 overflow-hidden">
        {/* top rule — bridges the dark scroll narrative above */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        {/* subtle ambient wash */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 flex flex-col items-center gap-14">

          {/* label + headline */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-3"
          >
            <span className="label">How it works</span>
            <h2 className="headline text-2xl sm:text-3xl lg:text-4xl mt-2">
              Deposit. Mint. Distribute. Route.
            </h2>
          </motion.div>

          {/* steps — each staggered individually */}
          <div className="grid w-full grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-10">
            {WAITLIST_JOURNEY_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.10 }}
                className="flex flex-col gap-2.5"
              >
                <span className="font-mono text-[9px] tracking-[0.22em] text-zinc-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-sm font-medium text-white">{step.label}</h3>
                <div className="h-px w-6 bg-white/10" />
                <p className="text-[11px] leading-relaxed text-zinc-600 font-light">{step.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <Link
              to="/faq/how-it-works"
              className="btn-secondary btn-no-icon inline-flex items-center gap-2 text-xs"
            >
              Learn more about the launch flow
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>

        </div>
      </section>

    </div>
  )
}
