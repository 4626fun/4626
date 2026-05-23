import type { ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'

import {
  AccountsPage,
  AddOwnerPage,
  AmoeQuickTasks,
  RemoveOwnerPage,
  CswFundingPage,
  AdminAgentSetup,
  AdminCreatorAccess,
  AdminCreatorStrategyProvisioning,
  AdminDeployStrategies,
  AdminImageGeneration,
  AdminOps,
  AdminControlPlane,
  AdminUserOpHealth,
  AlfaClubVigilante,
  AdminWaitlist,
  AgentDirectory,
  AgentRegister,
  AgentUriService,
  AlfaClubLiquidity,
  AuctionBid,
  AuctionDemo,
  CoinManage,
  CompleteAuction,
  CreatorEarnings,
  CreatorStrategyFeatures,
  MetaballOsProbe,
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
  ExploreListLayout,
  ExploreTransactions,
  ExploreTrends,
  ExploreVaults,
  Faq,
  FaqHowItWorks,
  GaugeVoting,
  Positions,
  Status,
  Swap,
  Vault,
} from './lazyRoutes'
import { SmartWalletRoute } from './routeGuards'

export type PathRouteDef = {
  path: string
  element: ReactNode
  index?: boolean
  children?: PathRouteDef[]
}

export function renderPathRoutes(
  routes: PathRouteDef[],
  transformElement?: (element: ReactNode) => ReactNode,
) {
  return routes.map(({ path, element, index, children }) => (
    <Route
      key={index ? `${path}:index` : path}
      path={index ? undefined : path}
      index={index}
      element={transformElement ? transformElement(element) : element}
    >
      {children ? renderPathRoutes(children, transformElement) : null}
    </Route>
  ))
}

export const MARKETING_ONLY_ROUTES: PathRouteDef[] = [
  { path: '/faq', element: <Faq /> },
  { path: '/faq/how-it-works', element: <FaqHowItWorks /> },
  { path: '/cca', element: <DistributeCcaLaunch /> },
  { path: '/status', element: <Status /> },
  { path: '/dev/metaball-os', element: <MetaballOsProbe /> },
]

/**
 * `/accounts` is the identity + execution-scope surface (canonical CSW,
 * signers, sub-account state, advanced owner recovery).
 *
 * Previously this route redirected to `/waitlist` because the waitlist
 * flow had absorbed the old `/accounts` content. Reinstated 2026-04-19
 * so the new identity card + ExecutionScopeCard + AutoProvisionMount
 * actually render somewhere users can reach them. `/waitlist` stays
 * focused on net-new onboarding (Zora link, owner install, points)
 * while `/accounts` handles day-two operations on an already-linked
 * identity.
 *
 * Wrapped in `SmartWalletRoute` so `useSmartWallets()` is available —
 * the sub-account SpendPermission flow signs via Privy's ERC-1271
 * smart-wallet client for Zora-cross-app profiles whose Privy embedded
 * EOA isn't on the parent CSW owner list.
 */
export const ACCOUNT_ROUTES: PathRouteDef[] = [
  {
    path: '/accounts',
    element: (
      <SmartWalletRoute>
        <AccountsPage />
      </SmartWalletRoute>
    ),
  },
  // `/add-owner` installs the user's Privy embedded EOA onto their canonical CSW
  // via Relay (`preview-add-owner` → `useAddOwnerFlow`). The embedded EOA is
  // resolved server-side from the Privy session; an existing CSW owner approves
  // the mutation. Same lane as waitlist `AddOwnerSigningPanel` / `?setup=owner-install`.
  {
    path: '/add-owner',
    element: (
      <SmartWalletRoute>
        <AddOwnerPage />
      </SmartWalletRoute>
    ),
  },
  // `/remove-owner` removes an owner from the canonical CSW via the same Relay
  // deposit + solver-fill lane as add-owner (`preview-remove-owner` →
  // `useRemoveOwnerFlow` → `executeOwnerMutationViaRelay`).
  {
    path: '/remove-owner',
    element: (
      <SmartWalletRoute>
        <RemoveOwnerPage />
      </SmartWalletRoute>
    ),
  },
  // `/csw-funding` shows the three funding sources for CSW UserOps on Base
  // (native ETH, EntryPoint deposit, RelayDepository total) and lets anyone
  // top up the EntryPoint deposit via depositTo(csw) payable. Pure
  // diagnostics + a single self-contained top-up form; no owner mutation.
  {
    path: '/csw-funding',
    element: (
      <SmartWalletRoute>
        <CswFundingPage />
      </SmartWalletRoute>
    ),
  },
]

export const EXPLORE_LIST_CHILD_ROUTES: PathRouteDef[] = [
  { path: 'creators', index: true, element: <Navigate to="/explore/creators" replace /> },
  { path: 'creators', element: <ExploreCreators /> },
  { path: 'content', element: <ExploreContent /> },
  { path: 'vaults', element: <ExploreVaults /> },
  { path: 'trends', element: <ExploreTrends /> },
  { path: 'transactions', element: <ExploreTransactions /> },
]

export const EXPLORE_ROUTES: PathRouteDef[] = [
  {
    path: '/explore',
    element: <ExploreListLayout />,
    children: EXPLORE_LIST_CHILD_ROUTES,
  },
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
  { path: '/amoe/tasks', element: <AmoeQuickTasks /> },
  { path: '/swap', element: <Swap /> },
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
  { path: '/creator/strategy/features', element: <CreatorStrategyFeatures /> },
  { path: '/creator/:identifier/strategy/features', element: <CreatorStrategyFeatures /> },
  { path: '/vote', element: <GaugeVoting /> },
  { path: '/auction/bid/:address', element: <AuctionBid /> },
  { path: '/complete-auction', element: <CompleteAuction /> },
  { path: '/complete-auction/:strategy', element: <CompleteAuction /> },
  { path: '/vault/:address', element: <Vault /> },
  { path: '/agents', element: <AgentDirectory /> },
  { path: '/agents/register', element: <AgentRegister /> },
  { path: '/agents/uri-service', element: <AgentUriService /> },
  {
    path: '/alfaclub/liquidity',
    element: (
      <SmartWalletRoute>
        <AlfaClubLiquidity />
      </SmartWalletRoute>
    ),
  },
  { path: '/auction-demo', element: <AuctionDemo /> },
]

export const ADMIN_CHILD_ROUTES: PathRouteDef[] = [
  { path: 'creator-access', element: <AdminCreatorAccess /> },
  { path: 'creator-strategy-provisioning', element: <AdminCreatorStrategyProvisioning /> },
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
  { path: 'userop-health', element: <AdminUserOpHealth /> },
  { path: 'control-plane', element: <AdminControlPlane /> },
  {
    path: 'alfaclub-vigilante',
    element: (
      <SmartWalletRoute>
        <AlfaClubVigilante />
      </SmartWalletRoute>
    ),
  },
]
