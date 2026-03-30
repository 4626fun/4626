/**
 * CreatorGaugeController ABI fragments for CRE payout-integrity workflow.
 *
 * Only includes the read-only functions needed for monitoring.
 *
 * Selector stability: `burnShareBps`, `lotteryShareBps`, `creatorShareBps`, and
 * `protocolShareBps` must match the on-chain public getters (camelCase). The gauge
 * uses `uint256 public constant` with these names so splits are immutable without
 * changing function selectors.
 */

export const GaugeControllerABI = [
  {
    type: "function",
    name: "burnShareBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lotteryShareBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creatorShareBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolShareBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vault",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creatorTreasury",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastDistribution",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "jackpotReserve",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSharesBurned",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const
