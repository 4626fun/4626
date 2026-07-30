/**
 * Canonical per-chain parameters for the AKITA CCA launch arms (ShareOFT mesh: CCA arm).
 *
 * Source of truth for the Base → Ethereum / Arbitrum / Unichain / Robinhood extension.
 * Durations/delays are expressed in blocks; fast chains (blocks-per-second scheduling)
 * set `launchBlocksPerSecond` and leave `launchBlockTimeSeconds` at 0 (unused).
 *
 * Factory policy:
 * - `targetCcaFactoryVersion` is the factory a *new* arm on that chain should use.
 * - Live Base AKITA arm remains on v1.1.0 historically; new Base arms (and every
 *   expansion chain) target v2.1.0.
 * - v2.1.0 auctions subtract a protocol fee at sweep via the factory-bound
 *   protocolFeeController. CCALaunchArm.migrate() requires swept == currencyRaised,
 *   so `requireZeroCcaProtocolFee` must hold (gate: `pnpm -C frontend ops:verify-cca-multichain`).
 */

export const CCA_FACTORY_V110 = '0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5' as const
export const CCA_FACTORY_V210 = '0x000000001F26a0044BaA66024e7b6599c61963F8' as const

/** Canonical LayerZero EndpointV2 (Ethereum / Base / Arbitrum, etc.). */
export const LZ_ENDPOINT_V2_CANONICAL = '0x1a44076050125825900e736c501f859c50fE728c' as const
/**
 * Non-canonical EndpointV2 CREATE2 (Unichain + Robinhood share this address;
 * different EIDs - Unichain 30320, Robinhood 30416).
 */
export const LZ_ENDPOINT_V2_NONCANONICAL = '0x6F475642a6e85809B1c36Fa62763669b1b48DD5B' as const
/** @deprecated Prefer LZ_ENDPOINT_V2_NONCANONICAL - same address. */
export const LZ_ENDPOINT_V2_ROBINHOOD = LZ_ENDPOINT_V2_NONCANONICAL

export const SEVEN_DAYS_SECONDS = 604_800

export type CcaFactoryVersion = 'v1.1.0' | 'v2.1.0'

export type CcaLaunchChain = {
  label: string
  chainId: number
  /** LayerZero endpoint id. */
  eid: number
  lzEndpointV2: `0x${string}`
  /** Nominal block time in seconds (display/derivation only). */
  blockTimeSeconds: number
  /** ~7-day default auction duration in blocks (CCALaunchArm defaultDuration). */
  defaultDurationBlocks: number
  /** Blocks-per-second auction scheduling; 0 = seconds-based scheduling. */
  launchBlocksPerSecond: number
  /** Seconds-based auction block time; unused when launchBlocksPerSecond > 0. */
  launchBlockTimeSeconds: number
  /** ~2h claim delay in blocks. */
  defaultClaimDelayBlocks: number
  /** ~8h sweep delay in blocks. */
  defaultSweepDelayBlocks: number
  migrationDelayBlocks: number
  ccaFactoryV110: typeof CCA_FACTORY_V110
  ccaFactoryV210: typeof CCA_FACTORY_V210
  /** Factory the arm targets: v2.1.0 everywhere new; v1.1.0 recorded for legacy Base. */
  targetCcaFactoryVersion: CcaFactoryVersion
  /** Gate: factory protocolFeeController must yield zero fee (migrate requires swept == currencyRaised). */
  requireZeroCcaProtocolFee: true
  /** Uniswap v4 PoolManager on this chain. */
  poolManagerV4: `0x${string}`
  /** Uniswap v4 PositionManager for `setMigrationConfig` / post-auction LP mint. */
  positionManagerV4: `0x${string}`
  /** Canonical wrapped native (WETH) for SimpleSellTaxHook ctor. */
  wrappedNative: `0x${string}`
  /**
   * Local Chainlink ETH/USD aggregator (post-deploy `setChainlinkFeed`).
   * Zero address = unknown / unset - operator must pin before launch pricing.
   * For CREATE2 oracle address parity with Base, ctor may use the Base feed
   * (or address(0)) then call `setChainlinkFeed` to this local feed.
   */
  chainlinkEthUsd: `0x${string}`
  /**
   * Optional Chainlink L2 sequencer uptime feed (`setSequencerUptimeFeed`).
   * Zero on L1 / chains without a published feed.
   */
  sequencerUptimeFeed: `0x${string}`
  /**
   * Uniswap v4 tax / Zora hook for CCA migrate+grad.
   * Base + all CCA spokes: live SimpleSellTaxHook.
   * Deploy: `script/DeploySpokeSellTaxHook.s.sol` (pins in akitaCcaSpokeTaxHook.ts).
   */
  taxHook: `0x${string}`
  /** v2.1.0 factory is not deployed by Uniswap here yet - empty code is expected pre-bootstrap. */
  ccaFactoryV210ExpectedEmptyPreBootstrap: boolean
  rpcEnvKey: string
  defaultRpcUrl: string
}

/** Zero address sentinel for unset feeds. */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const CCA_LAUNCH_CHAINS = {
  ethereum: {
    label: 'Ethereum',
    chainId: 1,
    eid: 30_101,
    lzEndpointV2: LZ_ENDPOINT_V2_CANONICAL,
    blockTimeSeconds: 12,
    defaultDurationBlocks: 50_400,
    launchBlocksPerSecond: 0,
    launchBlockTimeSeconds: 12,
    defaultClaimDelayBlocks: 600,
    defaultSweepDelayBlocks: 2_400,
    migrationDelayBlocks: 1,
    ccaFactoryV110: CCA_FACTORY_V110,
    ccaFactoryV210: CCA_FACTORY_V210,
    targetCcaFactoryVersion: 'v2.1.0',
    requireZeroCcaProtocolFee: true,
    poolManagerV4: '0x000000000004444c5dc75cB358380D2e3dE08A90',
    positionManagerV4: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',
    wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // https://data.chain.link/feeds/ethereum/mainnet/eth-usd
    chainlinkEthUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    sequencerUptimeFeed: ZERO_ADDRESS,
    // Live SimpleSellTaxHook (CREATE2; see akitaCcaSpokeTaxHook.ts).
    taxHook: '0x58247bf5ff3cb780258e4C13A0d6768c7fff8088',
    ccaFactoryV210ExpectedEmptyPreBootstrap: false,
    rpcEnvKey: 'ETHEREUM_RPC_URL',
    defaultRpcUrl: 'https://ethereum-rpc.publicnode.com',
  },
  base: {
    label: 'Base',
    chainId: 8453,
    eid: 30_184,
    lzEndpointV2: LZ_ENDPOINT_V2_CANONICAL,
    blockTimeSeconds: 2,
    defaultDurationBlocks: 302_400,
    launchBlocksPerSecond: 0,
    launchBlockTimeSeconds: 2,
    defaultClaimDelayBlocks: 3_600,
    defaultSweepDelayBlocks: 14_400,
    migrationDelayBlocks: 1,
    ccaFactoryV110: CCA_FACTORY_V110,
    ccaFactoryV210: CCA_FACTORY_V210,
    // Live Base AKITA arm is on v1.1.0. New Base arms should call setCcaFactoryV2(v2.1.0).
    targetCcaFactoryVersion: 'v1.1.0',
    requireZeroCcaProtocolFee: true,
    poolManagerV4: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    positionManagerV4: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    chainlinkEthUsd: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    // https://docs.chain.link/data-feeds/l2-sequencer-feeds
    sequencerUptimeFeed: '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433',
    // Live Base Zora/tax hook (CONTRACTS.taxHook).
    taxHook: '0xca975B9dAF772C71161f3648437c3616E5Be0088',
    ccaFactoryV210ExpectedEmptyPreBootstrap: false,
    rpcEnvKey: 'BASE_RPC_URL',
    defaultRpcUrl: 'https://mainnet.base.org',
  },
  unichain: {
    label: 'Unichain',
    chainId: 130,
    eid: 30_320,
    // LayerZero metadata: unichain-mainnet EndpointV2 (not the canonical 0x1a44… address).
    lzEndpointV2: LZ_ENDPOINT_V2_NONCANONICAL,
    blockTimeSeconds: 1,
    defaultDurationBlocks: 604_800,
    launchBlocksPerSecond: 0,
    launchBlockTimeSeconds: 1,
    defaultClaimDelayBlocks: 7_200,
    defaultSweepDelayBlocks: 28_800,
    migrationDelayBlocks: 1,
    ccaFactoryV110: CCA_FACTORY_V110,
    ccaFactoryV210: CCA_FACTORY_V210,
    targetCcaFactoryVersion: 'v2.1.0',
    requireZeroCcaProtocolFee: true,
    poolManagerV4: '0x1F98400000000000000000000000000000000004',
    positionManagerV4: '0x4529A01c7A0410167c5740C487a8de60232617bf',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    // Chainlink directory ETH/USD (verified codesize>0; feed decimals=18).
    chainlinkEthUsd: '0xBcE70e194940a157f3A80566505a7E96f5238CCa',
    sequencerUptimeFeed: ZERO_ADDRESS,
    // Live SimpleSellTaxHook (CREATE2; see akitaCcaSpokeTaxHook.ts).
    taxHook: '0xd00b3DC54e7144ec10522334F351D818D572c088',
    ccaFactoryV210ExpectedEmptyPreBootstrap: false,
    rpcEnvKey: 'UNICHAIN_RPC_URL',
    defaultRpcUrl: 'https://mainnet.unichain.org',
  },
  arbitrum: {
    label: 'Arbitrum',
    chainId: 42_161,
    eid: 30_110,
    lzEndpointV2: LZ_ENDPOINT_V2_CANONICAL,
    blockTimeSeconds: 0.25,
    defaultDurationBlocks: 2_419_200,
    launchBlocksPerSecond: 4,
    launchBlockTimeSeconds: 0,
    defaultClaimDelayBlocks: 28_800,
    defaultSweepDelayBlocks: 115_200,
    migrationDelayBlocks: 1,
    ccaFactoryV110: CCA_FACTORY_V110,
    ccaFactoryV210: CCA_FACTORY_V210,
    targetCcaFactoryVersion: 'v2.1.0',
    requireZeroCcaProtocolFee: true,
    poolManagerV4: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
    positionManagerV4: '0xd88F38F930b7952f2Db2432Cb002E7abbf3DD869',
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    // Chainlink directory ETH/USD (verified codesize>0 on Arb One).
    chainlinkEthUsd: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    // https://docs.chain.link/data-feeds/l2-sequencer-feeds
    sequencerUptimeFeed: '0xFdB631F5EE196F0ed6FAa767959853A9F217697D',
    // Live SimpleSellTaxHook (CREATE2; see akitaCcaSpokeTaxHook.ts).
    taxHook: '0xb7971A3038CA0508D086C7e1917544EDf1Ee4088',
    ccaFactoryV210ExpectedEmptyPreBootstrap: false,
    rpcEnvKey: 'ARBITRUM_RPC_URL',
    defaultRpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  robinhood: {
    label: 'Robinhood',
    chainId: 4_663,
    eid: 30_416,
    lzEndpointV2: LZ_ENDPOINT_V2_NONCANONICAL,
    blockTimeSeconds: 0.1,
    defaultDurationBlocks: 6_048_000,
    launchBlocksPerSecond: 10,
    launchBlockTimeSeconds: 0,
    defaultClaimDelayBlocks: 72_000,
    defaultSweepDelayBlocks: 288_000,
    migrationDelayBlocks: 1,
    ccaFactoryV110: CCA_FACTORY_V110,
    ccaFactoryV210: CCA_FACTORY_V210,
    targetCcaFactoryVersion: 'v2.1.0',
    requireZeroCcaProtocolFee: true,
    poolManagerV4: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    positionManagerV4: '0x58Daec3116AAe6d93017bAaEA7749052e8A04Fa7',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    // Chainlink directory ETH/USD on Robinhood mainnet (verified codesize>0).
    chainlinkEthUsd: '0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9',
    sequencerUptimeFeed: ZERO_ADDRESS,
    // Live SimpleSellTaxHook (CREATE2; see akitaCcaSpokeTaxHook.ts).
    taxHook: '0xBfeaB2b1E53d626b9faD4057AC42b74706204088',
    // Factory v2.1.0 already live with protocolFeeController=0 (2026-07-29 probe).
    // Keep false; preflight WARN only if code disappears.
    ccaFactoryV210ExpectedEmptyPreBootstrap: false,
    rpcEnvKey: 'ROBINHOOD_RPC_URL',
    defaultRpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  },
} as const satisfies Record<string, CcaLaunchChain>

export type CcaLaunchChainKey = keyof typeof CCA_LAUNCH_CHAINS

export const CCA_LAUNCH_CHAIN_KEYS = Object.keys(CCA_LAUNCH_CHAINS) as CcaLaunchChainKey[]

export function getCcaLaunchChain(key: CcaLaunchChainKey) {
  return CCA_LAUNCH_CHAINS[key]
}

/** Lookup by numeric chainId (API / wagmi). */
export function getCcaLaunchChainByChainId(chainId: number): CcaLaunchChain | undefined {
  for (const key of CCA_LAUNCH_CHAIN_KEYS) {
    const chain = CCA_LAUNCH_CHAINS[key]
    if (chain.chainId === chainId) return chain
  }
  return undefined
}

/** Effective block time used for block-domain scheduling math. */
export function effectiveLaunchBlockTimeSeconds(chain: CcaLaunchChain): number {
  return chain.launchBlocksPerSecond > 0
    ? 1 / chain.launchBlocksPerSecond
    : chain.launchBlockTimeSeconds
}
