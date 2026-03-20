import { createContext, lazy, useContext, useMemo, type ReactNode } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useCreatorAllowlist } from '@/hooks'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useAdminStatusFromSession } from '@/hooks/useAdminStatus'
import { apiFetch } from '@/lib/apiBase'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { hasTelegramMiniAppEntrypointContext } from '@/lib/telegramWebApp'
import { AdminLayout } from './components/AdminLayout'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { getHostMode, getMarketingBaseUrl, APP_ORIGIN, MARKETING_ORIGIN } from '@/lib/host'
import { AccountContextProvider } from '@/wallet/accountContext'

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
  hostMode: import('@/lib/host').HostMode
}

type ResolvedAllowlistMode = CreatorAllowlistMode | 'unknown'

function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function resolveAllowlistMode(params: {
  modeFromGlobal?: CreatorAllowlistMode | null
  modeFromAddress?: CreatorAllowlistMode | null
}): ResolvedAllowlistMode {
  if (params.modeFromGlobal === 'disabled' || params.modeFromGlobal === 'enforced') return params.modeFromGlobal
  if (params.modeFromAddress === 'disabled' || params.modeFromAddress === 'enforced') return params.modeFromAddress
  return 'unknown'
}

export function computeAcceptedFromAllowlist(params: {
  mode: ResolvedAllowlistMode
  allowlisted: boolean
}): boolean {
  if (params.mode === 'disabled') return true
  if (params.mode === 'enforced') return params.allowlisted
  return false
}

function withReason(to: string, reason: AccessReason | 'host-redirect' | 'external-redirect' | 'invalid-params'): string {
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

function waitlistEntryHref(reason: 'needs-session' | 'needs-acceptance', hostMode: import('@/lib/host').HostMode): string {
  const local = `${withReason('/', reason)}#waitlist`
  return hostMode === 'app' ? `${MARKETING_ORIGIN}${local}` : local
}

const ROUTE_REQUIREMENTS: Record<RouteId, { session?: boolean; accepted?: boolean; creator?: boolean; admin?: boolean }> = {
  public: {},
  session: { session: true },
  accepted: { session: true, accepted: true },
  creator: { session: true, accepted: true, creator: true },
  admin: { session: true, admin: true },
}

export function resolveAccess(routeId: RouteId, state: AccessState): AccessDecision {
  if (state.loading) return { allow: false, reason: 'loading' }
  const req = ROUTE_REQUIREMENTS[routeId]
  if (req.session && !state.sessionValid) {
    return { allow: false, reason: 'needs-session', redirectTo: waitlistEntryHref('needs-session', state.hostMode) }
  }
  if (req.accepted && !state.accepted) {
    return { allow: false, reason: 'needs-acceptance', redirectTo: waitlistEntryHref('needs-acceptance', state.hostMode) }
  }
  if (req.creator && !state.creator) {
    const deployPrefix = state.hostMode === 'marketing' ? APP_ORIGIN : ''
    return { allow: false, reason: 'needs-creator', redirectTo: deployPrefix + withReason('/deploy', 'needs-creator') }
  }
  if (req.admin && !state.admin) {
    return { allow: false, reason: 'needs-admin', redirectTo: withReason('/', 'needs-admin') }
  }
  return { allow: true, reason: 'ok' }
}

function useResolvedAccessState(): AccessState {
  const { address: connectedAddressRaw, isConnected } = useAccount()
  const siwe = useSiweAuth()
  const adminStatus = useAdminStatusFromSession({
    authAddress: typeof siwe.authAddress === 'string' ? siwe.authAddress : null,
    sessionHydrated: siwe.sessionHydrated,
  })

  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )
  const siweAuthAddress = useMemo(() => {
    const raw = typeof siwe.authAddress === 'string' ? siwe.authAddress : ''
    return isValidEvmAddress(raw) ? raw.toLowerCase() : null
  }, [siwe.authAddress])
  // Use the actively connected wallet for allowlist checks, while still allowing
  // a bearer/cookie-backed session to satisfy session gates.
  const effectiveAddress = connectedAddress ?? siweAuthAddress
  const hasSession = Boolean(siweAuthAddress)

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

  const allowQuery = useCreatorAllowlist(effectiveAddress)
  const allowlistMode = resolveAllowlistMode({
    modeFromGlobal: allowlistModeQuery.data?.mode ?? null,
    modeFromAddress: allowQuery.data?.mode ?? null,
  })
  const allowlistEnforced = allowlistMode !== 'disabled'
  const allowlisted = allowQuery.data?.allowed === true
  const accepted = computeAcceptedFromAllowlist({ mode: allowlistMode, allowlisted })
  const allowlistModeLoading = allowlistModeQuery.isLoading || allowlistModeQuery.isFetching
  const allowlistAddressLoading =
    allowlistEnforced &&
    !!effectiveAddress &&
    (allowQuery.isLoading || allowQuery.isFetching)

  const loading =
    !siwe.sessionHydrated ||
    siwe.busy ||
    allowlistModeLoading ||
    allowlistAddressLoading ||
    (hasSession && adminStatus.isLoading)

  return {
    loading,
    walletConnected: isConnected,
    sessionValid: hasSession,
    accepted,
    creator: accepted,
    admin: adminStatus.isAdmin,
    allowlistEnforced,
    effectiveAddress,
    marketingUrl: getMarketingBaseUrl(),
    hostMode: getHostMode(),
  }
}

const AccessContext = createContext<AccessState | null>(null)

/** Redirect from 4626.fun to app.4626.fun when user hits app-only routes. */
function HostGuard() {
  const location = useLocation()
  if (typeof window === 'undefined') return null
  const mode = getHostMode()
  if (mode !== 'marketing') return null
  const { pathname, search, hash } = location
  if (!isAppOnlyPath(pathname)) return null
  const target = `${APP_ORIGIN}${pathname}${search}${hash}`
  window.location.replace(target)
  return null
}

/** Keep waitlist entry canonical on marketing domain as /#waitlist. */
function WaitlistEntryRoute() {
  const location = useLocation()
  const mode = getHostMode()
  const search = location.search || ''

  if (mode === 'marketing') {
    return <Navigate to={`/${search}#waitlist`} replace />
  }

  const target = `${MARKETING_ORIGIN}/${search}#waitlist`
  if (typeof window !== 'undefined') window.location.replace(target)
  return null
}

/** Restrict route content to marketing domain; app host redirects cross-origin. */
function MarketingOnlyRoute(props: { children: ReactNode }) {
  const location = useLocation()
  const mode = getHostMode()
  if (mode === 'marketing') return <>{props.children}</>

  const target = `${MARKETING_ORIGIN}${location.pathname}${location.search}${location.hash}`
  if (typeof window !== 'undefined') window.location.replace(target)
  return null
}

export function useAccessContext(): AccessState {
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
        <div className="vault-surface-elevated relative overflow-hidden rounded-2xl p-8 sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-brand-primary/14 blur-[72px]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-blue-400/10 blur-[72px]" />

          <div className="relative z-10 flex items-start gap-4 sm:gap-5" role="status" aria-live="polite">
            <div className="relative mt-0.5 h-10 w-10 shrink-0 rounded-full border border-white/12 bg-black/25">
              <div className="absolute inset-1.5 rounded-full border border-brand-primary/45 border-t-transparent motion-safe:animate-spin" />
              <div className="guard-loading-core absolute inset-[13px] rounded-full bg-brand-primary/80" />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="label text-zinc-500">Access Guard</div>
              <h2 className="text-lg sm:text-xl font-medium text-zinc-100 leading-tight">Loading access state…</h2>
              <p className="text-sm text-zinc-400">Resolving wallet/session permissions.</p>

              <div className="pt-2 space-y-2">
                <div className="guard-loading-bar h-2.5 w-full max-w-[320px] rounded-full" />
                <div className="guard-loading-bar h-2.5 w-full max-w-[240px] rounded-full" />
              </div>
            </div>
          </div>
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
    const to = decision.redirectTo ?? withReason('/', decision.reason)
    if (to.startsWith('http://') || to.startsWith('https://')) {
      if (typeof window !== 'undefined') window.location.replace(to)
      return null
    }
    return <Navigate to={to} replace />
  }
  return props.children ? <>{props.children}</> : <Outlet />
}

function RequireSession(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="session">{props.children}</RequireRouteAccess>
}

function RequireAccepted(props: { children?: React.ReactNode }) {
  return <RequireRouteAccess routeId="accepted">{props.children}</RequireRouteAccess>
}

function RequireTelegramMiniAppEntry(props: { children?: React.ReactNode }) {
  const access = useAccessContext()
  const location = useLocation()

  if (hasTelegramMiniAppEntrypointContext()) {
    return props.children ? <>{props.children}</> : <Outlet />
  }

  const acceptedDecision = resolveAccess('accepted', access)
  if (acceptedDecision.reason === 'loading') return <GuardPending />
  if (acceptedDecision.allow) {
    return <Navigate to="/swap" replace state={{ from: location.pathname }} />
  }
  const to = acceptedDecision.redirectTo ?? withReason('/', acceptedDecision.reason)
  if (to.startsWith('http://') || to.startsWith('https://')) {
    if (typeof window !== 'undefined') window.location.replace(to)
    return null
  }
  return <Navigate to={to} replace />
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

const SmartWalletsRouteProvider = lazy(async () => {
  const m = await import('@/lib/privy/SmartWalletsRouteProvider')
  return { default: m.SmartWalletsRouteProvider }
})

function WithSmartWallets(props: { children: ReactNode }) {
  return <SmartWalletsRouteProvider>{props.children}</SmartWalletsRouteProvider>
}

const Leaderboard = lazy(async () => {
  const m = await import('./pages/Leaderboard')
  return { default: m.Leaderboard }
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
const AdminImageGeneration = lazy(async () => {
  const m = await import('./pages/AdminImageGeneration')
  return { default: m.AdminImageGeneration }
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
const AgentRegister = lazy(async () => {
  const m = await import('./pages/AgentRegister')
  return { default: m.AgentRegister }
})
const AgentUriService = lazy(async () => {
  const m = await import('./pages/AgentUriService')
  return { default: m.AgentUriService }
})

const ExploreCreators = lazy(async () => {
  const m = await import('./pages/ExploreCreators')
  return { default: m.ExploreCreators }
})

const ExploreContent = lazy(async () => {
  const m = await import('./pages/ExploreContent')
  return { default: m.ExploreContent }
})

const ExploreTrends = lazy(async () => {
  const m = await import('./pages/ExploreTrends')
  return { default: m.ExploreTrends }
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

const AccountsPage = lazy(async () => {
  const m = await import('./pages/accounts/AccountsPage')
  return { default: m.AccountsPage }
})

const AppContinue = lazy(async () => {
  const m = await import('./pages/AppContinue')
  return { default: m.AppContinue }
})

function NotFoundPage() {
  const location = useLocation()
  const access = useAccessContext()

  const appCta = useMemo(() => {
    const prefix = access.hostMode === 'app' ? MARKETING_ORIGIN : ''
    if (!access.sessionValid) {
      return { href: prefix + withReason('/', 'needs-session'), label: 'Sign In', hint: 'Sign in to get started.' }
    }
    if (!access.accepted) {
      return {
        href: waitlistEntryHref('needs-acceptance', access.hostMode),
        label: 'Join Waitlist',
        hint: 'This route requires accepted app access.',
      }
    }
    const tradeHref = access.hostMode === 'marketing' ? APP_ORIGIN + '/swap' : withReason('/swap', 'not-found')
    return { href: tradeHref, label: 'Go To Trade', hint: 'Your session is valid. Continue to the canonical app landing route.' }
  }, [access.accepted, access.sessionValid, access.hostMode])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">4626</div>
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl font-medium">Route Not Found</div>
          <div className="text-sm text-zinc-400">No page matches <span className="font-mono text-zinc-300">{location.pathname}</span>.</div>
          <div className="space-y-3">
            <div className="text-xs text-zinc-500">{appCta.hint}</div>
            <div className="flex flex-wrap gap-3">
              {(appCta.href.startsWith('http://') || appCta.href.startsWith('https://')) ? (
                <a className="btn-accent btn-no-icon inline-flex" href={appCta.href}>{appCta.label}</a>
              ) : (
                <Link className="btn-accent btn-no-icon inline-flex" to={appCta.href}>{appCta.label}</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AccessStateProvider>
      <AccountContextProvider>
        <Routes>
          <Route
            element={
              <>
                <HostGuard />
                <Outlet />
              </>
            }
          >
            <Route element={<Layout />}>
            {/* Public routes (no session required) */}
            <Route path="/" element={<Home />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/waitlist" element={<WaitlistEntryRoute />} />
            <Route
              path="/faq"
              element={
                <MarketingOnlyRoute>
                  <Faq />
                </MarketingOnlyRoute>
              }
            />
            <Route
              path="/faq/how-it-works"
              element={
                <MarketingOnlyRoute>
                  <FaqHowItWorks />
                </MarketingOnlyRoute>
              }
            />
            <Route
              path="/status"
              element={
                <MarketingOnlyRoute>
                  <Status />
                </MarketingOnlyRoute>
              }
            />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/continue" element={<AppContinue />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/account" element={<AccountsPage />} />

            {/* Session-gated routes */}
            <Route element={<RequireSession />}>
              <Route
                path="/telegram/swap"
                element={
                  <RequireTelegramMiniAppEntry>
                    <Swap />
                  </RequireTelegramMiniAppEntry>
                }
              />
              <Route element={<RequireAccepted />}>
                <Route path="/explore/creators" element={<ExploreCreators />} />
                <Route path="/explore/content" element={<ExploreContent />} />
                <Route path="/explore/trends" element={<ExploreTrends />} />
                <Route path="/explore/transactions" element={<ExploreTransactions />} />
                <Route path="/explore/creators/:chain/:tokenAddress" element={<ExploreCreatorDetail />} />
                <Route path="/explore/creators/:chain/:tokenAddress/transactions" element={<ExploreCreatorTransactions />} />
                <Route path="/explore/content/:chain/:contentCoinAddress" element={<ExploreContentDetail />} />
                <Route path="/explore/content/:chain/:contentCoinAddress/transactions" element={<ExploreContentTransactions />} />
                <Route path="/explore/content/:chain/pool/:poolIdOrPoolKeyHash" element={<ExploreContentPoolAlias />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/positions" element={<Positions />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/portfolio/:address" element={<Portfolio />} />
                <Route
                  path="/deploy"
                  element={
                    <WithSmartWallets>
                      <DeployVault />
                    </WithSmartWallets>
                  }
                />
                <Route path="/coin/:address/manage" element={<CoinManage />} />
                <Route path="/creator/earnings" element={<CreatorEarnings />} />
                <Route path="/creator/:identifier/earnings" element={<CreatorEarnings />} />
                <Route path="/vote" element={<GaugeVoting />} />
                <Route path="/auction/bid/:address" element={<AuctionBid />} />
                <Route path="/complete-auction" element={<CompleteAuction />} />
                <Route path="/complete-auction/:strategy" element={<CompleteAuction />} />
                <Route path="/vault/:address" element={<Vault />} />
                <Route path="/agents" element={<AgentDirectory />} />
                <Route path="/agents/register" element={<AgentRegister />} />
                <Route path="/agents/uri-service" element={<AgentUriService />} />
                <Route path="/auction-demo" element={<AuctionDemo />} />
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/waitlist" replace />} />
                  <Route path="creator-access" element={<AdminCreatorAccess />} />
                  <Route path="waitlist" element={<AdminWaitlist />} />
                  <Route path="agent-setup" element={<AdminAgentSetup />} />
                  <Route path="imagegen" element={<AdminImageGeneration />} />
                  <Route
                    path="ops"
                    element={
                      <WithSmartWallets>
                        <AdminOps />
                      </WithSmartWallets>
                    }
                  />
                  <Route
                    path="deploy-strategies"
                    element={
                      <WithSmartWallets>
                        <AdminDeployStrategies />
                      </WithSmartWallets>
                    }
                  />
                </Route>
              </Route>
            </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AccountContextProvider>
    </AccessStateProvider>
  )
}

export default App
