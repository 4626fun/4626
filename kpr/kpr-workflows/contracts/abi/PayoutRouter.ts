/**
 * PayoutRouter ABI fragments for KPR payout-integrity workflow.
 *
 * Only includes read-only functions needed for monitoring.
 */

export const PayoutRouterABI = [
  {
    type: "function",
    name: "burnStream",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "keeper",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "wrapper",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creatorCoin",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shareOFT",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "swapPathToShareOFT",
    inputs: [{ name: "tokenIn", type: "address" }],
    outputs: [{ type: "bytes" }],
    stateMutability: "view",
  },
] as const

export const CreatorOVaultWrapperABI = [
  {
    type: "function",
    name: "isWhitelisted",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const
