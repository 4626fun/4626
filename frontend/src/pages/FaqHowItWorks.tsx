import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { TokenImage } from '@/components/TokenImage'
import { AKITA } from '@/config/contracts'
import { getPrivyCapableWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { getHostMode, getMarketingBaseUrl } from '@/lib/host'
import { PageMeta } from '@/components/seo/PageMeta'
import { JoinWaitlistCta } from '@/components/waitlist/JoinWaitlistCta'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`

export function FaqHowItWorks() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getHostMode() !== 'app') return
    window.location.replace(`${getMarketingBaseUrl()}/faq/how-it-works`)
  }, [])

  const surface =
    'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

  return (
    <div className="relative">
      <PageMeta
        title="How It Works"
        description="Learn the current Creator Vaults flow — deposit, launch, default 30/30/40 allocation, and redeem."
        canonicalPath="/faq/how-it-works"
      />
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">Back to FAQ</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div>
              <span className="label">FAQ</span>
              <h1 className="headline text-4xl sm:text-6xl mt-4">How it works</h1>
              <p className="text-zinc-500 text-sm sm:text-base font-light mt-4 max-w-2xl">
                The short version: deposit a creator coin → receive a vault share token (
                <span className="mono text-brand-accent">{SHARE_TOKEN}</span>) → launch allocates capital (default 30/30/40) → you can redeem by burning{' '}
                <span className="mono text-brand-accent">{SHARE_TOKEN}</span>.
              </p>
            </div>

            <div className={`${surface} p-6 sm:p-8`}>
              <span className="label">Current launch flow</span>
              <div className="mt-6 space-y-0 border-t border-white/5">
                <div className="data-row group border-white/5">
                  <div className="space-y-2">
                    <span className="label">Step 01</span>
                    <h2 className="text-2xl text-white font-light">Deposit</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Deposit the creator coin into its vault. You receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span> shares.
                      New vaults currently initialize with a 5,000,000 token first deposit.
                    </p>
                  </div>
                </div>

                <div className="data-row group border-white/5">
                  <div className="space-y-2">
                    <span className="label">Step 02</span>
                    <h2 className="text-2xl text-white font-light">Launch</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Launch can run a Uniswap CCA flow for price discovery and liquidity bootstrap, then transitions into ongoing vault operations.
                    </p>
                  </div>
                </div>

                <div className="data-row group border-white/5">
                  <div className="space-y-2">
                    <span className="label">Step 03</span>
                    <h2 className="text-2xl text-white font-light">Allocate</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Default allocation today is 30% CREATOR/USDC LP (Charm), 30% Ajna lending, and 40% held in-vault
                      (30% Solana reserve + 10% idle buffer).
                    </p>
                  </div>
                </div>

                <div className="data-row group border-none">
                  <div className="space-y-2">
                    <span className="label">Step 04</span>
                    <h2 className="text-2xl text-white font-light">Redeem</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Burn <span className="mono text-brand-accent">{SHARE_TOKEN}</span> to redeem the underlying creator coin from the vault.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-stretch">
              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Deposit → shares</span>
                <div className="flex items-center justify-center gap-5 py-2">
                  <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="md" isWrapped={false} />
                  <ArrowRight className="w-5 h-5 text-zinc-700" />
                  <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="md" isWrapped wrappedShape="rect" />
                </div>
                <p className="text-zinc-600 text-sm font-light leading-relaxed">
                  You deposit the creator coin and receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span>. Your ownership is represented by shares, not a fixed “1:1.”
                  As vault assets change, the share price changes.
                </p>
              </div>

              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Earning sources</span>
                <ul className="list-disc list-inside space-y-2 text-zinc-600 text-sm font-light">
                  <li>Trading fees once CREATOR/USDC liquidity is live</li>
                  <li>Strategy results from Charm LP + Ajna positions</li>
                  <li>Reserve and idle capital kept in-vault for operations and withdrawals</li>
                </ul>
                <p className="text-zinc-700 text-xs font-light">
                  Nothing here implies a promised APY. The vault can make or lose money depending on market conditions and strategy behavior.
                </p>
              </div>

              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Launch (optional)</span>
                <p className="text-zinc-600 text-sm font-light leading-relaxed">
                  New vaults can use a Uniswap Continuous Clearing Auction (CCA) to bootstrap fair price discovery and initial liquidity.
                </p>
                <div className="flex flex-col gap-2">
                  <JoinWaitlistCta
                    className="text-brand-accent hover:text-brand-400 underline underline-offset-4 text-sm"
                    showArrow={false}
                    onPrivyDisabled={() => window.location.assign(getPrivyCapableWaitlistEntryUrl('needs-session'))}
                  >
                    Join waitlist
                  </JoinWaitlistCta>
                </div>
              </div>
            </div>

            <div className={`${surface} p-6 sm:p-8`}>
              <span className="label">More questions?</span>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-zinc-500 font-light leading-relaxed max-w-prose">
                  Browse the full FAQ for definitions, mechanics, and troubleshooting.
                </p>
                <Link
                  to="/faq"
                  className="btn-accent rounded-lg px-5 py-3 text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  View FAQ <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
