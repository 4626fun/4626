import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'

const DEFAULT_DEPOSIT_TOKENS = STORY_CONTENT.defaultDepositTokens
const DEFAULT_AUCTION_WINDOW = STORY_CONTENT.defaultAuctionWindow
const DEFAULT_AUCTION_EPOCH = STORY_CONTENT.defaultAuctionEpoch
const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const SHARE_TOKENS = `${DEFAULT_DEPOSIT_TOKENS} ${SHARE_TOKEN}`
const CCA_AMOUNT = '20,000,000'
const CCA_PERCENT = '40%'

const MECHANIC_ROWS = [
  { label: 'Allocation', value: `${CCA_PERCENT} of minted shares` },
  { label: 'Token amount', value: `${CCA_AMOUNT} ${SHARE_TOKEN}` },
  { label: 'Auction window', value: DEFAULT_AUCTION_WINDOW },
  { label: 'Launch epoch', value: DEFAULT_AUCTION_EPOCH },
  { label: 'Mechanism', value: 'Uniswap Concentrated CCA' },
  { label: 'Price discovery', value: 'Market-driven, open bidding' },
]

export function DistributeCcaLaunch() {
  return (
    <div className="relative min-h-screen">
      <PageMeta
        title="CCA Launch Distribution · 4626.fun"
        description={`${CCA_AMOUNT} ${SHARE_TOKEN} (${CCA_PERCENT} of the minted supply) is allocated to a weekly Uniswap CCA auction for market price discovery.`}
        canonicalPath="/cca"
      />

      {/* Back nav */}
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>

      {/* Hero */}
      <section className="cinematic-section no-divider-bottom !py-16 sm:!py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="label">Distribution · CCA Launch</span>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">
                <img src="/protocols/uniswap.svg" alt="Uniswap" className="h-3.5 w-3.5 opacity-80" loading="lazy" />
                <span className="text-[10px] font-medium text-uniswap">Powered by Uniswap</span>
              </div>
            </div>

            <h1 className="headline text-4xl leading-tight tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Uniswap CCA
              <br />
              <span className="glow-brand">Launch Auction</span>
            </h1>

            <p className="max-w-2xl text-base font-light leading-relaxed text-zinc-400 sm:text-lg">
              The largest share of minted tokens —{' '}
              <span className="font-mono text-brand-primary">{CCA_AMOUNT} {SHARE_TOKEN}</span>{' '}
              ({CCA_PERCENT}) — flows into a Uniswap Concentrated Creator Auction every Thursday,
              creating transparent, market-driven price discovery for the creator coin.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Key mechanics grid */}
      <section className="cinematic-section no-divider-top !py-10 sm:!py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">

            {/* Big number + visual */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="flex flex-col justify-center space-y-5"
            >
              <div
                className="flex flex-col items-start gap-1 rounded-[20px] border border-brand-primary/14 bg-gradient-to-br from-brand-primary/[0.07] via-brand-primary/[0.03] to-transparent p-6 sm:p-8"
                style={{ boxShadow: '0 24px 80px -40px rgb(var(--brand-primary) / 0.3)' }}
              >
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
                  Allocated
                </span>
                <p
                  className="font-mono font-black leading-none"
                  style={{
                    fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
                    background: 'linear-gradient(135deg, #4080ff 0%, #0052ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: 'none',
                  }}
                >
                  {CCA_PERCENT}
                </p>
                <p className="mt-1 font-mono text-sm text-brand-primary/60">{CCA_AMOUNT} {SHARE_TOKEN}</p>
                <p className="mt-3 text-[12px] font-light leading-relaxed text-zinc-500">
                  of the {SHARE_TOKENS} minted supply routed to the launch auction.
                </p>
              </div>
            </motion.div>

            {/* Mechanics table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="space-y-0 rounded-2xl border border-white/6 bg-white/[0.015] px-4 py-3 sm:px-5 sm:py-4"
            >
              <div className="label text-[9px] sm:text-[10px]">Auction mechanics</div>
              <div className="mt-3 space-y-0 sm:mt-4">
                {MECHANIC_ROWS.map((row) => (
                  <div key={row.label} className="data-row">
                    <span className="label">{row.label}</span>
                    <span className="value mono text-sm sm:text-base">{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="cinematic-section !py-10 sm:!py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="space-y-8"
          >
            <div>
              <span className="label">How it works</span>
              <h2 className="headline mt-3 text-2xl sm:text-3xl lg:text-4xl">
                Weekly price discovery on-chain
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Deposit & Mint',
                  body: `Creator deposits ${DEFAULT_DEPOSIT_TOKENS} TOKEN into the vault. ${SHARE_TOKENS} are minted 1:1.`,
                },
                {
                  step: '02',
                  title: 'CCA Allocation',
                  body: `${CCA_PERCENT} of shares — ${CCA_AMOUNT} ${SHARE_TOKEN} — are routed to the auction contract every Thursday at 00:00 UTC.`,
                },
                {
                  step: '03',
                  title: 'Market Auction',
                  body: `Bidders compete over the 7-day window. Final price is set by the market, establishing fair on-chain value for the creator coin.`,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative overflow-hidden rounded-[18px] border border-white/6 bg-white/[0.015] p-5"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent" />
                  <span className="font-mono text-[9px] font-semibold text-zinc-600">{item.step}</span>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-200">{item.title}</h3>
                  <p className="mt-2 text-[12px] font-light leading-relaxed text-zinc-500">{item.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="cinematic-section !py-10 sm:!py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] border border-white/6 bg-white/[0.015] p-6 sm:p-8"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">See the full launch flow</p>
              <p className="text-[12px] font-light text-zinc-500">
                Deposit mechanics, minting, distribution, and strategy allocation in one walkthrough.
              </p>
            </div>
            <Link to="/faq/how-it-works" className="btn-primary btn-no-icon inline-flex items-center gap-2">
              How it works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
