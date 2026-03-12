export const AJNA_ERC20_POOL_ABI = [
  // Borrow / repay (ERC20Pool)
  {
    type: 'function',
    name: 'drawDebt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrowerAddress', type: 'address' },
      { name: 'amountToBorrow', type: 'uint256' },
      { name: 'limitIndex', type: 'uint256' },
      { name: 'collateralToPledge', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repayDebt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrowerAddress', type: 'address' },
      { name: 'maxQuoteTokenAmountToRepay', type: 'uint256' },
      { name: 'collateralAmountToPull', type: 'uint256' },
      { name: 'collateralReceiver', type: 'address' },
      { name: 'limitIndex', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const ERC4626_STRATEGY_ADAPTER_OWNER_ABI = [
  { type: 'function', name: 'setIdleBufferBps', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

export const AJNA_VAULT_AUTH_ADMIN_ABI = [
  { type: 'function', name: 'setMinBucketIndex', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

