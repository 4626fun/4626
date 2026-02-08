import { createContext, lazy, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useCreatorAllowlist } from '@/hooks'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { apiFetch } from '@/lib/apiBase'
import { AdminLayout } from './components/AdminLayout'
import { Layout } from './components/Layout'
import { MarketingLayout } from './components/MarketingLayout'
import { Home } from './pages/Home'
import { isPublicSiteMode } from './lib/flags'
import { getHostMode, getAppBaseUrl } from './lib/host'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type CreatorAllowlistMode = 'disabled' | 'enforced'

type CreatorAllowlistStatus = {
  address: string | null
  coin: string | null
  creator: string | null
  payoutRecipient: string | null
  mode: CreatorAllowlistMode
  allowed: boolean
}

type RouteId = 'public' | 'session' | 'accepted' | 'creator' | 'admin'
type AccessReason = 'ok' | 'loading' | 'needs-session' | 'needs-acceptance' | 'needs-admin' | 'needs-creator' | 'not-found'
type AccessDecision = { allow: true; reason: 'ok' } | { allow: false; reason: Exclude<AccessReason, 'ok'>; redirectTo?: string }

type AccessState = {
  loading: boolean
  walletConnected: boolean
  sessionValid: boolean
  accepted: boolean
  creator: boolean
  admin: boolean
  allowlistEnforced: boolean
  effectiveAddress: string | null
  marketingUrl: string
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function withReason(to: string, reason: AccessReason | 'legacy-route' | 'host-redirect' | 'external-redirect' | 'invalid-params'): string {
  try {
    const hashIdx = to.indexOf('#')
    const hash = hashIdx >= 0 ? to.slice(hashIdx) : ''
    const noHash = hashIdx >= 0 ? to.slice(0, hashIdx) : to

    const qIdx = noHash.indexOf('?')
    const path = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash
    const query = qIdx >= 0 ? noHash.slice(qIdx + 1) : ''
    const qs = new URLSearchParams(query)
    if (!qs.has('reason')) qs.set('reason', reason)
    const nextQuery = qs.toString()
    return `${path}${nextQuery ? `?${nextQuery}` : ''}${hash}`
  } catch {
    return to
  }
}

const ROUTE_REQUIREMENTS: Record<RouteId, { session?: boolean; accepted?: boolean; creator?: boolean; admin?: boolean }> = {
  public: {},
  session: { session: true },
  accepted: { session: true, accepted: true },
  creator: { session: true, accepted: true, creator: true },
  admin: { session: true, admin: true },
}

function resolveAccess(routeId: RouteId, state: AccessState): AccessDecision {
  if (state.loading) return { allow: false, reason: 'loading' }
  const req = ROUTE_REQUIREMENTS[routeId]
  if (req.session && !state.sessionValid) {
    return { allow: false, reason: 'needs-session', redirectTo: withReason('/', 'needs-session') }
  }
  if (req.accepted && !state.accepted) {
    return { allow: false, reason: 'needs-acceptance', redirectTo: withReason('/waitlist', 'needs-acceptance') }
  }
  if (req.creator && !state.creator) {
    return { allow: false, reason: 'needs-creator', redirectTo: withReason('/deploy', 'needs-creator') }
  }
  if (req.admin && !state.admin) {
    return { allow: false, reason: 'needs-admin', redirectTo: withReason('/', 'needs-admin') }
  }
  return { allow: true, reason: 'ok' }
}

function buildAdminBypassSet(): Set<string> {
  const seed: string[] = ['0xb05cf01231cf2ff99499682e64d3780d57c80fdd']
  const raw = (import.meta.env.VITE_ADMIN_BYPASS_ADDRESSES as string | undefined) ?? ''
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => isValidEvmAddress(s))
  return new Set<string>([...seed, ...fromEnv].map((a) => a.toLowerCase()))
}

const ADMIN_BYPASS_ADDRESSES = buildAdminBypassSet()

function getMarketingBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://4626.fun'
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '0.0.0.0') return 'https://4626.fun'
  if (host.startsWith('app.')) return `https://${host.slice(4)}`
  return `https://${host}`
}

function useResolvedAccessState(): AccessState {
  const { address: connectedAddressRaw, isConnected } = useAccount()
  const siwe = useSiweAuth()
  const adminStatus = useAdminStatus()

  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )
  const siweAuthAddress = useMemo(() => {
    const raw = typeof siwe.authAddress === 'string' ? siwe.authAddress : ''
    return isValidEvmAddress(raw) ? raw.toLowerCase() : null
  }, [siwe.authAddress])
  // Once a session is established, treat the authenticated address as the source of truth.
  // This avoids gating on a transient/secondary connected wallet address.
  const effectiveAddress = siwe.isSignedIn && siweAuthAddress ? siweAuthAddress : connectedAddress ?? siweAuthAddress
  const isBypassAdmin = effectiveAddress ? ADMIN_BYPASS_ADDRESSES.has(effectiveAddress) : false

  const allowlistModeQuery = useQuery({
    queryKey: ['creatorAllowlist', 'mode'],
    queryFn: async (): Promise<CreatorAllowlistStatus> => {
      const res = await apiFetch('/api/creator-allowlist', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<CreatorAllowlistStatus> | null
      if (!res.ok || !json) throw new Error('Allowlist check failed')
      if (!json.success || !json.data) throw new Error(json.error || 'Allowlist check failed')
      return json.data
    },
    staleTime: 30_000,
    retry: 0,
  })

  const allowlistMode = allowlistModeQuery.data?.mode ?? 'disabled'
  const allowlistEnforced = allowlistMode === 'enforced'
  const allowQuery = useCreatorAllowlist(isBypassAdmin ? null : effectiveAddress)
  const allowlisted = allowQuery.data?.allowed === true
  const accepted = !allowlistEnforced || isBypassAdmin || allowlisted

  const loading =
    siwe.busy ||
    allowlistModeQuery.isLoading ||
    (allowlistEnforced && !isBypassAdmin && !!effectiveAddress && allowQuery.isLoading) ||
    (siwe.isSignedIn && adminStatus.isLoading)

  return {
    loading,
    walletConnected: isConnected,
    sessionValid: siwe.isSignedIn,
    accepted,
    creator: accepted,
    admin: adminStatus.isAdmin || isBypassAdmin,
    allowlistEnforced,
    effectiveAddress,
    marketingUrl: getMarketingBaseUrl(),
  }
}

const AccessContext = createContext<AccessState | null>(null)

function useAccessContext(): AccessState {
  const value = useContext(AccessContext)
  if (!value) {
    throw new Error('AccessContext is not available')
  }
  return value
}

function AccessStateProvider(props: { children: ReactNode }) {
  const value = useResolvedAccessState()
  return <AccessContext.Provider value={value}>{props.children}</AccessContext.Provider>
}

function GuardPending() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="card rounded-xl p-8 space-y-3">
          <div className="text-lg font-medium">Loading access state…</div>
          <div className="text-sm text-zinc-400">Resolving wallet/session permissions.</div>
        </div>
      </div>
    </div>
  )
}

function RequireRouteAccess(props: { routeId: RouteId; children?: React.ReactNode }) {
  const access = useAccessContext()
  const decision = resolveAccess(props.routeId, access)
  if (!decision.allow) {
    if (decision.reason === 'loading') return <GuardPending />
    return <Navigate to={decision.redirectTo ?? withReason('/', decision.reason)} replace />
  }
  return props.children ? <>{props.children}</> : <Outlet />
}

function RequireSession(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="session">{props.children}</RequireRouteAccess>
}

function RequireAccepted(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="accepted">{props.children}</RequireRouteAccess>
}

function RequireAdmin(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="admin">{props.children}</RequireRouteAccess>
}

const Vault = lazy(async () => {
  const m = await import('./pages/Vault')
  return { default: m.Vault }
})

const CompleteAuction = lazy(async () => {
  const m = await import('./pages/CompleteAuction')
  return { default: m.CompleteAuction }
})

const AuctionBid = lazy(async () => {
  const m = await import('./pages/AuctionBid')
  return { default: m.AuctionBid }
})

const DeployVault = lazy(async () => {
  const m = await import('./pages/DeployVault')
  return { default: m.DeployVault }
})

const Waitlist = lazy(async () => {
  const m = await import('./pages/Waitlist')
  return { default: m.Waitlist }
})

const WaitlistLanding = lazy(async () => {
  const m = await import('./pages/WaitlistLanding')
  return { default: m.WaitlistLanding }
})

const Leaderboard = lazy(async () => {
  const m = await import('./pages/Leaderboard')
  return { default: m.Leaderboard }
})

const WaitlistProfile = lazy(async () => {
  const m = await import('./pages/WaitlistProfile')
  return { default: m.WaitlistProfile }
})

const CoinManage = lazy(async () => {
  const m = await import('./pages/CoinManage')
  return { default: m.CoinManage }
})

const CreatorEarnings = lazy(async () => {
  const m = await import('./pages/CreatorEarnings')
  return { default: m.CreatorEarnings }
})

const Faq = lazy(async () => {
  const m = await import('./pages/Faq')
  return { default: m.Faq }
})

const FaqHowItWorks = lazy(async () => {
  const m = await import('./pages/FaqHowItWorks')
  return { default: m.FaqHowItWorks }
})

const Status = lazy(async () => {
  const m = await import('./pages/Status')
  return { default: m.Status }
})

const AdminCreatorAccess = lazy(async () => {
  const m = await import('./pages/AdminCreatorAccess')
  return { default: m.AdminCreatorAccess }
})

const AdminWaitlist = lazy(async () => {
  const m = await import('./pages/AdminWaitlist')
  return { default: m.AdminWaitlist }
})

const AdminOps = lazy(async () => {
  const m = await import('./pages/AdminOps')
  return { default: m.AdminOps }
})

const AdminDeployStrategies = lazy(async () => {
  const m = await import('./pages/AdminDeployStrategies')
  return { default: m.AdminDeployStrategies }
})

const AdminAgentSetup = lazy(async () => {
  const m = await import('./pages/AdminAgentSetup')
  return { default: m.AdminAgentSetup }
})

const GaugeVoting = lazy(async () => {
  const m = await import('./pages/GaugeVoting')
  return { default: m.default }
})

const AuctionDemo = lazy(async () => {
  const m = await import('./pages/AuctionDemo')
  return { default: m.default }
})
const AgentDirectory = lazy(async () => {
  const m = await import('./pages/AgentDirectory')
  return { default: m.AgentDirectory }
})

const ExploreCreators = lazy(async () => {
  const m = await import('./pages/ExploreCreators')
  return { default: m.ExploreCreators }
})

const ExploreContent = lazy(async () => {
  const m = await import('./pages/ExploreContent')
  return { default: m.ExploreContent }
})

const ExploreTransactions = lazy(async () => {
  const m = await import('./pages/ExploreTransactions')
  return { default: m.ExploreTransactions }
})

const ExploreCreatorDetail = lazy(async () => {
  const m = await import('./pages/ExploreCreatorDetail')
  return { default: m.ExploreCreatorDetail }
})

const ExploreContentDetail = lazy(async () => {
  const m = await import('./pages/ExploreContentDetail')
  return { default: m.ExploreContentDetail }
})

const ExploreCreatorTransactions = lazy(async () => {
  const m = await import('./pages/ExploreCreatorTransactions')
  return { default: m.ExploreCreatorTransactions }
})

const ExploreContentTransactions = lazy(async () => {
  const m = await import('./pages/ExploreContentTransactions')
  return { default: m.ExploreContentTransactions }
})

const ExploreContentPoolAlias = lazy(async () => {
  const m = await import('./pages/ExploreContentPoolAlias')
  return { default: m.ExploreContentPoolAlias }
})

const Swap = lazy(async () => {
  const m = await import('./pages/Swap')
  return { default: m.Swap }
})

const Positions = lazy(async () => {
  const m = await import('./pages/Positions')
  return { default: m.Positions }
})

const Portfolio = lazy(async () => {
  const m = await import('./pages/Portfolio')
  return { default: m.Portfolio }
})

function ExternalRedirect({ to, reason = 'external-redirect' }: { to: string; reason?: 'external-redirect' | 'host-redirect' }) {
  const target = withReason(to, reason)
  if (typeof window !== 'undefined') window.location.replace(target)
  return null
}

function AppRedirect({ base }: { base: string }) {
  const location = useLocation()
  const target = withReason(`${base}${location.pathname}${location.search}${location.hash}`, 'host-redirect')
  if (typeof window !== 'undefined') window.location.replace(target)
  return null
}

function NotFoundPage() {
  const location = useLocation()
  const access = useAccessContext()
  const hostMode = getHostMode()
  const appBase = getAppBaseUrl()

  const appCta = useMemo(() => {
    if (!access.sessionValid) {
      return { href: withReason('/', 'needs-session'), label: 'Connect And Sign In', hint: 'Connect wallet and establish a session.' }
    }
    if (!access.accepted) {
      return { href: withReason('/waitlist', 'needs-acceptance'), label: 'Join Waitlist', hint: 'This route requires accepted app access.' }
    }
    return { href: withReason('/explore/creators', 'not-found'), label: 'Go To Explore', hint: 'Your session is valid. Continue to the canonical landing route.' }
  }, [access.accepted, access.sessionValid])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl font-medium">Route Not Found</div>
          <div className="text-sm text-zinc-400">No page matches <span className="font-mono text-zinc-300">{location.pathname}</span>.</div>
          {hostMode === 'marketing' ? (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500">You are on the marketing domain.</div>
              <div className="flex flex-wrap gap-3">
                <a className="btn-accent inline-flex" href={withReason('/#waitlist', 'not-found')}>
                  Go To Waitlist
                </a>
                <a className="btn-primary inline-flex" href={withReason(`${appBase}/`, 'not-found')}>
                  Open App Home
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500">{appCta.hint}</div>
              <div className="flex flex-wrap gap-3">
                <Link className="btn-accent inline-flex" to={appCta.href}>
                  {appCta.label}
                </Link>
                <a className="btn-primary inline-flex" href={withReason(access.marketingUrl, 'not-found')}>
                  Open Marketing Site
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const appBase = getAppBaseUrl()

  // Prefetch the most common routes after first paint to reduce perceived load time.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      void import('./pages/ExploreCreators')
      void import('./pages/ExploreContent')
      void import('./pages/DeployVault')
      void import('./pages/Swap')
    }
    // Prefer idle time, fall back to a short delay.
    const ric = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined
    const cancelRic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined
    const id = ric ? ric(run) : window.setTimeout(run, 1200)
    return () => {
      cancelled = true
      if (ric && cancelRic) cancelRic(id as any)
      else window.clearTimeout(id as any)
    }
  }, [])

  return (
    <AccessStateProvider>
      <Routes>
        {hostMode === 'marketing' ? (
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<WaitlistLanding />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/waitlist" element={<Navigate to={withReason('/', 'legacy-route')} replace />} />
            <Route path="/portfolio" element={<WaitlistProfile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />

            <Route path="/explore/*" element={<ExternalRedirect to={`${appBase}/explore`} />} />
            <Route path="/deploy" element={<ExternalRedirect to={`${appBase}/deploy`} />} />
            <Route path="/dashboard" element={<ExternalRedirect to={`${appBase}/explore`} />} />
            <Route path="/vault/*" element={<ExternalRedirect to={`${appBase}/vault`} />} />
            <Route path="/coin/*" element={<ExternalRedirect to={`${appBase}/coin`} />} />
            <Route path="/creator/*" element={<ExternalRedirect to={`${appBase}/creator`} />} />
            <Route path="/admin/*" element={<AppRedirect base={appBase} />} />
            <Route path="/miniapp" element={<AppRedirect base={appBase} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : publicMode ? (
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/home" element={<Navigate to={withReason('/', 'legacy-route')} replace />} />
            <Route path="/waitlist" element={<Waitlist />} />

            <Route element={<RequireSession />}>
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to={withReason('/admin/waitlist', 'legacy-route')} replace />} />
                  <Route path="creator-access" element={<AdminCreatorAccess />} />
                  <Route path="waitlist" element={<AdminWaitlist />} />
                  <Route path="agent-setup" element={<AdminAgentSetup />} />
                  <Route path="ops" element={<AdminOps />} />
                  <Route path="miniapp" element={<Navigate to={withReason('/admin/ops', 'legacy-route')} replace />} />
                  <Route path="deploy-strategies" element={<AdminDeployStrategies />} />
                </Route>
                <Route path="/miniapp" element={<Navigate to={withReason('/admin/ops', 'legacy-route')} replace />} />
              </Route>
            </Route>

            <Route path="/status" element={<Status />} />
            <Route path="/agents" element={<AgentDirectory />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/home" element={<Navigate to={withReason('/', 'legacy-route')} replace />} />

            <Route element={<RequireSession />}>
              <Route element={<RequireAccepted />}>
                <Route path="/explore" element={<Navigate to={withReason('/explore/creators', 'legacy-route')} replace />} />
                <Route path="/explore/creators" element={<ExploreCreators />} />
                <Route path="/explore/content" element={<ExploreContent />} />
                <Route path="/explore/transactions" element={<ExploreTransactions />} />
                <Route path="/explore/creators/:chain/:tokenAddress" element={<ExploreCreatorDetail />} />
                <Route path="/explore/creators/:chain/:tokenAddress/transactions" element={<ExploreCreatorTransactions />} />
                <Route path="/explore/content/:chain/:contentCoinAddress" element={<ExploreContentDetail />} />
                <Route path="/explore/content/:chain/:contentCoinAddress/transactions" element={<ExploreContentTransactions />} />
                <Route path="/explore/content/:chain/pool/:poolIdOrPoolKeyHash" element={<ExploreContentPoolAlias />} />
                <Route path="/explore/tokens" element={<Navigate to={withReason('/explore/creators', 'legacy-route')} replace />} />
                <Route path="/explore/pools" element={<Navigate to={withReason('/explore/content', 'legacy-route')} replace />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/positions" element={<Positions />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/portfolio/:address" element={<Portfolio />} />
                <Route path="/launch" element={<Navigate to={withReason('/deploy', 'legacy-route')} replace />} />
                <Route path="/deploy" element={<DeployVault />} />
                <Route path="/coin/:address/manage" element={<CoinManage />} />
                <Route path="/creator/earnings" element={<CreatorEarnings />} />
                <Route path="/creator/:identifier/earnings" element={<CreatorEarnings />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/faq/how-it-works" element={<FaqHowItWorks />} />
                <Route path="/status" element={<Status />} />
                <Route path="/vote" element={<GaugeVoting />} />
                <Route path="/activate-akita" element={<Navigate to={withReason('/deploy', 'legacy-route')} replace />} />
                <Route path="/auction/bid/:address" element={<AuctionBid />} />
                <Route path="/complete-auction" element={<CompleteAuction />} />
                <Route path="/complete-auction/:strategy" element={<CompleteAuction />} />
                <Route path="/dashboard" element={<Navigate to={withReason('/explore/creators', 'legacy-route')} replace />} />
                <Route path="/vault/:address" element={<Vault />} />
                <Route path="/agents" element={<AgentDirectory />} />
                <Route path="/auction-demo" element={<AuctionDemo />} />
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to={withReason('/admin/waitlist', 'legacy-route')} replace />} />
                  <Route path="creator-access" element={<AdminCreatorAccess />} />
                  <Route path="waitlist" element={<AdminWaitlist />} />
                  <Route path="agent-setup" element={<AdminAgentSetup />} />
                  <Route path="ops" element={<AdminOps />} />
                  <Route path="miniapp" element={<Navigate to={withReason('/admin/ops', 'legacy-route')} replace />} />
                  <Route path="deploy-strategies" element={<AdminDeployStrategies />} />
                </Route>
                <Route path="/miniapp" element={<Navigate to={withReason('/admin/ops', 'legacy-route')} replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}
      </Routes>
    </AccessStateProvider>
  )
}

export default App
