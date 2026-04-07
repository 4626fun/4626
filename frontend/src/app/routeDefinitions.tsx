import type { ReactNode } from 'react'
import { Route } from 'react-router-dom'

import {
  AccountsPage,
  AdminAgentSetup,
  AdminCreatorAccess,
  AdminDeployStrategies,
  AdminImageGeneration,
  AdminOps,
  AdminWaitlist,
  AgentDirectory,
  AgentRegister,
  AgentUriService,
  AuctionBid,
  AuctionDemo,
  CoinManage,
  CompleteAuction,
  CreatorEarnings,
  Deploy,
  DeployCoin,
  DeployVault,
  DistributeCcaLaunch,
  ExploreContent,
  ExploreContentDetail,
  ExploreContentPoolAlias,
  ExploreContentTransactions,
  ExploreCreatorDetail,
  ExploreCreators,
  ExploreCreatorTransactions,
  ExploreTransactions,
  ExploreTrends,
  ExploreVaults,
  Faq,
  FaqHowItWorks,
  GaugeVoting,
  Portfolio,
  Positions,
  Status,
  Swap,
  Vault,
} from './lazyRoutes'
import { SmartWalletRoute } from './routeGuards'

export type PathRouteDef = { path: string; element: ReactNode }

export function renderPathRoutes(
  routes: PathRouteDef[],
  transformElement?: (element: ReactNode) => ReactNode,
) {
  return routes.map(({ path, element }) => (
    <Route
      key={path}
      path={path}
      element={transformElement ? transformElement(element) : element}
    />
  ))
}

export const MARKETING_ONLY_ROUTES: PathRouteDef[] = [
  { path: '/faq', element: <Faq /> },
  { path: '/faq/how-it-works', element: <FaqHowItWorks /> },
  { path: '/cca', element: <DistributeCcaLaunch /> },
  { path: '/distribute/cca-launch', element: <DistributeCcaLaunch /> },
  { path: '/status', element: <Status /> },
]

export const ACCOUNT_ROUTES: PathRouteDef[] = [
  { path: '/accounts', element: <AccountsPage /> },
  { path: '/account', element: <AccountsPage /> },
]

export const EXPLORE_ROUTES: PathRouteDef[] = [
  { path: '/explore/creators', element: <ExploreCreators /> },
  { path: '/explore/content', element: <ExploreContent /> },
  { path: '/explore/vaults', element: <ExploreVaults /> },
  { path: '/explore/trends', element: <ExploreTrends /> },
  { path: '/explore/transactions', element: <ExploreTransactions /> },
  { path: '/explore/creators/:chain/:tokenAddress', element: <ExploreCreatorDetail /> },
  {
    path: '/explore/creators/:chain/:tokenAddress/transactions',
    element: <ExploreCreatorTransactions />,
  },
  { path: '/explore/content/:chain/:contentCoinAddress', element: <ExploreContentDetail /> },
  {
    path: '/explore/content/:chain/:contentCoinAddress/transactions',
    element: <ExploreContentTransactions />,
  },
  {
    path: '/explore/content/:chain/pool/:poolIdOrPoolKeyHash',
    element: <ExploreContentPoolAlias />,
  },
  { path: '/positions', element: <Positions /> },
]

export const APP_ACCEPTED_ROUTES: PathRouteDef[] = [
  { path: '/swap', element: <Swap /> },
  { path: '/portfolio', element: <Portfolio /> },
  { path: '/portfolio/:address', element: <Portfolio /> },
  {
    path: '/deploy',
    element: (
      <SmartWalletRoute>
        <Deploy />
      </SmartWalletRoute>
    ),
  },
  {
    path: '/deploy/coin',
    element: (
      <SmartWalletRoute>
        <DeployCoin />
      </SmartWalletRoute>
    ),
  },
  {
    path: '/deploy/vault',
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

export const ADMIN_CHILD_ROUTES: PathRouteDef[] = [
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
