import { Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
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

function AuthenticatedAppLayout() {
  return (
    <AccountContextProvider>
      <Layout />
    </AccountContextProvider>
  )
}

function PublicAppLayout() {
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

function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType<any> }
  })
}

function lazyDefault<TModule extends { default: ComponentType<any> }>(
  loader: () => Promise<TModule>,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod.default }
  })
}

const LazyAuthWalletBoundary = lazy(async () => {
  const [privyModule, web3Module] = await Promise.all([
    import('@/lib/privy/client'),
    import('./web3/Web3Providers'),
  ])
  const PrivyClientProvider = privyModule.PrivyClientProvider
  const WalletProviders = web3Module.WalletProviders
  return {
    default: function AuthenticatedWalletBoundary() {
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

const LazyPrivyBoundary = lazy(async () => {
  const m = await import('@/lib/privy/client')
  const PrivyClientProvider = m.PrivyClientProvider
  return {
    default: function PrivyRouteBoundary() {
      return (
        <PrivyClientProvider>
          <Outlet />
        </PrivyClientProvider>
      )
    },
  }
})

const LazyAccessBoundary = lazy(async () => {
  const [accessModule, web3Module] = await Promise.all([
    import('./app/accessRuntime'),
    import('./web3/Web3Providers'),
  ])
  const AccessStateProvider = accessModule.AccessStateProvider
  const WalletProviders = web3Module.WalletProviders
  return {
    default: function AccessRouteBoundary() {
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

const LazyRequireSession = lazyNamed(() => import('./app/accessRuntime'), 'RequireSession')
const LazyRequireAccepted = lazyNamed(() => import('./app/accessRuntime'), 'RequireAccepted')
const LazyRequireAdmin = lazyNamed(() => import('./app/accessRuntime'), 'RequireAdmin')

function LazyRouteBoundary(props: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingState />}>{props.children}</Suspense>
}

type LazyRouteComponent = ComponentType<any> | LazyExoticComponent<ComponentType<any>>

function LazyGuardedOutlet(props: { guard: LazyRouteComponent }) {
  const Guard = props.guard
  return (
    <LazyRouteBoundary>
      <Guard />
    </LazyRouteBoundary>
  )
}

function SmartWalletRoute(props: { children: ReactNode }) {
  return <SmartWalletsRouteProvider>{props.children}</SmartWalletsRouteProvider>
}

function marketingOnlyElement(element: ReactNode) {
  return <MarketingOnlyRoute>{element}</MarketingOnlyRoute>
}

function SessionAcceptedRoute(props: { children?: ReactNode }) {
  return (
    <LazyRouteBoundary>
      <LazyRequireSession>
        <LazyRouteBoundary>
          <LazyRequireAccepted>{props.children}</LazyRequireAccepted>
        </LazyRouteBoundary>
      </LazyRequireSession>
    </LazyRouteBoundary>
  )
}

const Vault = lazyNamed(() => import('./pages/Vault'), 'Vault')
const CompleteAuction = lazyNamed(() => import('./pages/CompleteAuction'), 'CompleteAuction')
const AuctionBid = lazyNamed(() => import('./pages/AuctionBid'), 'AuctionBid')
const DeployVault = lazyNamed(() => import('./pages/DeployVault'), 'DeployVault')
const SmartWalletsRouteProvider = lazyNamed(() => import('@/lib/privy/SmartWalletsRouteProvider'), 'SmartWalletsRouteProvider')
const Leaderboard = lazyNamed(() => import('./pages/Leaderboard'), 'Leaderboard')
const CoinManage = lazyNamed(() => import('./pages/CoinManage'), 'CoinManage')
const CreatorEarnings = lazyNamed(() => import('./pages/CreatorEarnings'), 'CreatorEarnings')
const Faq = lazyNamed(() => import('./pages/Faq'), 'Faq')
const FaqHowItWorks = lazyNamed(() => import('./pages/FaqHowItWorks'), 'FaqHowItWorks')
const DistributeCcaLaunch = lazyNamed(() => import('./pages/DistributeCcaLaunch'), 'DistributeCcaLaunch')
const Status = lazyNamed(() => import('./pages/Status'), 'Status')
const AdminCreatorAccess = lazyNamed(() => import('./pages/AdminCreatorAccess'), 'AdminCreatorAccess')
const AdminWaitlist = lazyNamed(() => import('./pages/AdminWaitlist'), 'AdminWaitlist')
const AdminOps = lazyNamed(() => import('./pages/AdminOps'), 'AdminOps')
const AdminDeployStrategies = lazyNamed(() => import('./pages/AdminDeployStrategies'), 'AdminDeployStrategies')
const AdminAgentSetup = lazyNamed(() => import('./pages/AdminAgentSetup'), 'AdminAgentSetup')
const AdminImageGeneration = lazyNamed(() => import('./pages/AdminImageGeneration'), 'AdminImageGeneration')
const GaugeVoting = lazyDefault(() => import('./pages/GaugeVoting'))
const AuctionDemo = lazyDefault(() => import('./pages/AuctionDemo'))
const AgentDirectory = lazyNamed(() => import('./pages/AgentDirectory'), 'AgentDirectory')
const AgentRegister = lazyNamed(() => import('./pages/AgentRegister'), 'AgentRegister')
const AgentUriService = lazyNamed(() => import('./pages/AgentUriService'), 'AgentUriService')
const ExploreCreators = lazyNamed(() => import('./pages/ExploreCreators'), 'ExploreCreators')
const ExploreContent = lazyNamed(() => import('./pages/ExploreContent'), 'ExploreContent')
const ExploreTrends = lazyNamed(() => import('./pages/ExploreTrends'), 'ExploreTrends')
const ExploreTransactions = lazyNamed(() => import('./pages/ExploreTransactions'), 'ExploreTransactions')
const ExploreCreatorDetail = lazyNamed(() => import('./pages/ExploreCreatorDetail'), 'ExploreCreatorDetail')
const ExploreContentDetail = lazyNamed(() => import('./pages/ExploreContentDetail'), 'ExploreContentDetail')
const ExploreCreatorTransactions = lazyNamed(() => import('./pages/ExploreCreatorTransactions'), 'ExploreCreatorTransactions')
const ExploreContentTransactions = lazyNamed(() => import('./pages/ExploreContentTransactions'), 'ExploreContentTransactions')
const ExploreContentPoolAlias = lazyNamed(() => import('./pages/ExploreContentPoolAlias'), 'ExploreContentPoolAlias')
const Swap = lazyNamed(() => import('./pages/Swap'), 'Swap')
const Positions = lazyNamed(() => import('./pages/Positions'), 'Positions')
const Portfolio = lazyNamed(() => import('./pages/Portfolio'), 'Portfolio')
const AccountsPage = lazyNamed(() => import('./pages/accounts/AccountsPage'), 'AccountsPage')
const AppContinue = lazyNamed(() => import('./pages/AppContinue'), 'AppContinue')

const MARKETING_ONLY_ROUTES: Array<{ path: string; element: ReactNode }> = [
  { path: '/faq', element: <Faq /> },
  { path: '/faq/how-it-works', element: <FaqHowItWorks /> },
  { path: '/cca', element: <DistributeCcaLaunch /> },
  { path: '/distribute/cca-launch', element: <DistributeCcaLaunch /> },
  { path: '/status', element: <Status /> },
]

type PathRouteDef = { path: string; element: ReactNode }

function renderPathRoutes(
  routes: PathRouteDef[],
  transformElement?: (element: ReactNode) => ReactNode,
) {
  return routes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={transformElement ? transformElement(route.element) : route.element}
    />
  ))
}

const ACCOUNT_ROUTES: PathRouteDef[] = [
  { path: '/continue', element: <AppContinue /> },
  { path: '/accounts', element: <AccountsPage /> },
  { path: '/account', element: <AccountsPage /> },
]

const EXPLORE_ROUTES: PathRouteDef[] = [
  { path: '/explore/creators', element: <ExploreCreators /> },
  { path: '/explore/content', element: <ExploreContent /> },
  { path: '/explore/trends', element: <ExploreTrends /> },
  { path: '/explore/transactions', element: <ExploreTransactions /> },
  { path: '/explore/creators/:chain/:tokenAddress', element: <ExploreCreatorDetail /> },
  { path: '/explore/creators/:chain/:tokenAddress/transactions', element: <ExploreCreatorTransactions /> },
  { path: '/explore/content/:chain/:contentCoinAddress', element: <ExploreContentDetail /> },
  { path: '/explore/content/:chain/:contentCoinAddress/transactions', element: <ExploreContentTransactions /> },
  { path: '/explore/content/:chain/pool/:poolIdOrPoolKeyHash', element: <ExploreContentPoolAlias /> },
  { path: '/positions', element: <Positions /> },
]

const APP_ACCEPTED_ROUTES: PathRouteDef[] = [
  { path: '/swap', element: <Swap /> },
  { path: '/portfolio', element: <Portfolio /> },
  { path: '/portfolio/:address', element: <Portfolio /> },
  {
    path: '/deploy',
    element: (
      <SmartWalletRoute>
        <DeployVault />
      </SmartWalletRoute>
    ),
  },
  { path: '/coin/:address/manage', element: <CoinManage /> },
  { path: '/creator/earnings', element: <CreatorEarnings /> },
  { path: '/creator/:identifier/earnings', element: <CreatorEarnings /> },
  { path: '/vote', element: <GaugeVoting /> },
  { path: '/auction/bid/:address', element: <AuctionBid /> },
  { path: '/complete-auction', element: <CompleteAuction /> },
  { path: '/complete-auction/:strategy', element: <CompleteAuction /> },
  { path: '/vault/:address', element: <Vault /> },
  { path: '/agents', element: <AgentDirectory /> },
  { path: '/agents/register', element: <AgentRegister /> },
  { path: '/agents/uri-service', element: <AgentUriService /> },
  { path: '/auction-demo', element: <AuctionDemo /> },
]

const ADMIN_CHILD_ROUTES: PathRouteDef[] = [
  { path: 'creator-access', element: <AdminCreatorAccess /> },
  { path: 'waitlist', element: <AdminWaitlist /> },
  { path: 'agent-setup', element: <AdminAgentSetup /> },
  { path: 'imagegen', element: <AdminImageGeneration /> },
  {
    path: 'ops',
    element: (
      <SmartWalletRoute>
        <AdminOps />
      </SmartWalletRoute>
    ),
  },
  {
    path: 'deploy-strategies',
    element: (
      <SmartWalletRoute>
        <AdminDeployStrategies />
      </SmartWalletRoute>
    ),
  },
]

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

        <Route element={<Layout interactive={false} />}>
          {renderPathRoutes(MARKETING_ONLY_ROUTES, marketingOnlyElement)}
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        <Route
          element={<LazyGuardedOutlet guard={LazyAuthWalletBoundary} />}
        >
          <Route element={<AuthenticatedAppLayout />}>
            {renderPathRoutes(ACCOUNT_ROUTES)}
          </Route>
        </Route>

        <Route
          element={<LazyGuardedOutlet guard={LazyAccessBoundary} />}
        >
          <Route element={<PublicAppLayout />}>
            <Route element={<SessionAcceptedRoute />}>
              {renderPathRoutes(EXPLORE_ROUTES)}
            </Route>
          </Route>

          <Route
            element={<LazyGuardedOutlet guard={LazyPrivyBoundary} />}
          >
            <Route element={<AuthenticatedAppLayout />}>
              <Route element={<SessionAcceptedRoute />}>
                {renderPathRoutes(APP_ACCEPTED_ROUTES)}

                <Route element={<LazyGuardedOutlet guard={LazyRequireAdmin} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/waitlist" replace />} />
                    {renderPathRoutes(ADMIN_CHILD_ROUTES)}
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
