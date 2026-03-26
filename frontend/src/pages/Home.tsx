import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistReferralPath,
  buildWaitlistReferralUrl,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
  readWaitlistEntryReferralCode,
  WAITLIST_REFERRAL_CODE_STORAGE_KEY,
} from '@/lib/auth/waitlistEntry'
import { getHostMode, getMarketingBaseUrl, type HostMode } from '@/lib/host'
import { PageMeta } from '@/components/seo/PageMeta'
import { PublicWaitlistOverview } from '@/components/waitlist/PublicWaitlistOverview'

const LazyWaitlistFlowWithProviders = lazy(async () => {
  const mod = await import('@/components/waitlist/WaitlistFlowWithProviders')
  return { default: mod.default }
})

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`
const WAITLIST_STICKY_OPEN_KEY = 'cv:waitlist:sticky_open'
const WAITLIST_AUTH_ARMED_KEY = 'cv:waitlist:auth_armed'

type HomeRedirectInput = {
  hostMode: HostMode
  pathname: string
  search: string
  hash: string
}

type HomeWaitlistRedirectInput = {
  hostMode: HostMode
  marketingOrigin: string
  pathname: string
  search: string
  hash: string
}

type WaitlistEntryVisibilityInput = {
  pathname: string
  search: string
  hash: string
  stickyOpen: boolean
}

type WaitlistCloseTargetInput = {
  pathname: string
  search: string
  hash: string
}

function normalizePathname(pathname: string | null | undefined): string {
  const rawPath = String(pathname ?? '').trim()
  if (rawPath.length === 0) return '/'
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

function hasLegacyWaitlistUrlMarkers(search: string, hash: string): boolean {
  const params = new URLSearchParams(search)
  const reason = String(params.get('reason') ?? '').trim().toLowerCase()
  if (reason === 'needs-session' || reason === 'needs-acceptance') return true
  if (hash === '#waitlist') return true
  if (params.has('wl')) return true
  if (params.has('ref')) return true
  return false
}

function buildNormalizedWaitlistEntryPath(input: {
  pathname: string
  search: string
  hash: string
}): string {
  const referralCode = readWaitlistEntryReferralCode(input)
  if (referralCode) return buildWaitlistReferralPath(referralCode)
  return getCanonicalMarketingWaitlistPath()
}

export function shouldRedirectHomeToSwap(input: HomeRedirectInput): boolean {
  if (input.hostMode !== 'app') return false
  if (isMarketingWaitlistEntryLocation(input)) return false
  if (hasLegacyWaitlistUrlMarkers(input.search, input.hash)) return false
  return true
}

export function getHomeWaitlistRedirectTarget(input: HomeWaitlistRedirectInput): string | null {
  if (input.hostMode !== 'app') return null
  if (isMarketingWaitlistEntryLocation(input) || hasLegacyWaitlistUrlMarkers(input.search, input.hash)) {
    const referralCode = readWaitlistEntryReferralCode(input)
    return referralCode
      ? buildWaitlistReferralUrl(input.marketingOrigin, referralCode)
      : buildCanonicalMarketingWaitlistUrl(input.marketingOrigin)
  }
  return null
}

export function shouldShowWaitlistEntry(input: WaitlistEntryVisibilityInput): boolean {
  if (isMarketingWaitlistEntryLocation(input)) return true
  return input.stickyOpen
}

export function buildWaitlistCloseTarget(input: WaitlistCloseTargetInput): { path: string; changed: boolean } {
  const currentPath = normalizePathname(input.pathname)
  const nextPath = isMarketingWaitlistEntryLocation(input) ? '/' : currentPath
  const qs = new URLSearchParams(input.search)
  let changed = nextPath !== currentPath
  const reason = String(qs.get('reason') ?? '').trim().toLowerCase()
  const hasActiveWaitlistTrigger = hasLegacyWaitlistUrlMarkers(input.search, input.hash)
  if (qs.has('wl')) {
    qs.delete('wl')
    changed = true
  }
  // If user closes before the referral param is consumed, remove it
  // so the waitlist entry doesn't immediately reopen.
  if (qs.has('ref')) {
    qs.delete('ref')
    changed = true
  }
  const hash = input.hash === '#waitlist' ? '' : input.hash
  if (input.hash === '#waitlist') changed = true
  if (hasActiveWaitlistTrigger && (reason === 'needs-session' || reason === 'needs-acceptance')) {
    qs.delete('reason')
    changed = true
  }
  const query = qs.toString()
  return {
    path: `${nextPath}${query ? `?${query}` : ''}${hash}`,
    changed,
  }
}

export function Home() {
  const location = useLocation()
  const navigate = useNavigate()
  const [waitlistDismissVersion, setWaitlistDismissVersion] = useState(0)
  const [waitlistAuthArmed, setWaitlistAuthArmed] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(WAITLIST_AUTH_ARMED_KEY) === '1') return true
    } catch {
      // ignore
    }
    return false
  })
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
  const waitlistVisible = useMemo(() => {
    return shouldShowWaitlistEntry({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      stickyOpen: stickyWaitlistOpen,
    })
  }, [location.hash, location.pathname, location.search, stickyWaitlistOpen])
  const hostMode = getHostMode()
  const canonicalWaitlistHref = getCanonicalMarketingWaitlistPath()
  const activeReferralCode = useMemo(
    () =>
      readWaitlistEntryReferralCode({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
    [location.hash, location.pathname, location.search],
  )
  const homeWaitlistRedirectTarget = useMemo(
    () =>
      getHomeWaitlistRedirectTarget({
        hostMode,
        marketingOrigin: getMarketingBaseUrl(),
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
    [hostMode, location.hash, location.pathname, location.search],
  )
  const marketingLegacyWaitlistRedirect = useMemo(() => {
    if (hostMode !== 'marketing') return null
    if (normalizePathname(location.pathname) !== '/') return null
    if (!hasLegacyWaitlistUrlMarkers(location.search, location.hash)) return null
    return buildNormalizedWaitlistEntryPath({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  }, [hostMode, location.hash, location.pathname, location.search])
  const showJoinWaitlistCta = hostMode === 'marketing'
  const showExploreCreatorsCta = hostMode === 'app'
  const showDeployVaultCta = hostMode === 'app'
  const heroCtaClass =
    'btn-primary inline-flex items-center justify-center min-h-[52px] px-6 py-3.5 text-[15px]'

  // Keep the waitlist entry visible across full-page OAuth redirects (e.g. Privy <-> X).
  // We intentionally avoid encoding this state in query params, since OAuth redirect URLs
  // must match allowlists exactly (and query params can break that).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (waitlistVisible) window.sessionStorage.setItem(WAITLIST_STICKY_OPEN_KEY, '1')
      else window.sessionStorage.removeItem(WAITLIST_STICKY_OPEN_KEY)
    } catch {
      // ignore
    }
  }, [waitlistVisible])

  useEffect(() => {
    if (hostMode === 'app') return
    if (!waitlistVisible) return
    if (
      !isMarketingWaitlistEntryLocation({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    ) {
      return
    }

    const el = document.getElementById('waitlist')
    if (!el) return

    const rafId = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(rafId)
  }, [hostMode, location.hash, location.pathname, location.search, waitlistVisible])

  useEffect(() => {
    if (hostMode === 'app') return
    if (
      isMarketingWaitlistEntryLocation({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    ) {
      return
    }

    if (!location.hash) return
    const id = location.hash.replace('#', '').trim()
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [hostMode, location.hash, location.pathname, location.search])

  if (
    shouldRedirectHomeToSwap({
      hostMode,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  ) {
    return <Navigate to="/swap" replace />
  }

  if (marketingLegacyWaitlistRedirect) {
    return <Navigate to={marketingLegacyWaitlistRedirect} replace />
  }

  if (homeWaitlistRedirectTarget) {
    if (typeof window !== 'undefined') window.location.replace(homeWaitlistRedirectTarget)
    return null
  }

  const closeWaitlistEntry = () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(WAITLIST_STICKY_OPEN_KEY)
        window.sessionStorage.removeItem(WAITLIST_AUTH_ARMED_KEY)
        window.sessionStorage.removeItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
    setWaitlistAuthArmed(false)
    // Force a re-evaluation so sticky-open waitlist entries close immediately even when the URL is unchanged.
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

  const openInlineWaitlistAuth = () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(WAITLIST_STICKY_OPEN_KEY, '1')
        window.sessionStorage.setItem(WAITLIST_AUTH_ARMED_KEY, '1')
        if (activeReferralCode) {
          window.sessionStorage.setItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY, activeReferralCode)
        }
      }
    } catch {
      // ignore
    }
    setWaitlistAuthArmed(true)
  }

  return (
    <div className="relative">
      <PageMeta
        title="4626.fun - Creator Vaults"
        description="Deposit creator coins into vaults on Base. Earn from trading fees. Everyone earns together."
        canonicalPath={
          isMarketingWaitlistEntryLocation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          })
            ? canonicalWaitlistHref
            : '/'
        }
      />
      {/* Subtle particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 left-1/3 w-px h-px bg-brand-primary rounded-full" style={{ animation: 'particle-float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/4 w-px h-px bg-brand-primary/80 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-px h-px bg-brand-primary/60 rounded-full" style={{ animation: 'particle-float 12s ease-in-out infinite', animationDelay: '4s' }} />
      </div>

      {/* Hero - Cinematic Letterbox */}
      <section className="cinematic-section !py-16 sm:!py-24 lg:!py-28 min-h-[68vh] sm:min-h-[82vh] flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-8 sm:space-y-14">
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
            className="space-y-4 sm:space-y-6"
          >
            <h1 className="headline text-4xl sm:text-6xl md:text-7xl lg:text-[7.5rem] xl:text-[8.25rem] leading-[0.94] tracking-[-0.05em]">
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
            className="text-base sm:text-xl text-zinc-400 font-light tracking-wide max-w-2xl mx-auto"
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
              <Link to={canonicalWaitlistHref} className={heroCtaClass}>
                Join waitlist
                <ArrowRight className="w-4 h-4" />
              </Link>
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
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ) : null}

        </div>
      </section>

      {waitlistVisible ? (
        <section className="cinematic-section !pt-0 !pb-8 sm:!pb-16">
          <div id="waitlist" className="max-w-5xl mx-auto px-4 sm:px-6 scroll-mt-24">
            <div className="rounded-[24px] border border-white/10 bg-black/40 p-3.5 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.95)] backdrop-blur-md sm:rounded-[28px] sm:p-6 lg:p-8">
              <div className="flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5">
                <div className="space-y-2">
                  <span className="label">Waitlist</span>
                  <h2 className="headline text-2xl sm:text-3xl lg:text-4xl">Start access setup without leaving the page</h2>
                  <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
                    Verify email, track your place, and finish wallet readiness here. Keeping the waitlist flow inline avoids
                    stacked auth popups fighting the landing page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeWaitlistEntry}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Hide
                </button>
              </div>

              <div className="mt-5 sm:mt-6">
                {waitlistAuthArmed ? (
                  <Suspense
                    fallback={
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-zinc-300">
                        Loading waitlist…
                      </div>
                    }
                  >
                    <LazyWaitlistFlowWithProviders variant="page" sectionId="waitlist-flow" />
                  </Suspense>
                ) : (
                  <PublicWaitlistOverview
                    referralCode={activeReferralCode}
                    onContinueWithEmail={openInlineWaitlistAuth}
                    primaryButtonClassName={heroCtaClass}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* For Creators - Minimal CTA */}
      <section className="cinematic-section !py-10 sm:!py-16 lg:!py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid items-start gap-8 sm:gap-16 lg:grid-cols-2 lg:gap-20 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-4 sm:space-y-8"
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
              <div className="rounded-3xl border border-white/8 bg-white/[0.035] shadow-[0_24px_80px_-44px_rgba(0,82,255,0.35)] backdrop-blur-sm p-5 sm:p-6">
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
      <section className="cinematic-section bg-zinc-950/20 !py-10 sm:!py-24 lg:!py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-8 sm:mb-20"
          >
            <span className="label">Vault Strategies</span>
            <h2 className="headline text-3xl sm:text-4xl lg:text-5xl mt-4 sm:mt-6">Default strategy allocation</h2>
            <p className="text-zinc-600 text-[13px] sm:text-sm font-light max-w-xl mt-3 sm:mt-4">
              Current launch config allocates 30% to Charm LP, 30% to Ajna lending, 30% as Solana reserve,
              and keeps 10% idle in-vault for withdrawal flexibility.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/[0.035] shadow-[0_24px_80px_-48px_rgba(0,82,255,0.28)] sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-black/55 p-4 sm:p-8 space-y-2 sm:space-y-4"
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
              className="bg-black/55 p-4 sm:p-8 space-y-2 sm:space-y-4"
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
              className="bg-black/55 p-4 sm:p-8 space-y-2 sm:space-y-4"
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
              className="bg-black/55 p-4 sm:p-8 space-y-2 sm:space-y-4"
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
      <section className="cinematic-section !py-10 sm:!py-24 lg:!py-32">
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
    </div>
  )
}
