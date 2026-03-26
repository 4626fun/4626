/**
 * CCA (Creator Coin Auction) Strategy & Auction ABI fragments.
 *
 * Extracted from cre/config.ts for use with viem's type-safe contract
 * interactions inside CRE SDK workflows.
 */

export const CCAStrategyABI = [
  // Read
  {
    type: "function",
    name: "currentAuction",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  // Write
  {
    type: "function",
    name: "getLifecycleStatus",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "phase", type: "uint8" },
          { name: "auction", type: "address" },
          { name: "isGraduated", type: "bool" },
          { name: "auctionWindowOpen", type: "bool" },
          { name: "claimOpen", type: "bool" },
          { name: "currencySwept", type: "bool" },
          { name: "unsoldSwept", type: "bool" },
          { name: "migrated", type: "bool" },
          { name: "failedFinalized", type: "bool" },
          { name: "startBlock", type: "uint64" },
          { name: "endBlock", type: "uint64" },
          { name: "claimBlock", type: "uint64" },
          { name: "migrationBlock", type: "uint64" },
          { name: "sweepBlock", type: "uint64" },
          { name: "lpReserveAmount", type: "uint256" },
          { name: "clearingPrice", type: "uint256" },
          { name: "currencyRaised", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sweepCurrency",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sweepUnsoldTokens",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalizeFailedAuction",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "migrate",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

export const CCAAuctionABI = [
  {
    type: "function",
    name: "isGraduated",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sweepCurrencyBlock",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endBlock",
    inputs: [],
    outputs: [{ type: "uint64" }],
    stateMutability: "view",
  },
] as const
