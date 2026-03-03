export const VaultStrategyViewABI = [
  {
    type: "function",
    name: "strategyList",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "strategyWeights",
    stateMutability: "view",
    inputs: [{ name: "strategy", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const

export const OracleStrategyViewABI = [
  {
    type: "function",
    name: "getV3TWAPTick",
    inputs: [{ name: "duration", type: "uint32" }],
    outputs: [{ type: "int24" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3CreatorToken",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3UsdToken",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3CreatorDecimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3UsdDecimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3PoolConfigured",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "v3Pool",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const

export const AjnaStrategyViewABI = [
  {
    type: "function",
    name: "ajnaPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "bucketIndex",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

export const AjnaPoolViewABI = [
  {
    type: "function",
    name: "lenderInfo",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }, { name: "lender", type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "bucketInfo",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "lpBalance", type: "uint256" },
      { name: "collateral", type: "uint256" },
      { name: "bankruptcyTime", type: "uint256" },
      { name: "deposit", type: "uint256" },
      { name: "scale", type: "uint256" },
    ],
  },
] as const

export const CharmStrategyViewABI = [
  {
    type: "function",
    name: "charmVault",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const

export const CharmVaultViewABI = [
  {
    type: "function",
    name: "baseLower",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "int24" }],
  },
  {
    type: "function",
    name: "baseUpper",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "int24" }],
  },
] as const
