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
] as const
