import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { getHostMode, type HostMode } from '@/lib/host'
import { useEffect, useMemo, useState } from 'react'
import { WaitlistModal } from '@/components/waitlist/WaitlistModal'
import { JoinWaitlistCtaWithProvider } from '@/components/waitlist/JoinWaitlistCta'
import { PageMeta } from '@/components/seo/PageMeta'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const WAITLIST_STICKY_OPEN_KEY = 'cv:waitlist:sticky_open'

type HomeRedirectInput = {
  hostMode: HostMode
  search: string
  hash: string
}

type WaitlistModalInput = {
  hash: string
  search: string
  stickyOpen: boolean
}

type WaitlistCloseTargetInput = {
  pathname: string
  search: string
  hash: string
}

export function shouldRedirectHomeToSwap(input: HomeRedirectInput): boolean {
  if (input.hostMode !== 'app') return false
  const params = new URLSearchParams(input.search)
  const reason = String(params.get('reason') ?? '').trim().toLowerCase()
  const isWaitlistAccessReason = reason === 'needs-session' || reason === 'needs-acceptance'
  if (isWaitlistAccessReason) return false
  if (input.hash === '#waitlist') return false
  return true
}

export function shouldOpenWaitlistModal(input: WaitlistModalInput): boolean {
  if (input.hash === '#waitlist') return true
  const qs = new URLSearchParams(input.search)
  const wl = (qs.get('wl') ?? '').trim().toLowerCase()
  if (wl === '1' || wl === 'true' || wl === 'yes') return true
  const ref = (qs.get('ref') ?? '').trim()
  if (ref.length > 0) return true
  return input.stickyOpen
}

export function buildWaitlistCloseTarget(input: WaitlistCloseTargetInput): { path: string; changed: boolean } {
  const qs = new URLSearchParams(input.search)
  let changed = false
  if (qs.has('wl')) {
    qs.delete('wl')
    changed = true
  }
  // If user closes before the referral param is consumed, remove it
  // so the modal doesn't immediately reopen.
  if (qs.has('ref')) {
    qs.delete('ref')
    changed = true
  }
  const hash = input.hash === '#waitlist' ? '' : input.hash
  if (input.hash === '#waitlist') changed = true
  const query = qs.toString()
  return {
    path: `${input.pathname}${query ? `?${query}` : ''}${hash}`,
    changed,
  }
}

export function Home() {
  const location = useLocation()
  const navigate = useNavigate()
  const [waitlistDismissVersion, setWaitlistDismissVersion] = useState(0)
  const stickyWaitlistOpen = useMemo(() => {
    // Force recomputation after local dismiss when URL does not change.
    void waitlistDismissVersion
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(WAITLIST_STICKY_OPEN_KEY) === '1') return true
    } catch {
      // ignore
    }
    return false
  }, [waitlistDismissVersion])
  const waitlistOpen = useMemo(() => {
    return shouldOpenWaitlistModal({
      hash: location.hash,
      search: location.search,
      stickyOpen: stickyWaitlistOpen,
    })
  }, [location.hash, location.search, stickyWaitlistOpen])
  const hostMode = getHostMode()
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const showDeployVaultCta = hostMode === 'app'
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

  // Keep the waitlist modal open across full-page OAuth redirects (e.g. Privy <-> X).
  // We intentionally avoid encoding this state in query params, since OAuth redirect URLs
  // must match allowlists exactly (and query params can break that).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (waitlistOpen) window.sessionStorage.setItem(WAITLIST_STICKY_OPEN_KEY, '1')
      else window.sessionStorage.removeItem(WAITLIST_STICKY_OPEN_KEY)
    } catch {
      // ignore
    }
  }, [waitlistOpen])

  useEffect(() => {
    if (hostMode === 'app') return
    if (location.hash === '#waitlist') return

    if (!location.hash) return
    const id = location.hash.replace('#', '').trim()
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [hostMode, location.hash])

  if (
    shouldRedirectHomeToSwap({
      hostMode,
      search: location.search,
      hash: location.hash,
    })
  ) {
    return <Navigate to="/swap" replace />
  }

  const closeWaitlistModal = () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(WAITLIST_STICKY_OPEN_KEY)
      }
    } catch {
      // ignore
    }
    // Force a re-evaluation so sticky-open modals close immediately even when URL is unchanged.
    setWaitlistDismissVersion((v) => v + 1)
    const closeTarget = buildWaitlistCloseTarget({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
    if (closeTarget.changed) {
      navigate(closeTarget.path, { replace: true })
    }
  }

  return (
    <div className="relative">
      <PageMeta
        title="4626.fun - Creator Vaults"
        description="Deposit creator coins into vaults on Base. Earn from trading fees. Everyone earns together."
        canonicalPath="/"
      />
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

          {showJoinWaitlistCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.12 }}
              className="pt-4 sm:pt-6"
            >
              <JoinWaitlistCtaWithProvider
                className={heroCtaClass}
                onPrivyDisabled={() => window.location.assign(getMarketingWaitlistEntryUrl('needs-session'))}
              />
            </motion.div>
          ) : null}
          {showExploreCreatorsCta ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.12 }}
              className="pt-4 sm:pt-6"
            >
              <Link to="/explore/creators" className={heroCtaClass}>
                Explore Creators
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ) : null}

        </div>
      </section>

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
              <div className="inline-flex items-center gap-2 text-[10px] font-medium text-zinc-600">
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
                </div>
              {showDeployVaultCta ? (
                <div>
                  <Link to="/deploy" className={heroCtaClass}>
                    Deploy Vault
                    <ArrowRight className="w-4 h-4" />
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
              <div className="rounded-2xl border border-zinc-900/70 bg-black/30 backdrop-blur-sm p-4 sm:p-6">
                <div className="text-[10px] font-medium text-zinc-600">Default launch mechanics</div>

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
            <h2 className="headline text-3xl sm:text-4xl lg:text-5xl mt-4 sm:mt-6">Default strategy allocation</h2>
            <p className="text-zinc-600 text-[13px] sm:text-sm font-light max-w-xl mt-3 sm:mt-4">
              Current launch config allocates 30% to Charm LP, 30% to Ajna lending, 30% as Solana reserve,
              and keeps 10% idle in-vault for withdrawal flexibility.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-vault-card/60">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <div className="inline-flex items-center gap-1.5">
                <img
                  src="/protocols/charm.png"
                  alt="Charm"
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 rounded-sm opacity-90"
                  loading="lazy"
                />
                <span className="label text-[9px] sm:text-[10px]">Charm</span>
              </div>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl glow-brand">30%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">CREATOR/USDC Uniswap V3 LP</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <div className="inline-flex items-center gap-1.5">
                <img
                  src="/protocols/ajna.svg"
                  alt="Ajna"
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 opacity-90"
                  loading="lazy"
                />
                <span className="label text-[9px] sm:text-[10px]">Ajna</span>
              </div>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl glow-brand">30%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Permissionless Lending</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <div className="inline-flex items-center gap-1.5">
                <img
                  src="/protocols/solana.svg"
                  alt="Solana"
                  width={16}
                  height={14}
                  className="h-3.5 w-auto opacity-90"
                  loading="lazy"
                />
                <span className="label text-[9px] sm:text-[10px]">Solana</span>
              </div>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl">30%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Reserved for Solana route flow</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-black p-4 sm:p-8 space-y-2 sm:space-y-4"
            >
              <span className="label text-[9px] sm:text-[10px]">Idle Buffer</span>
              <div className="value mono text-xl sm:text-3xl lg:text-4xl">10%</div>
              <div className="text-zinc-600 text-[10px] sm:text-xs font-light">Kept liquid for operations/withdrawals</div>
            </motion.div>
          </div>
          <div className="mt-4 text-[11px] sm:text-xs text-zinc-600 font-light">
              <span className="font-mono text-zinc-400">Strategies deploy underlying TOKEN = creator coin ·{' '} </span> not the ■TOKEN = vault share token 
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
              Deposit → CCA launch → 30/30/40 allocation model → redeem.
            </p>
            <div>
              <Link to="/faq/how-it-works" className="btn-primary inline-flex items-center">
                How it works <ArrowRight className="w-4 h-4 inline ml-2" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <WaitlistModal open={waitlistOpen} onClose={closeWaitlistModal} />
    </div>
  )
}
