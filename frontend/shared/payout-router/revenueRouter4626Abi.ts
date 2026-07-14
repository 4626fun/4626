/**
 * Lane-neutral RevenueRouter4626 ABI fragments shared by CreatorPayoutRouter
 * and AgentRevenueRouter consumers (HTTP keepers + KPR).
 *
 * Asset getters (`creatorCoin` / `agentToken`) remain in lane-specific extensions.
 */

export const REVENUE_ROUTER_4626_VIEW_ABI = [
  {
    type: 'function',
    name: 'burnStream',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'keeper',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'wrapper',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'shareOFT',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vault',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'swapPathToShareOFT',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'protocolRewardsClaimable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const REVENUE_ROUTER_4626_EXECUTION_ABI = [
  {
    type: 'function',
    name: 'processBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'actions',
        type: 'tuple[]',
        components: [
          { name: 'kind', type: 'uint8' },
          { name: 'tokenIn', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minOut', type: 'uint256' },
          { name: 'spender', type: 'address' },
          { name: 'swapTarget', type: 'address' },
          { name: 'swapCallData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'totalTokenOut', type: 'uint256' },
      { name: 'totalSharesQueued', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'claimAllProtocolRewards',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'claimed', type: 'uint256' }],
  },
] as const

/** Creator-lane asset getter (not on the shared surface). */
export const CREATOR_REVENUE_ROUTER_ASSET_ABI = [
  {
    type: 'function',
    name: 'creatorCoin',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

/** Agent-lane asset getter (not on the shared surface). */
export const AGENT_REVENUE_ROUTER_ASSET_ABI = [
  {
    type: 'function',
    name: 'agentToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const
