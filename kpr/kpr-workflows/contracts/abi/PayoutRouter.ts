/**
 * Revenue-router ABI fragments for KPR payout-integrity workflow.
 *
 * Neutral getters come from IRevenueRouter4626. Creator/Agent asset getters are
 * explicit lane extensions.
 */

import {
  AGENT_REVENUE_ROUTER_ASSET_ABI,
  CREATOR_REVENUE_ROUTER_ASSET_ABI,
  REVENUE_ROUTER_4626_VIEW_ABI,
} from '../../../../frontend/shared/payout-router/revenueRouter4626Abi.js'

export const RevenueRouter4626ABI = REVENUE_ROUTER_4626_VIEW_ABI

/** @deprecated Prefer RevenueRouter4626ABI + CreatorRevenueRouterAssetABI */
export const PayoutRouterABI = [
  ...REVENUE_ROUTER_4626_VIEW_ABI.filter((item) =>
    ['burnStream', 'keeper', 'wrapper', 'shareOFT', 'swapPathToShareOFT'].includes(item.name),
  ),
  ...CREATOR_REVENUE_ROUTER_ASSET_ABI,
] as const

export const CreatorRevenueRouterAssetABI = CREATOR_REVENUE_ROUTER_ASSET_ABI
export const AgentRevenueRouterAssetABI = AGENT_REVENUE_ROUTER_ASSET_ABI

export const CreatorOVaultWrapperABI = [
  {
    type: 'function',
    name: 'isWhitelisted',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const
