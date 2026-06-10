/** Relay Protocol native depository on Base mainnet. */
export const RELAY_DEPOSITORY_BASE = '0x4cd00e387622c35bddb9b4c962c136462338bc31' as const
export const RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR = '0x49290c1c' as const

/** May 5 golden Part 1 deposit — regression fixture only (tx 0xa6b54357…, block 45600637). */
export const GOLDEN_RELAY_PART1_DEPOSIT_WEI = 18_871_666_861_048n

/** Broken Part 1 (~2.88e12 wei, tx 0xdfec2946…) never triggered Part 2 solver fill. */
export const MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI = 8_000_000_000_000n

/** Cap on Relay re-quote seed wei — golden Part 1 ≈19e12; blocks runaway deposit seeds. */
export const MAX_OWNER_MUTATION_RELAY_DEPOSIT_SEED_WEI = 100_000_000_000_000n

/** May 5 2026 golden Part 1 order id (probe CSW 0x4bea…). */
export const GOLDEN_RELAY_PART1_ORDER_ID =
  '0x8cc58ae3d8f127fbe4c8327958cf9c638f4d3b25547ddcbb190c8ce8e853797a' as const

/** Pre-migration probe CSW from the May 5 2026 golden add-owner trace (not current canonical). */
export const GOLDEN_RELAY_PART1_PROBE_CSW =
  '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const

/**
 * Coinbase Smart Wallet `executeBatch` selector — Base App wraps Part 1
 * `wallet_sendCalls` into EntryPoint → CSW.executeBatch([Depository deposit]).
 */
export const CSW_EXECUTE_BATCH_SELECTOR = '0x34fcd5be' as const

/** May 5 golden Part 1 EntryPoint prefund — RPC-failure fallback only; live paths use `relayPart1GasReserve`. */
export const GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI = 85_989_948_096n

/** EntryPoint v0.6 — deterministic on Base and all EVM chains. */
export const ENTRY_POINT_V06_BASE = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const

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
