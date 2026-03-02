export const CHARM_ALPHA_VAULT_ABI = [
  {
    type: 'function',
    name: 'rebalance',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'swapAmount', type: 'int256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
      { name: 'baseLower', type: 'int24' },
      { name: 'baseUpper', type: 'int24' },
      { name: 'bidLower', type: 'int24' },
      { name: 'bidUpper', type: 'int24' },
      { name: 'askLower', type: 'int24' },
      { name: 'askUpper', type: 'int24' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'setStrategy', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const

