export const CREATOR_CHARM_STRATEGY_ABI = [
  { type: 'function', name: 'setCharmVault', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setSwapPool', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setUniFactory', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setAutoFeeTier', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  {
    type: 'function',
    name: 'setParameters',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint24' }],
    outputs: [],
  },
  { type: 'function', name: 'setActive', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  { type: 'function', name: 'initializeApprovals', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'ownerEmergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'ownerEmergencyWithdrawFromCharm', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const

