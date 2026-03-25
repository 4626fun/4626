import { Suspense, lazy, useMemo, type ReactNode } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { AdminLayout } from './components/AdminLayout'
import { AppLoadingState } from '@/components/AppLoadingState'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { getHostMode, getMarketingBaseUrl, APP_ORIGIN, MARKETING_ORIGIN } from '@/lib/host'
import { useOptionalAccessContext, waitlistEntryHref, withReason } from './app/accessShared'

export {
  computeAcceptedFromAllowlist,
  getInitialTelegramMiniAppEntryResolution,
  hasTelegramLinkEntryContext,
  hasTelegramLinkQueryContext,
  resolveAllowlistMode,
  resolveTelegramMiniAppEntryBootstrap,
} from './app/accessShared'

/** Redirect from 4626.fun to v1.4626.fun when user hits app-only routes. */
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
export function getWaitlistEntryRouteTarget(params: {
  hostMode: import('@/lib/host').HostMode
  search: string
}): { kind: 'internal'; to: string } | { kind: 'external'; to: string } {
  const search = params.search || ''
  if (params.hostMode === 'marketing') {
    return { kind: 'internal', to: `/${search}#waitlist` }
  }
  return { kind: 'external', to: `${MARKETING_ORIGIN}/${search}#waitlist` }
}

function WaitlistEntryRoute() {
  const location = useLocation()
  const target = getWaitlistEntryRouteTarget({
    hostMode: getHostMode(),
    search: location.search || '',
  })

  if (target.kind === 'internal') {
    return <Navigate to={target.to} replace />
  }

  if (typeof window !== 'undefined') window.location.replace(target.to)
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

function LayoutOnly() {
  return <Layout interactive={false} />
}

const LazyAppAuthShell = lazy(() => import('./app/AppAuthShell'))

const LazyAppAccessShell = lazy(() => import('./app/AppAccessShell'))

const LazyLayoutWithAccountContext = lazy(() => import('./app/LayoutWithAccountContext'))

const LazyRequireSession = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireSession }
})

const LazyRequireAccepted = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireAccepted }
})

const LazyRequireTelegramMiniAppEntry = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireTelegramMiniAppEntry }
})

const LazyRequireAdmin = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireAdmin }
})

function LazyRouteBoundary(props: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingState />}>{props.children}</Suspense>
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

const TelegramLink = lazy(async () => {
  const m = await import('./pages/TelegramLink')
  return { default: m.TelegramLink }
})

const TelegramMenu = lazy(async () => {
  const m = await import('./pages/TelegramMenu')
  return { default: m.TelegramMenu }
})

function NotFoundPage() {
  const location = useLocation()
  const access = useOptionalAccessContext()
  const genericCta = useMemo(() => {
    if (getHostMode() === 'marketing') {
      return {
        href: waitlistEntryHref(getMarketingBaseUrl(), 'needs-session'),
        label: 'Join Waitlist',
        hint: 'Start from the canonical waitlist entry.',
      }
    }
    return {
      href: withReason('/swap', 'not-found'),
      label: 'Go To Trade',
      hint: 'Continue to the canonical app landing route.',
    }
  }, [])

  const appCta = useMemo(() => {
    if (!access) return genericCta
    if (!access.sessionValid) {
      return {
        href: waitlistEntryHref(access.marketingUrl, 'needs-session'),
        label: 'Sign In',
        hint: 'Sign in to get started.',
      }
    }
    if (!access.accepted) {
      return {
        href: waitlistEntryHref(access.marketingUrl, 'needs-acceptance'),
        label: 'Join Waitlist',
        hint: 'This route requires accepted app access.',
      }
    }
    const tradeHref = access.hostMode === 'marketing' ? APP_ORIGIN + '/swap' : withReason('/swap', 'not-found')
    return { href: tradeHref, label: 'Go To Trade', hint: 'Your session is valid. Continue to the canonical app landing route.' }
  }, [access, genericCta])

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
    <Routes>
      <Route
        element={
          <>
            <HostGuard />
            <Outlet />
          </>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/waitlist" element={<WaitlistEntryRoute />} />

        <Route element={<LayoutOnly />}>
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
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route
            path="/status"
            element={
              <MarketingOnlyRoute>
                <Status />
              </MarketingOnlyRoute>
            }
          />
        </Route>

        <Route
          element={
            <LazyRouteBoundary>
              <LazyAppAuthShell />
            </LazyRouteBoundary>
          }
        >
          <Route
            element={
              <LazyRouteBoundary>
                <LazyLayoutWithAccountContext />
              </LazyRouteBoundary>
            }
          >
            <Route path="/continue" element={<AppContinue />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/account" element={<AccountsPage />} />
          </Route>
        </Route>

        <Route
          element={
            <LazyRouteBoundary>
              <LazyAppAccessShell />
            </LazyRouteBoundary>
          }
        >
          <Route
            path="/telegram/menu"
            element={
              <LazyRouteBoundary>
                <LazyRequireTelegramMiniAppEntry>
                  <TelegramMenu />
                </LazyRequireTelegramMiniAppEntry>
              </LazyRouteBoundary>
            }
          />
          <Route
            path="/telegram/link"
            element={
              <LazyRouteBoundary>
                <LazyRequireTelegramMiniAppEntry>
                  <TelegramLink />
                </LazyRequireTelegramMiniAppEntry>
              </LazyRouteBoundary>
            }
          />

          <Route
            element={
              <LazyRouteBoundary>
                <LazyLayoutWithAccountContext />
              </LazyRouteBoundary>
            }
          >
            <Route
              element={
                <LazyRouteBoundary>
                  <LazyRequireSession />
                </LazyRouteBoundary>
              }
            >
              <Route
                element={
                  <LazyRouteBoundary>
                    <LazyRequireAccepted />
                  </LazyRouteBoundary>
                }
              >
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

              <Route
                element={
                  <LazyRouteBoundary>
                    <LazyRequireAdmin />
                  </LazyRouteBoundary>
                }
              >
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
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
