import { Suspense, lazy, useMemo, type ReactNode } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { isAppOnlyPath } from '@/lib/appOnlyPaths'
import { AdminLayout } from './components/AdminLayout'
import { AppLoadingState } from '@/components/AppLoadingState'
import { Layout } from './components/Layout'
import { AccountContextProvider } from '@/wallet/accountContext'
import { getCanonicalMarketingWaitlistPath } from '@/lib/auth/waitlistEntry'
import { getHostMode, APP_ORIGIN, MARKETING_ORIGIN } from '@/lib/host'
import { useOptionalAccessContext, waitlistEntryHref } from './app/accessShared'

export {
  computeAcceptedFromAllowlist,
  getInitialTelegramMiniAppEntryResolution,
  hasTelegramLinkEntryContext,
  hasTelegramLinkQueryContext,
  resolveAccess,
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

function LayoutWithAccountContextOnly() {
  return (
    <AccountContextProvider>
      <Layout />
    </AccountContextProvider>
  )
}

function LayoutWithoutAccountContextOnly() {
  return <Layout interactive={false} chatEnabled={false} />
}

export function getGenericNotFoundCta(hostMode: import('@/lib/host').HostMode): {
  href: string
  label: string
  hint: string
} {
  if (hostMode === 'marketing') {
    return {
      href: getCanonicalMarketingWaitlistPath(),
      label: 'Join Waitlist',
      hint: 'Start from the canonical waitlist entry.',
    }
  }
  return {
    href: '/swap',
    label: 'Go To Trade',
    hint: 'Continue to the canonical app landing route.',
  }
}

const LazyAuthWalletShell = lazy(async () => {
  const [privyModule, web3Module] = await Promise.all([
    import('@/lib/privy/client'),
    import('./web3/Web3Providers'),
  ])
  const PrivyClientProvider = privyModule.PrivyClientProvider
  const WalletProviders = web3Module.WalletProviders
  return {
    default: function AppAuthShellBoundary() {
      return (
        <PrivyClientProvider>
          <WalletProviders>
            <Outlet />
          </WalletProviders>
        </PrivyClientProvider>
      )
    },
  }
})

const LazyAppPrivyShell = lazy(async () => {
  const m = await import('@/lib/privy/client')
  const PrivyClientProvider = m.PrivyClientProvider
  return {
    default: function AppPrivyShellBoundary() {
      return (
        <PrivyClientProvider>
          <Outlet />
        </PrivyClientProvider>
      )
    },
  }
})

const LazyAppAccessShell = lazy(async () => {
  const [accessModule, web3Module] = await Promise.all([
    import('./app/accessRuntime'),
    import('./web3/Web3Providers'),
  ])
  const AccessStateProvider = accessModule.AccessStateProvider
  const WalletProviders = web3Module.WalletProviders
  return {
    default: function AppAccessShellBoundary() {
      return (
        <WalletProviders>
          <AccessStateProvider>
            <Outlet />
          </AccessStateProvider>
        </WalletProviders>
      )
    },
  }
})

const LazyRequireSession = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireSession }
})

const LazyRequireAccepted = lazy(async () => {
  const m = await import('./app/accessRuntime')
  return { default: m.RequireAccepted }
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

const DistributeCcaLaunch = lazy(async () => {
  const m = await import('./pages/DistributeCcaLaunch')
  return { default: m.DistributeCcaLaunch }
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
  const access = useOptionalAccessContext()
  const genericCta = useMemo(() => getGenericNotFoundCta(getHostMode()), [])

  const appCta = useMemo(() => {
    if (!access) return genericCta
    if (!access.sessionValid) {
      return {
        href: waitlistEntryHref(access.marketingUrl),
        label: 'Sign In',
        hint: 'Sign in to get started.',
      }
    }
    if (!access.accepted) {
      return {
        href: waitlistEntryHref(access.marketingUrl),
        label: 'Join Waitlist',
        hint: 'This route requires accepted app access.',
      }
    }
    const tradeHref = access.hostMode === 'marketing' ? APP_ORIGIN + '/swap' : '/swap'
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
        <Route path="/404" element={<NotFoundPage />} />

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
          <Route
            path="/cca"
            element={
              <MarketingOnlyRoute>
                <DistributeCcaLaunch />
              </MarketingOnlyRoute>
            }
          />
          <Route
            path="/distribute/cca-launch"
            element={
              <MarketingOnlyRoute>
                <DistributeCcaLaunch />
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
              <LazyAuthWalletShell />
              </LazyRouteBoundary>
          }
        >
          <Route
          element={
            <LazyRouteBoundary>
              <LayoutWithAccountContextOnly />
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
          element={
            <LazyRouteBoundary>
              <LayoutWithoutAccountContextOnly />
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
                <Route path="/positions" element={<Positions />} />
              </Route>
            </Route>
          </Route>

          <Route
            element={
              <LazyRouteBoundary>
                <LazyAppPrivyShell />
              </LazyRouteBoundary>
            }
          >
            <Route
              element={
                <LazyRouteBoundary>
                  <LayoutWithAccountContextOnly />
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
                  <Route path="/swap" element={<Swap />} />
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
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
