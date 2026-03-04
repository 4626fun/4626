export const CHARM_ALPHA_VAULT_ABI = [
  // Base Charm vaults use the no-arg rebalance() entrypoint.
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // Modern Charm auth model on Base.
  { type: 'function', name: 'setRebalanceDelegate', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setManager', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const

