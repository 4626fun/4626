/**
 * Lane-neutral tradeFeeCollector ABI fragments.
 *
 * CreatorGaugeController and AgentGaugeController share these selectors.
 * Ongoing-treasury getters remain lane-specific (`creatorTreasury` /
 * `agentTreasury`, `creatorShareBps` / `treasuryShareBps`).
 */

export const TradeFeeCollector4626ABI = [
  {
    type: 'function',
    name: 'burnShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lotteryShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    name: 'getJackpotReserve',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableJackpotReserve',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeSplit',
    inputs: [],
    outputs: [
      { name: 'burn', type: 'uint256' },
      { name: 'lottery', type: 'uint256' },
      { name: 'ongoingTreasury', type: 'uint256' },
      { name: 'protocol', type: 'uint256' },
    ],
    stateMutability: 'pure',
  },
] as const

/** Creator-lane ongoing treasury surface. */
export const CreatorTradeFeeCollectorExtensionABI = [
  {
    type: 'function',
    name: 'creatorShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creatorTreasury',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastDistribution',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'jackpotReserve',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSharesBurned',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

/** Agent-lane ongoing treasury surface. */
export const AgentTradeFeeCollectorExtensionABI = [
  {
    type: 'function',
    name: 'treasuryShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentTreasury',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const
