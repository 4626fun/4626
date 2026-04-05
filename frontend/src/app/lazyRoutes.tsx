import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'

import { AppLoadingState } from '@/components/AppLoadingState'

export function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType<any> }
  })
}

export function lazyDefault<TModule extends { default: ComponentType<any> }>(
  loader: () => Promise<TModule>,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod.default }
  })
}

export const LazyAuthWalletBoundary = lazy(async () => {
  const [privyModule, web3Module] = await Promise.all([
    import('@/lib/privy/client'),
    import('../web3/Web3Providers'),
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

export const LazyPrivyBoundary = lazy(async () => {
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

export const LazyAccessBoundary = lazy(async () => {
  const [accessModule, web3Module] = await Promise.all([
    import('./accessRuntime'),
    import('../web3/Web3Providers'),
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

export const LazyRequireSession = lazyNamed(() => import('./accessRuntime'), 'RequireSession')
export const LazyRequireAccepted = lazyNamed(() => import('./accessRuntime'), 'RequireAccepted')
export const LazyRequireAdmin = lazyNamed(() => import('./accessRuntime'), 'RequireAdmin')

export function LazyRouteBoundary(props: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingState />}>{props.children}</Suspense>
}

export type LazyRouteComponent = ComponentType<any> | LazyExoticComponent<ComponentType<any>>

export function LazyGuardedOutlet(props: { guard: LazyRouteComponent }) {
  const Guard = props.guard
  return (
    <LazyRouteBoundary>
      <Guard />
    </LazyRouteBoundary>
  )
}

export const SmartWalletsRouteProvider = lazyNamed(
  () => import('@/lib/privy/SmartWalletsRouteProvider'),
  'SmartWalletsRouteProvider',
)

export const Vault = lazyNamed(() => import('../pages/Vault'), 'Vault')
export const CompleteAuction = lazyNamed(() => import('../pages/CompleteAuction'), 'CompleteAuction')
export const AuctionBid = lazyNamed(() => import('../pages/AuctionBid'), 'AuctionBid')
export const Deploy = lazyNamed(() => import('../pages/Deploy'), 'Deploy')
export const DeployCoin = lazyNamed(() => import('../pages/DeployCoin'), 'DeployCoin')
export const DeployVault = lazyNamed(() => import('../pages/DeployVault'), 'DeployVault')
export const Leaderboard = lazyNamed(() => import('../pages/Leaderboard'), 'Leaderboard')
export const CoinManage = lazyNamed(() => import('../pages/CoinManage'), 'CoinManage')
export const CreatorEarnings = lazyNamed(() => import('../pages/CreatorEarnings'), 'CreatorEarnings')
export const Faq = lazyNamed(() => import('../pages/Faq'), 'Faq')
export const FaqHowItWorks = lazyNamed(() => import('../pages/FaqHowItWorks'), 'FaqHowItWorks')
export const DistributeCcaLaunch = lazyNamed(() => import('../pages/DistributeCcaLaunch'), 'DistributeCcaLaunch')
export const Status = lazyNamed(() => import('../pages/Status'), 'Status')
export const AdminCreatorAccess = lazyNamed(() => import('../pages/AdminCreatorAccess'), 'AdminCreatorAccess')
export const AdminWaitlist = lazyNamed(() => import('../pages/AdminWaitlist'), 'AdminWaitlist')
export const AdminOps = lazyNamed(() => import('../pages/AdminOps'), 'AdminOps')
export const AdminDeployStrategies = lazyNamed(
  () => import('../pages/AdminDeployStrategies'),
  'AdminDeployStrategies',
)
export const AdminAgentSetup = lazyNamed(() => import('../pages/AdminAgentSetup'), 'AdminAgentSetup')
export const AdminImageGeneration = lazyNamed(
  () => import('../pages/AdminImageGeneration'),
  'AdminImageGeneration',
)
export const GaugeVoting = lazyDefault(() => import('../pages/GaugeVoting'))
export const AuctionDemo = lazyDefault(() => import('../pages/AuctionDemo'))
export const AgentDirectory = lazyNamed(() => import('../pages/AgentDirectory'), 'AgentDirectory')
export const AgentRegister = lazyNamed(() => import('../pages/AgentRegister'), 'AgentRegister')
export const AgentUriService = lazyNamed(() => import('../pages/AgentUriService'), 'AgentUriService')
export const ExploreCreators = lazyNamed(() => import('../pages/ExploreCreators'), 'ExploreCreators')
export const ExploreContent = lazyNamed(() => import('../pages/ExploreContent'), 'ExploreContent')
export const ExploreVaults = lazyNamed(() => import('../pages/ExploreVaults'), 'ExploreVaults')
export const ExploreTrends = lazyNamed(() => import('../pages/ExploreTrends'), 'ExploreTrends')
export const ExploreTransactions = lazyNamed(() => import('../pages/ExploreTransactions'), 'ExploreTransactions')
export const ExploreCreatorDetail = lazyNamed(
  () => import('../pages/ExploreCreatorDetail'),
  'ExploreCreatorDetail',
)
export const ExploreContentDetail = lazyNamed(
  () => import('../pages/ExploreContentDetail'),
  'ExploreContentDetail',
)
export const ExploreCreatorTransactions = lazyNamed(
  () => import('../pages/ExploreCreatorTransactions'),
  'ExploreCreatorTransactions',
)
export const ExploreContentTransactions = lazyNamed(
  () => import('../pages/ExploreContentTransactions'),
  'ExploreContentTransactions',
)
export const ExploreContentPoolAlias = lazyNamed(
  () => import('../pages/ExploreContentPoolAlias'),
  'ExploreContentPoolAlias',
)
export const Swap = lazyNamed(() => import('../pages/Swap'), 'Swap')
export const Positions = lazyNamed(() => import('../pages/Positions'), 'Positions')
export const Portfolio = lazyNamed(() => import('../pages/Portfolio'), 'Portfolio')
export const AccountsPage = lazyNamed(() => import('../pages/accounts/AccountsPage'), 'AccountsPage')
export const AppContinue = lazyNamed(() => import('../pages/AppContinue'), 'AppContinue')
