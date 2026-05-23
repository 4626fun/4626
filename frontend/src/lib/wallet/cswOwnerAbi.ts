/** Relay Protocol native depository on Base mainnet. */
export const RELAY_DEPOSITORY_BASE = '0x4cd00e387622c35bddb9b4c962c136462338bc31' as const
export const RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR = '0x49290c1c' as const

export const CSW_OWNER_READ_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

export const CSW_OWNER_MUTATION_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwnerAtIndex',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeLastOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

/** addOwnerAddress + isOwnerAddress — admin install / ownership checks. */
export const CSW_OWNER_INSTALL_ABI = [
  CSW_OWNER_MUTATION_ABI[0],
  CSW_OWNER_READ_ABI[3]!,
] as const

/** Full Coinbase Smart Wallet owner surface used by add/remove-owner flows. */
export const CSW_OWNER_ABI = [...CSW_OWNER_READ_ABI, ...CSW_OWNER_MUTATION_ABI] as const

export const RELAY_DEPOSITORY_ABI = [
  {
    type: 'function',
    name: 'depositNative',
    stateMutability: 'payable',
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'id', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

export const REMOVE_OWNER_AT_INDEX_SELECTOR = '0x89625b57' as const
export const ADD_OWNER_ADDRESS_SELECTOR = '0x0f0f3f24' as const
export const RELAY_MULTICALL_SELECTOR = '0xcd6e13f7' as const
export const EXECUTE_WITHOUT_CHAIN_ID_SELECTOR = '0x2c2abd1e' as const
export const NATIVE_CURRENCY_ADDRESS = '0x0000000000000000000000000000000000000000' as const
