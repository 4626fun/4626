/**
 * Node-safe contract address config for Vercel serverless functions.
 *
 * IMPORTANT:
 * - Do NOT import from `frontend/src/config/contracts.ts` inside /api routes.
 *   That file references `import.meta.env` (Vite-only) and will crash Node functions.
 * - Keep defaults aligned with `frontend/src/config/contracts.ts`.
 */

declare const process: { env: Record<string, string | undefined> }

// NOTE: Vercel Node functions run as ESM; include `.js` extension for cross-folder imports.
import {
  BASE_DEFAULTS,
  normalizeDeploymentBatcherAddress,
  type ContractAddress,
} from '../../../src/config/contracts.defaults.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function isZeroAddress(value?: string): boolean {
  return (value ?? '').trim().toLowerCase() === ZERO_ADDRESS
}

export type ApiContracts = {
  registry: ContractAddress
  lotteryManager: ContractAddress
  payoutRouterFactory: ContractAddress
  create2Factory: ContractAddress
  create2Deployer: ContractAddress
  universalBytecodeStore?: ContractAddress
  universalCreate2DeployerFromStore?: ContractAddress
  vaultAuxiliaryDeployBatcher?: ContractAddress
  vaultActivationBatcher: ContractAddress
  deploymentBatcher?: ContractAddress
  protocolTreasury: ContractAddress
  protocolAutomation?: ContractAddress
  ve4626GaugeVoting?: ContractAddress
  ve4626VoterRewardsDistributor?: ContractAddress
  bribesFactory4626?: ContractAddress
  ve4626?: ContractAddress
  ve4626BoostManager?: ContractAddress
  poolManager: ContractAddress
  taxHook: ContractAddress
  positionManager?: ContractAddress
  swapRouter?: ContractAddress
  quoter?: ContractAddress
  chainlinkEthUsd: ContractAddress
  weth: ContractAddress
  ajnaErc20Factory: ContractAddress
  ajnaErc721Factory: ContractAddress
  ajnaPoolInfoUtils: ContractAddress
  ajnaPositionManager: ContractAddress
  charmAlphaVault?: ContractAddress
  uniswapV3Factory: ContractAddress
  zora: ContractAddress
  usdc: ContractAddress
  permit2: ContractAddress
  alfaClubUniversalRouter?: ContractAddress
  alfaClubSudoswapAdapter?: ContractAddress
  sudoswapPairFactory?: ContractAddress
  sudoswapXykCurve?: ContractAddress
  room1659SudoswapPair?: ContractAddress
  strategyDeploymentBatcher?: ContractAddress
  impairmentClaims?: ContractAddress
  impairmentRecoveryEscrow?: ContractAddress
  impairmentGuardian?: ContractAddress
}

function pickAddress(envKey: string, fallback?: string): ContractAddress | undefined {
  const raw = (process.env[envKey] ?? '').trim()
  const v = raw.length > 0 ? raw : (fallback ?? '').trim()
  if (!v) return undefined
  return v as ContractAddress
}

function pickAddressProdSafe(envKey: string, fallback?: string): ContractAddress | undefined {
  const isVercel = Boolean((process.env.VERCEL ?? '').trim())
  const allowOverrides = (process.env.ALLOW_API_CONTRACT_OVERRIDES ?? '').trim() === '1'
  // In production serverless, prefer repo defaults to avoid mismatched env overrides
  // between frontend + backend that can cause paymaster validation failures.
  // When no usable repo default exists (missing or explicitly zero for greenfield
  // infrastructure), allow env so post-deploy wiring can pin the live address
  // without ALLOW_API_CONTRACT_OVERRIDES.
  if (isVercel && !allowOverrides) {
    const fb = (fallback ?? '').trim()
    if (fb && !isZeroAddress(fb)) return fb as ContractAddress
    return pickAddress(envKey, fallback)
  }
  return pickAddress(envKey, fallback)
}

function resolveDeploymentBatcherAddress(): ContractAddress | undefined {
  const configured = pickAddressProdSafe(
    'DEPLOYMENT_BATCHER',
    pickAddressProdSafe('DEPLOYMENT_BATCHER_AUTO_HANDOFF') ?? BASE_DEFAULTS.deploymentBatcher,
  )
  const normalized = normalizeDeploymentBatcherAddress(configured)
  if (normalized) return normalized as ContractAddress
  // If env is present but deprecated/invalid, hard-failing to `undefined` breaks
  // server/runtime parity and paymaster validation. Fall back to canonical default.
  return normalizeDeploymentBatcherAddress(BASE_DEFAULTS.deploymentBatcher) as ContractAddress | undefined
}

/**
 * Contract addresses for Base mainnet.
 *
 * Env overrides are optional and are primarily useful for local testing.
 */
export function getApiContracts(): ApiContracts {
  return {
    registry: pickAddress('REGISTRY_4626', pickAddress('REGISTRY', BASE_DEFAULTS.registry)!)!,
    lotteryManager: pickAddress('LOTTERY_MANAGER', BASE_DEFAULTS.lotteryManager)!,
    payoutRouterFactory: pickAddress('PAYOUT_ROUTER_FACTORY', BASE_DEFAULTS.payoutRouterFactory)!,
    create2Factory: pickAddress('CREATE2_FACTORY', BASE_DEFAULTS.create2Factory)!,
    create2Deployer: pickAddress('CREATE2_DEPLOYER', BASE_DEFAULTS.create2Deployer)!,
    universalBytecodeStore: pickAddressProdSafe('UNIVERSAL_BYTECODE_STORE', BASE_DEFAULTS.universalBytecodeStore),
    universalCreate2DeployerFromStore: pickAddressProdSafe(
      'UNIVERSAL_CREATE2_FROM_STORE',
      BASE_DEFAULTS.universalCreate2DeployerFromStore,
    ),
    vaultAuxiliaryDeployBatcher: pickAddressProdSafe(
      'VAULT_AUXILIARY_DEPLOY_BATCHER',
      BASE_DEFAULTS.vaultAuxiliaryDeployBatcher,
    ),
    vaultActivationBatcher: pickAddressProdSafe('VAULT_ACTIVATION_BATCHER', BASE_DEFAULTS.vaultActivationBatcher)!,
    deploymentBatcher: resolveDeploymentBatcherAddress(),
    protocolTreasury: pickAddress('PROTOCOL_TREASURY', BASE_DEFAULTS.protocolTreasury)!,
    protocolAutomation: pickAddressProdSafe('PROTOCOL_AUTOMATION_SAFE', BASE_DEFAULTS.protocolAutomation),
    // V1 greenfield env names only (no legacy VAULT_GAUGE_* / VOTER_REWARDS_* fallbacks)
    ve4626GaugeVoting: pickAddressProdSafe('VE4626_GAUGE_VOTING'),
    ve4626VoterRewardsDistributor: pickAddressProdSafe('VE4626_VOTER_REWARDS_DISTRIBUTOR'),
    bribesFactory4626: pickAddressProdSafe('BRIBES_FACTORY_4626'),
    ve4626: pickAddressProdSafe('VE4626'),
    ve4626BoostManager: pickAddressProdSafe('VE4626_BOOST_MANAGER'),
    poolManager: pickAddress('POOL_MANAGER', BASE_DEFAULTS.poolManager)!,
    taxHook: pickAddress('TAX_HOOK', BASE_DEFAULTS.taxHook)!,
    positionManager: pickAddress('POSITION_MANAGER'),
    swapRouter: pickAddress('SWAP_ROUTER'),
    quoter: pickAddress('QUOTER'),
    chainlinkEthUsd: pickAddress('CHAINLINK_ETH_USD', BASE_DEFAULTS.chainlinkEthUsd)!,
    weth: pickAddress('WETH', BASE_DEFAULTS.weth)!,
    ajnaErc20Factory: pickAddress('AJNA_ERC20_FACTORY', BASE_DEFAULTS.ajnaErc20Factory)!,
    ajnaErc721Factory: pickAddress('AJNA_ERC721_FACTORY', BASE_DEFAULTS.ajnaErc721Factory)!,
    ajnaPoolInfoUtils: pickAddress('AJNA_POOL_INFO_UTILS', BASE_DEFAULTS.ajnaPoolInfoUtils)!,
    ajnaPositionManager: pickAddress('AJNA_POSITION_MANAGER', BASE_DEFAULTS.ajnaPositionManager)!,
    charmAlphaVault: pickAddress('CHARM_ALPHA_VAULT'),
    uniswapV3Factory: pickAddress('UNISWAP_V3_FACTORY', BASE_DEFAULTS.uniswapV3Factory)!,
    zora: pickAddress('ZORA_TOKEN', BASE_DEFAULTS.zora)!,
    usdc: pickAddress('USDC_TOKEN', BASE_DEFAULTS.usdc)!,
    permit2: pickAddress('PERMIT2', BASE_DEFAULTS.permit2)!,
    alfaClubUniversalRouter: pickAddressProdSafe(
      'ALFACLUB_UNIVERSAL_ROUTER',
      BASE_DEFAULTS.alfaClubUniversalRouter,
    ),
    alfaClubSudoswapAdapter: pickAddressProdSafe(
      'ALFACLUB_SUDOSWAP_ADAPTER',
      BASE_DEFAULTS.alfaClubSudoswapAdapter,
    ),
    sudoswapPairFactory: pickAddressProdSafe(
      'SUDOSWAP_PAIR_FACTORY',
      BASE_DEFAULTS.sudoswapPairFactory,
    ),
    sudoswapXykCurve: pickAddressProdSafe(
      'SUDOSWAP_XYK_CURVE',
      BASE_DEFAULTS.sudoswapXykCurve,
    ),
    room1659SudoswapPair: pickAddressProdSafe(
      'ALFACLUB_ROOM_1659_SUDOSWAP_PAIR',
      BASE_DEFAULTS.room1659SudoswapPair,
    ),
    strategyDeploymentBatcher: pickAddress('STRATEGY_DEPLOYMENT_BATCHER'),
    impairmentClaims: pickAddressProdSafe('IMPAIRMENT_CLAIMS', BASE_DEFAULTS.impairmentClaims),
    impairmentRecoveryEscrow: pickAddressProdSafe(
      'IMPAIRMENT_RECOVERY_ESCROW',
      BASE_DEFAULTS.impairmentRecoveryEscrow,
    ),
    impairmentGuardian: pickAddressProdSafe('IMPAIRMENT_GUARDIAN', BASE_DEFAULTS.impairmentGuardian),
  }
}
