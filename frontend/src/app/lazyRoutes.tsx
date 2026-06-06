import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { SmartWalletsRouteProvider as SmartWalletsRouteProviderComponent } from '@/lib/privy/SmartWalletsRouteProvider'
import { Swap as SwapPage } from '../pages/Swap'

function isDynamicImportLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  )
}

const DEPLOY_VAULT_IMPORT_RELOAD_KEY = 'cv:deploy-vault:import-reload'

export function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType<any> }
  })
}

export function lazyNamedWithImportRecovery<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
  options?: { reloadOnceKey?: string },
) {
  return lazy(async () => {
    try {
      const mod = await loader()
      if (options?.reloadOnceKey && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(options.reloadOnceKey)
      }
      return { default: mod[exportName] as ComponentType<any> }
    } catch (error) {
      const reloadKey = options?.reloadOnceKey
      if (
        import.meta.env.DEV &&
        reloadKey &&
        typeof window !== 'undefined' &&
        typeof sessionStorage !== 'undefined' &&
        isDynamicImportLoadError(error) &&
        !sessionStorage.getItem(reloadKey)
      ) {
        sessionStorage.setItem(reloadKey, '1')
        window.location.reload()
        await new Promise(() => {})
      }
      throw error
    }
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
  return <Suspense fallback={<AppLoadingRegistrar />}>{props.children}</Suspense>
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

// Keep this route-scoped provider eagerly imported in local dev.
// Lazy-loading can race with Vite HMR updates and leave a rejected dynamic
// import promise in the root boundary.
export const SmartWalletsRouteProvider = SmartWalletsRouteProviderComponent

export const Vault = lazyNamed(() => import('../pages/Vault'), 'Vault')
export const CompleteAuction = lazyNamed(() => import('../pages/auction/CompleteAuction'), 'CompleteAuction')
export const AuctionBid = lazyNamed(() => import('../pages/auction/AuctionBid'), 'AuctionBid')
export const Deploy = lazyNamed(() => import('../pages/deploy/Deploy'), 'Deploy')
export const DeployCoin = lazyNamed(() => import('../pages/deploy/DeployCoin'), 'DeployCoin')
// Mega-module: after Vite/esbuild restart (common on WSL deploy dry-run), a rejected lazy
// import promise traps /deploy/vault behind RootErrorBoundary until a hard reload.
export const DeployVault = lazyNamedWithImportRecovery(
  () => import('../pages/deploy/DeployVault'),
  'DeployVault',
  { reloadOnceKey: DEPLOY_VAULT_IMPORT_RELOAD_KEY },
)
export const Leaderboard = lazyNamed(() => import('../pages/Leaderboard'), 'Leaderboard')
export const CoinManage = lazyNamed(() => import('../pages/CoinManage'), 'CoinManage')
export const CreatorEarnings = lazyNamed(() => import('../pages/CreatorEarnings'), 'CreatorEarnings')
export const CreatorStrategyFeatures = lazyNamed(
  () => import('../pages/CreatorStrategyFeatures'),
  'CreatorStrategyFeatures',
)
export const Faq = lazyNamed(() => import('../pages/Faq'), 'Faq')
export const FaqHowItWorks = lazyNamed(() => import('../pages/FaqHowItWorks'), 'FaqHowItWorks')
export const Arena = lazyNamed(() => import('../pages/Arena'), 'Arena')
export const DistributeCcaLaunch = lazyNamed(() => import('../pages/DistributeCcaLaunch'), 'DistributeCcaLaunch')
export const Status = lazyNamed(() => import('../pages/status/Status'), 'Status')
export const AdminCreatorAccess = lazyNamed(() => import('../pages/admin/AdminCreatorAccess'), 'AdminCreatorAccess')
export const AdminWaitlist = lazyNamed(() => import('../pages/admin/AdminWaitlist'), 'AdminWaitlist')
export const AdminOps = lazyNamed(() => import('../pages/admin/AdminOps'), 'AdminOps')
export const AlfaClubVigilante = lazyNamed(
  () => import('../pages/admin/AlfaClubVigilante'),
  'AlfaClubVigilante',
)
export const AdminDeployStrategies = lazyNamed(
  () => import('../pages/admin/AdminDeployStrategies'),
  'AdminDeployStrategies',
)
export const AdminCreatorStrategyProvisioning = lazyNamed(
  () => import('../pages/admin/AdminCreatorStrategyProvisioning'),
  'AdminCreatorStrategyProvisioning',
)
export const AdminAgentSetup = lazyNamed(() => import('../pages/admin/AdminAgentSetup'), 'AdminAgentSetup')
export const AdminImageGeneration = lazyNamed(
  () => import('../pages/admin/AdminImageGeneration'),
  'AdminImageGeneration',
)
export const AdminUserOpHealth = lazyNamed(
  () => import('../pages/admin/AdminUserOpHealth'),
  'AdminUserOpHealth',
)
export const AdminControlPlane = lazyNamed(
  () => import('../pages/admin/AdminControlPlane'),
  'AdminControlPlane',
)
export const GaugeVoting = lazyDefault(() => import('../pages/GaugeVoting'))
export const AuctionDemo = lazyDefault(() => import('../pages/auction/AuctionDemo'))
export const AgentDirectory = lazyNamed(() => import('../pages/agents/AgentDirectory'), 'AgentDirectory')
export const AgentRegister = lazyNamed(() => import('../pages/agents/AgentRegister'), 'AgentRegister')
export const AgentUriService = lazyNamed(() => import('../pages/agents/AgentUriService'), 'AgentUriService')
export const ExploreListLayout = lazyNamed(
  () => import('../components/explore/ExploreListLayout'),
  'ExploreListLayout',
)
export const ExploreCreators = lazyNamed(() => import('../pages/explore/ExploreCreators'), 'ExploreCreators')
export const ExploreContent = lazyNamed(() => import('../pages/explore/ExploreContent'), 'ExploreContent')
export const ExploreVaults = lazyNamed(() => import('../pages/explore/ExploreVaults'), 'ExploreVaults')
export const ExploreTrends = lazyNamed(() => import('../pages/explore/ExploreTrends'), 'ExploreTrends')
export const ExploreTransactions = lazyNamed(() => import('../pages/explore/ExploreTransactions'), 'ExploreTransactions')
export const ExploreCreatorDetail = lazyNamed(
  () => import('../pages/explore/ExploreCreatorDetail'),
  'ExploreCreatorDetail',
)
export const ExploreContentDetail = lazyNamed(
  () => import('../pages/explore/ExploreContentDetail'),
  'ExploreContentDetail',
)
export const ExploreCreatorTransactions = lazyNamed(
  () => import('../pages/explore/ExploreCreatorTransactions'),
  'ExploreCreatorTransactions',
)
export const ExploreContentTransactions = lazyNamed(
  () => import('../pages/explore/ExploreContentTransactions'),
  'ExploreContentTransactions',
)
export const ExploreContentPoolAlias = lazyNamed(
  () => import('../pages/explore/ExploreContentPoolAlias'),
  'ExploreContentPoolAlias',
)
// Keep the heavily edited trade surface out of React.lazy during local
// development. Vite can otherwise leave a tab holding a rejected lazy import
// promise after HMR/server restarts, which traps `/swap` behind the root
// boundary even once the module is available again.
export const Swap = SwapPage
export const AlfaClubLiquidity = lazyNamed(
  () => import('../pages/AlfaClubLiquidity'),
  'AlfaClubLiquidity',
)
export const Positions = lazyNamed(() => import('../pages/Positions'), 'Positions')
export const AccountsPage = lazyNamed(() => import('../pages/accounts/AccountsPage'), 'AccountsPage')
export const AddOwnerBaseApp = lazyNamed(
  () => import('../pages/AddOwnerBaseApp'),
  'AddOwnerBaseApp',
)
export const MetaballOsProbe = lazyNamed(
  () => import('../pages/dev/MetaballOsProbe'),
  'MetaballOsProbe',
)
export const TacticalTokenMap = lazyNamed(
  () => import('../pages/dev/TacticalTokenMap'),
  'TacticalTokenMap',
)
export const AmoeQuickTasks = lazyNamed(() => import('../pages/AmoeQuickTasks'), 'AmoeQuickTasks')
