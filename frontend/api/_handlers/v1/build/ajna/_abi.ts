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

export const CREATOR_AJNA_STRATEGY_OWNER_ABI = [
  { type: 'function', name: 'setBucketIndex', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'moveToBucket', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setIdleBufferBps', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

