import type { ReactNode } from 'react'
import { Route } from 'react-router-dom'

import {
  AccountsPage,
  AddOwnerPage,
  RemoveOwnerPage,
  CswFundingPage,
  AdminAgentSetup,
  AdminCreatorAccess,
  AdminCreatorStrategyProvisioning,
  AdminDeployStrategies,
  AdminImageGeneration,
  AdminOps,
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
  CswSignatureProbe,
  ToshiProbe,
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
  ZoraConnectorProbe,
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
  { path: '/status', element: <Status /> },
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
  // `/add-owner` is a single-purpose surface that installs the user's Privy
  // embedded EOA onto their canonical Coinbase Smart Wallet via the
  // `prepare-add-privy-owner` lane. The address is resolved server-side from
  // the user's authenticated Privy session — the user never has to obtain or
  // paste an EOA address. Same passkey-via-prepareCalls submission lane that
  // the waitlist setup uses for owner installs.
  {
    path: '/add-owner',
    element: (
      <SmartWalletRoute>
        <AddOwnerPage />
      </SmartWalletRoute>
    ),
  },
  // `/remove-owner` is the sibling surface for removing an owner from the
  // canonical CSW. Routes through _submitOwnerViaSelfBuiltUserOp directly
  // (bypassing sendPreparedOwnerTx) so the submission goes through Relay's
  // /execute/call endpoint. Surfaces live on-chain owner-slot diagnostics
  // so users can see whether the signing path will validate before signing.
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
  // Dev probe for Privy Connect-mode cross-app capability with Zora.
  // The connector itself is flag-gated in `wagmi.ts`; the page renders a
  // "probe disabled" panel when the flag is off, so it's safe to leave this
  // route live even in production.
  {
    path: '/dev/zora-connector-probe',
    element: <ZoraConnectorProbe />,
  },
  {
    path: '/dev/csw-signature-probe',
    element: <CswSignatureProbe />,
  },
  // `/dev/toshi-probe` — minimal mobile diagnostic for /add-owner failures.
  // Runs each candidate wallet method (capabilities, signTypedData,
  // prepareCalls, sendCalls+paymaster, eth_sendTransaction) one tap at a time
  // against the connected provider so we can identify exactly which lane
  // Toshi/Base App accepts vs rejects without rebuilding the production page.
  {
    path: '/dev/toshi-probe',
    element: <ToshiProbe />,
  },
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
  {
    path: 'alfaclub-vigilante',
    element: (
      <SmartWalletRoute>
        <AlfaClubVigilante />
      </SmartWalletRoute>
    ),
  },
]
