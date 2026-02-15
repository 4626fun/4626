import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getAppBaseUrl, getHostMode } from '@/lib/host'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Share2 } from 'lucide-react'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { isPublicSiteMode } from '@/lib/flags'
import { WaitlistFlow } from '@/components/waitlist/WaitlistFlow'
import { useEffect } from 'react'
import { useAccessContext } from '@/App'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`

/** Compact banner shown on the Home page when the user has a session but is not yet accepted. */
function WaitlistStatusBanner() {
  const navigate = useNavigate()
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="max-w-2xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8 mb-6 sm:mb-10 relative z-10"
    >
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm px-5 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[14px] text-white font-medium">You're on the waitlist</div>
            <div className="text-[12px] text-zinc-400">We approve in batches. Share your link to move up.</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/waitlist')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[12px] font-medium hover:bg-amber-500/20 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            View Status
          </button>
        </div>
      </div>
    </motion.section>
  )
}

export function Home() {
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const marketingFocused = publicMode || hostMode === 'marketing'
  const location = useLocation()
  const access = useAccessContext()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace('#', '').trim()
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  if (marketingFocused) {
    return (
      <div className="relative">
        {/* Hero - marketing focus */}
        <section className="cinematic-section min-h-[70vh] sm:min-h-[82vh] flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-7 sm:space-y-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-3"
            >
              <div className="status-active">
                <span className="label">Creator waitlist</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-5"
            >
              <h1 className="headline text-4xl sm:text-6xl md:text-7xl leading-[1.08]">
                Turn Creator Coins
                <br />
                <span className="glow-brand">Into Earnings</span>
              </h1>
              <p className="text-base sm:text-xl text-zinc-500 font-light tracking-wide max-w-2xl mx-auto">
                Join the waitlist now. We approve in batches.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="pt-2"
            >
              <Link to="/#waitlist" className="btn-accent inline-block">
                Join waitlist <ArrowRight className="w-4 h-4 inline ml-2" />
              </Link>
            </motion.div>
          </div>
        </section>

        {access.sessionValid && !access.accepted && !access.loading ? <WaitlistStatusBanner /> : null}

        <WaitlistFlow variant="embedded" sectionId="waitlist" />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Subtle particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 left-1/3 w-px h-px bg-brand-primary rounded-full" style={{ animation: 'particle-float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/4 w-px h-px bg-brand-primary/80 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-px h-px bg-brand-primary/60 rounded-full" style={{ animation: 'particle-float 12s ease-in-out infinite', animationDelay: '4s' }} />
      </div>

      {/* Hero - Cinematic Letterbox */}
      <section className="cinematic-section min-h-[75vh] sm:min-h-[90vh] flex items-center justify-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-8 sm:space-y-16">
          {/* Status Indicator */}
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

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.428 }}
            className="space-y-6"
          >
            <h1 className="headline text-4xl sm:text-6xl md:text-7xl lg:text-9xl leading-[1.08]">
              Turn Creator Coins
              <br />
              <span className="glow-brand">Into Earnings</span>
            </h1>
          </motion.div>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.856 }}
            className="text-base sm:text-xl text-zinc-500 font-light tracking-wide max-w-2xl mx-auto"
          >
            Deposit tokens · Earn from trades · Grow together
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.284 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 sm:pt-8"
          >
            {publicMode ? (
              <Link to="/#waitlist" className="btn-accent w-full sm:w-auto text-center">
                Join waitlist <ArrowRight className="w-4 h-4 inline ml-2" />
              </Link>
            ) : (
              <>
                <a href={`${getAppBaseUrl()}/explore/creators`} className="btn-accent w-full sm:w-auto text-center">
                  Start Earning <ArrowRight className="w-4 h-4 inline ml-2" />
                </a>
                <a href={`${getAppBaseUrl()}/deploy`} className="btn-primary w-full sm:w-auto text-center">
                  Create Vault
                </a>
                <Link to="/#waitlist" className="btn-primary w-full sm:w-auto text-center">
                  Join waitlist
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* Waitlist status banner for users with a session but not yet accepted */}
      {access.sessionValid && !access.accepted && !access.loading && (
        <WaitlistStatusBanner />
      )}

      {/* For Creators - Minimal CTA */}
      <section className="cinematic-section py-12 sm:py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-5 sm:space-y-8"
            >
              <span className="label">For Creators</span>
              <h2 className="headline text-3xl sm:text-5xl lg:text-6xl leading-tight">
                Launch Your
                <br />
                <span className="glow-brand">Vault</span>
              </h2>
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                <span>Powered by</span>
                <img
                  src="/protocols/uniswap.svg"
                  alt="Uniswap"
                  width={16}
                  height={16}
                  className="w-4 h-4 opacity-80"
                  loading="lazy"
                />
                <span className="text-uniswap">Uniswap</span>
              </div>
              <div className="text-zinc-500 text-base sm:text-lg font-light leading-relaxed space-y-3">
                <p>
                  Minimum deposit: <span className="font-mono text-zinc-200">5,000,000 TOKEN</span>. In the default launch,
                  this mints <span className="font-mono text-brand-primary">5,000,000 {SHARE_TOKEN}</span> and runs a{' '}
                  <span className="text-uniswap">Uniswap CCA</span> auction.
                </p>
                <p>Then the vault deploys deposits across liquidity, lending, and reserve strategies.</p>
              </div>
              {publicMode ? (
                <Link to="/?persona=creator#waitlist" className="btn-accent inline-block">
                  Join waitlist <ArrowRight className="w-4 h-4 inline ml-2" />
                </Link>
              ) : (
                <a href={`${getAppBaseUrl()}/deploy`} className="btn-accent inline-block">
                  Create Vault <ArrowRight className="w-4 h-4 inline ml-2" />
                </a>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-0"
            >
              <div className="rounded-2xl border border-zinc-900/70 bg-black/30 backdrop-blur-sm p-4 sm:p-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Default launch mechanics</div>

                <div className="mt-4 sm:mt-6 space-y-0">
                  <div className="data-row">
                    <span className="label">Minimum deposit</span>
                    <div className="value mono text-sm sm:text-base">5,000,000 TOKEN</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Minted shares</span>
                    <div className="value mono text-sm sm:text-base text-brand-primary">{`5,000,000 ${SHARE_TOKEN}`}</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Uniswap CCA auction</span>
                    <div className="value mono text-sm sm:text-base">2,500,000 {SHARE_TOKEN}</div>
                  </div>
                  <div className="data-row">
                    <span className="label">Creator allocation</span>
                    <div className="value mono text-sm sm:text-base">2,500,000 {SHARE_TOKEN}</div>
                  </div>
                  <div className="data-row border-none">
                    <span className="label">Fair Launch</span>
                    <div className="value mono text-uniswap drop-shadow-[0_0_20px_rgba(255,0,122,0.35)] text-sm sm:text-base">100%</div>
                  </div>
                </div>

                <div className="mt-4 text-[11px] sm:text-xs text-zinc-600 font-light">
                  <span className="font-mono text-zinc-400">TOKEN</span> = creator coin ·{' '}
                  <span className="font-mono text-zinc-400">{SHARE_TOKEN}</span> = vault share token
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Strategies - Terminal Display */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-10 sm:mb-20"
          >
            <span className="label">Vault Strategies</span>
            <h2 className="headline text-3xl sm:text-4xl lg:text-5xl mt-4 sm:mt-6">Deploy across on-chain strategies</h2>
            <p className="text-zinc-600 text-[13px] sm:text-sm font-light max-w-xl mt-3 sm:mt-4">
              Deployed across liquidity, lending, and a reserve—designed to capture fees and yield.
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-px bg-zinc-900">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <span className="label text-[9px] sm:text-[10px]">CREATOR/USDC LP</span>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl glow-brand">69%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Liquidity</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <span className="label text-[9px] sm:text-[10px]">Ajna</span>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl glow-brand">21.39%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Lending</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <span className="label text-[9px] sm:text-[10px]">Reserve</span>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl">9.61%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Idle</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-4 sm:space-y-6"
          >
            <span className="label">FAQ</span>
            <h2 className="headline text-3xl sm:text-4xl lg:text-5xl mt-2">See the full walkthrough</h2>
            <p className="text-zinc-600 text-[13px] sm:text-sm font-light max-w-xl">
              Minimum deposit → Uniswap CCA → vault strategies.
            </p>
            <div>
              <Link to="/faq/how-it-works" className="btn-primary inline-block">
                How it works <ArrowRight className="w-4 h-4 inline ml-2" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <WaitlistFlow variant="embedded" sectionId="waitlist" />
    </div>
  )
}
