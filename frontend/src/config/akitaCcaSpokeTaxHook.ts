/**
 * Optional spoke SimpleSellTaxHook CREATE2 pins (sell-tax plane).
 *
 * Source: Sourcify exact_match of Base `0xca975B9dAF772C71161f3648437c3616E5Be0088`
 * (`contracts/shared/shareoft-mesh/univ4/SimpleSellTaxHook.sol`).
 *
 * Deployer: HookMiner CREATE2 proxy `0x4e59b44847b379578588920cA78FbF26c0B4956C`.
 * Flags: BEFORE_SWAP | BEFORE_SWAP_RETURNS_DELTA (address & 0x3fff == 0x88).
 *
 * Live CREATE2 deploys (2026-07-30) on Ethereum / Arbitrum / Unichain.
 * Robinhood predicted only until gas is funded (Across fill may lag).
 *
 * Salts mined: `forge test --match-contract MineSpokeSellTaxHookSalts -vv`
 */
export const SELL_TAX_HOOK_CREATE2_DEPLOYER =
  '0x4e59b44847b379578588920cA78FbF26c0B4956C' as const

export const BASE_SELL_TAX_HOOK = '0xca975B9dAF772C71161f3648437c3616E5Be0088' as const

export type SpokeTaxHookPin = {
  chainId: number
  poolManager: `0x${string}`
  wrappedNative: `0x${string}`
  /** uint256 salt as 0x-prefixed 32-byte hex */
  salt: `0x${string}`
  /** CREATE2 address (live once `DeploySpokeSellTaxHook` broadcasts). */
  predicted: `0x${string}`
  /** On-chain codesize>0 after broadcast. */
  live: boolean
}

function saltHex(n: number): `0x${string}` {
  return `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`
}

export const AKITA_CCA_SPOKE_TAX_HOOKS = {
  ethereum: {
    chainId: 1,
    poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
    wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    salt: saltHex(523),
    predicted: '0x58247bf5ff3cb780258e4C13A0d6768c7fff8088',
    live: true,
  },
  arbitrum: {
    chainId: 42_161,
    poolManager: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    salt: saltHex(21_319),
    predicted: '0xb7971A3038CA0508D086C7e1917544EDf1Ee4088',
    live: true,
  },
  unichain: {
    chainId: 130,
    poolManager: '0x1F98400000000000000000000000000000000004',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    salt: saltHex(23_236),
    predicted: '0xd00b3DC54e7144ec10522334F351D818D572c088',
    live: true,
  },
  robinhood: {
    chainId: 4_663,
    poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    salt: saltHex(482),
    predicted: '0xBfeaB2b1E53d626b9faD4057AC42b74706204088',
    live: false,
  },
} as const satisfies Record<string, SpokeTaxHookPin>

export type AkitaCcaSpokeTaxHookKey = keyof typeof AKITA_CCA_SPOKE_TAX_HOOKS
