import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect } from 'react'
import { TokenImage } from '@/components/token/TokenImage'
import { AKITA } from '@/config/contracts'
import { getCanonicalMarketingWaitlistPath } from '@/lib/auth/waitlistEntry'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { getHostMode, getMarketingBaseUrl } from '@/lib/host'
import { PageMeta } from '@/components/seo/PageMeta'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const { defaultDepositTokens, defaultAuctionWindow, distribution, strategies, blendedApy } = STORY_CONTENT

const surface = 'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

/** Small inline bar that visualises a numeric percentage. */
function AllocBar({ pct, color = 'bg-white/20' }: { pct: number; color?: string }) {
  return (
    <div className="h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function FaqHowItWorks() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getHostMode() !== 'app') return
    window.location.replace(`${getMarketingBaseUrl()}/faq/how-it-works`)
  }, [])

  return (
    <div className="relative">
      <PageMeta
        title="How It Works"
        description="Deposit a Zora Creator Coin, receive vault share tokens, distribute via CCA, and earn yield automatically."
        canonicalPath="/faq/how-it-works"
      />

      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">

          {/* Back link */}
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
            className="space-y-14"
          >

            {/* ── Hero ── */}
            <div className="space-y-4 max-w-2xl">
              <span className="label">How it works</span>
              <h1 className="headline text-4xl sm:text-5xl lg:text-6xl">
                Deposit. Mint.<br className="hidden sm:block" /> Distribute. Earn.
              </h1>
              <p className="text-zinc-500 text-sm sm:text-base font-light leading-relaxed">
                The complete creator vault lifecycle — four steps from first deposit to ongoing yield.
              </p>
            </div>

            {/* ── 4-step timeline ── */}
            <div className="relative">
              {/* vertical connector */}
              <div className="absolute left-5 top-8 bottom-8 w-px bg-white/5 hidden sm:block" aria-hidden="true" />

              <div className="space-y-4">

                {/* ── Step 01 ── */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className={`${surface} p-6 sm:p-8 sm:ml-14 relative`}
                >
                  {/* step badge */}
                  <div className="absolute -left-7 top-8 hidden sm:flex w-10 h-10 rounded-full bg-black border border-white/8 items-center justify-center">
                    <span className="font-mono text-[10px] text-zinc-500">01</span>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="label">Deposit</span>
                      <h2 className="headline text-2xl sm:text-3xl mt-1">Open the vault</h2>
                    </div>

                    <p className="text-zinc-500 text-sm font-light leading-relaxed">
                      To deploy a vault, the creator makes a single one-time deposit of{' '}
                      <span className="mono text-white">{defaultDepositTokens}</span> creator coins —
                      exactly 5% of total supply. This commitment activates the vault and sets the initial share price.
                    </p>

                    {/* stat highlight */}
                    <div className="flex items-baseline gap-3 py-4 border-t border-white/5">
                      <span className="font-mono text-3xl text-white">{defaultDepositTokens}</span>
                      <span className="text-zinc-600 text-sm">creator coins required = 5% of supply</span>
                    </div>

                    {/* token flow */}
                    <div className="flex items-center gap-3">
                      <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="sm" isWrapped={false} />
                      <div className="flex-1 h-px bg-white/8 relative">
                        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent to-white/20" />
                      </div>
                      <img src="/brand/4626.svg" alt="4626 vault" className="w-6 h-6 opacity-70" />
                      <div className="flex-1 h-px bg-white/8" />
                      <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="sm" isWrapped wrappedShape="rect" />
                    </div>
                    <p className="text-[11px] text-zinc-700 font-light -mt-2">
                      Creator coin → vault → ■ share token
                    </p>
                  </div>
                </motion.div>

                {/* ── Step 02 ── */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                  className={`${surface} p-6 sm:p-8 sm:ml-14 relative`}
                >
                  <div className="absolute -left-7 top-8 hidden sm:flex w-10 h-10 rounded-full bg-black border border-white/8 items-center justify-center">
                    <span className="font-mono text-[10px] text-zinc-500">02</span>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="label">Mint</span>
                      <h2 className="headline text-2xl sm:text-3xl mt-1">
                        Receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span>
                      </h2>
                    </div>

                    <p className="text-zinc-500 text-sm font-light leading-relaxed">
                      <span className="mono text-white">{defaultDepositTokens} {SHARE_TOKEN}</span> vault share tokens are minted.
                      These represent proportional ownership of everything the vault earns — for the creator and all future depositors alike.
                      The share price can rise or fall as vault assets change.
                    </p>

                    <div className="flex items-center gap-3 py-4 border-t border-white/5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-zinc-400 text-sm font-light">
                        Holding <span className="mono text-brand-accent">{SHARE_TOKEN}</span> = pro-rata claim on vault assets + yield
                      </span>
                    </div>
                    <div className="flex items-center gap-3 -mt-3">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-zinc-400 text-sm font-light">
                        Transferable and usable across the app like any token
                      </span>
                    </div>
                    <div className="flex items-center gap-3 -mt-3">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-zinc-400 text-sm font-light">
                        Redeemable — burn <span className="mono text-brand-accent">{SHARE_TOKEN}</span> to get back the underlying creator coin
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* ── Step 03 ── */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.10 }}
                  className={`${surface} p-6 sm:p-8 sm:ml-14 relative`}
                >
                  <div className="absolute -left-7 top-8 hidden sm:flex w-10 h-10 rounded-full bg-black border border-white/8 items-center justify-center">
                    <span className="font-mono text-[10px] text-zinc-500">03</span>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="label">CCA distribution</span>
                      <h2 className="headline text-2xl sm:text-3xl mt-1">Public price discovery</h2>
                    </div>

                    <p className="text-zinc-500 text-sm font-light leading-relaxed">
                      Only during the initial deposit, the <span className="mono text-white">{defaultDepositTokens} {SHARE_TOKEN}</span> are split
                      across three destinations. A portion runs through Uniswap's Continuous Clearing Auction over{' '}
                      <span className="text-white">{defaultAuctionWindow}</span> — no fixed presale price, no insider advantage.
                    </p>

                    {/* distribution bars */}
                    <div className="space-y-4 border-t border-white/5 pt-5">
                      {distribution.map((dest) => (
                        <div key={dest.title} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              {dest.icon ? (
                                <img src={dest.icon} alt={dest.title} className="w-3.5 h-3.5 rounded-sm opacity-70" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-white/10" />
                              )}
                              <span className="text-sm text-white font-light">{dest.title}</span>
                            </div>
                            <div className="flex items-baseline gap-2 shrink-0">
                              <span className="font-mono text-xs text-zinc-400">{dest.amount}</span>
                              <span className="font-mono text-xs text-zinc-600">{dest.percent}</span>
                            </div>
                          </div>
                          <AllocBar pct={dest.numericPercent} color="bg-brand-accent/30" />
                          <p className="text-[11px] text-zinc-700 font-light">{dest.purposeCopy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* ── Step 04 ── */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className={`${surface} p-6 sm:p-8 sm:ml-14 relative`}
                >
                  <div className="absolute -left-7 top-8 hidden sm:flex w-10 h-10 rounded-full bg-black border border-white/8 items-center justify-center">
                    <span className="font-mono text-[10px] text-zinc-500">04</span>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="label">Earn</span>
                      <h2 className="headline text-2xl sm:text-3xl mt-1">Tokens go to work</h2>
                    </div>

                    <p className="text-zinc-500 text-sm font-light leading-relaxed">
                      The deposited creator coins are immediately allocated across four yield strategies.
                      As the vault earns, the <span className="mono text-brand-accent">{SHARE_TOKEN}</span> share price rises — benefiting
                      every holder proportionally, including the creator.
                    </p>

                    {/* strategy grid */}
                    <div className="grid sm:grid-cols-2 gap-3 border-t border-white/5 pt-5">
                      {strategies.map((s) => (
                        <div
                          key={s.label}
                          className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {s.icon ? (
                                <img src={s.icon} alt={s.iconAlt} className={s.iconClassName} />
                              ) : (
                                <div className="h-3.5 w-3.5 rounded-sm bg-white/10" />
                              )}
                              <span className="text-sm text-white font-light">{s.label}</span>
                            </div>
                            <span className="font-mono text-xs text-zinc-500">{s.percent}</span>
                          </div>
                          <AllocBar pct={s.numericPercent} />
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-[11px] text-zinc-700 font-light leading-relaxed">{s.purposeCopy}</p>
                            {s.apy !== '—' && (
                              <span className="shrink-0 font-mono text-[11px] text-emerald-500/70">{s.apy}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-baseline gap-3 py-3 border-t border-white/5">
                      <span className="label">Blended APR</span>
                      <span className="font-mono text-sm text-emerald-400">{blendedApy}</span>
                      <span className="text-zinc-700 text-xs font-light">not guaranteed</span>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>

            {/* ── Summary ── */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={`${surface} p-6 sm:p-8`}
            >
              <span className="label">The short version</span>
              <p className="mt-3 text-zinc-400 text-sm font-light leading-relaxed max-w-prose">
                Deposit creator coins → receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span> shares →
                a portion distributed publicly via CCA over {defaultAuctionWindow} →
                deposited tokens earn yield across Charm, Ajna, Solana, and an idle reserve →
                hold <span className="mono text-brand-accent">{SHARE_TOKEN}</span> to earn, or burn to exit.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={getCanonicalMarketingWaitlistPath()}
                  className="btn-accent inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm whitespace-nowrap"
                >
                  Join the waitlist <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/faq"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-3 text-sm text-zinc-400 hover:text-white hover:border-white/12 transition-colors whitespace-nowrap"
                >
                  Browse the full FAQ <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* ── Risk note ── */}
            <p className="text-[11px] text-zinc-700 font-light max-w-prose">
              Nothing on this page is financial advice. APR ranges are highly variable and not guarantees — the vault can make or lose money.
              Smart contracts can fail. Treat this as experimental unless you have independently verified the deployed contracts.
            </p>

          </motion.div>
        </div>
      </section>
    </div>
  )
}
