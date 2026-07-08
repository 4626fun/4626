import { base } from 'viem/chains'
import { type Abi, type PublicClient, type WalletClient, zeroAddress } from 'viem'

const CCA_LP_MANAGER_ABI = [
  {
    type: 'function',
    name: 'lpManager',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'seedLpManager',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPoolKey',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

const VAULT_OWNER_ABI = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const DEPLOYMENT_BATCHER_ABI = [
  {
    type: 'function',
    name: 'deployShareMeshLpManager',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'ccaLaunchArm', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'positionManager', type: 'address' },
          { name: 'poolHook', type: 'address' },
          { name: 'registryOwner', type: 'address' },
          { name: 'keeperManager', type: 'address' },
          { name: 'hooksToApprove', type: 'address[]' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'approvedV4HooksRegistry', type: 'bytes32' },
          { name: 'lpManager', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'hookRegistry', type: 'address' },
          { name: 'lpManager', type: 'address' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const

const LP_MANAGER_ABI = [
  {
    type: 'function',
    name: 'seedRebalance',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'twapOracle',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolId',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fullRangePosition',
    inputs: [],
    outputs: [
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'tokenId', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

const ORACLE_V4_ABI = [
  {
    type: 'function',
    name: 'v4PoolConfigured',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export type ShareMeshCompletionConfig = {
  enabled: boolean
  deploymentBatcher: `0x${string}` | null
  hookRegistryCodeId: `0x${string}` | null
  lpManagerCodeId: `0x${string}` | null
  positionManager: `0x${string}` | null
  poolHook: `0x${string}` | null
  registryOwner: `0x${string}` | null
  deployVersion: string
}

export type ShareMeshCompletionInput = {
  ccaLaunchArmAddress: `0x${string}`
  creatorCoinAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  vaultAddress: `0x${string}` | null
  oracleAddress: `0x${string}` | null
  vaultOwnerAddress: `0x${string}` | null
}

export type ShareMeshCompletionResult = {
  deployStatus: 'skipped' | 'already_done' | 'success' | 'awaiting_vault_owner' | 'missing_config' | 'failed'
  seedLpManagerStatus: 'skipped' | 'success' | 'failed'
  seedRebalanceStatus: 'skipped' | 'success' | 'already_seeded' | 'failed'
  deployTxHash: `0x${string}` | null
  seedLpManagerTxHash: `0x${string}` | null
  seedRebalanceTxHash: `0x${string}` | null
  lpManagerAddress: `0x${string}` | null
  deployError: string | null
}

function normalizeBytes32(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

export function resolveShareMeshCompletionConfig(): ShareMeshCompletionConfig {
  const enabled = process.env.KEEPER_SHARE_MESH_ENABLED !== 'false'
  return {
    enabled,
    deploymentBatcher: normalizeAddress(process.env.DEPLOYMENT_BATCHER ?? process.env.DEPLOYMENT_BATCHER),
    hookRegistryCodeId: normalizeBytes32(process.env.KEEPER_SHARE_MESH_HOOK_REGISTRY_CODE_ID),
    lpManagerCodeId: normalizeBytes32(process.env.KEEPER_SHARE_MESH_LP_MANAGER_CODE_ID),
    positionManager: normalizeAddress(process.env.V4_POSITION_MANAGER ?? process.env.KEEPER_V4_POSITION_MANAGER),
    poolHook: normalizeAddress(process.env.V4_TAX_HOOK ?? process.env.KEEPER_V4_TAX_HOOK),
    registryOwner: normalizeAddress(process.env.PROTOCOL_TREASURY ?? process.env.KEEPER_SHARE_MESH_REGISTRY_OWNER),
    deployVersion: String(process.env.KEEPER_SHARE_MESH_DEPLOY_VERSION ?? 'production').trim() || 'production',
  }
}

async function readLpManager(
  publicClient: PublicClient,
  ccaLaunchArmAddress: `0x${string}`,
): Promise<`0x${string}` | null> {
  const lpManager = (await publicClient.readContract({
    address: ccaLaunchArmAddress,
    abi: CCA_LP_MANAGER_ABI as unknown as Abi,
    functionName: 'lpManager',
  })) as `0x${string}`
  if (!lpManager || lpManager.toLowerCase() === zeroAddress) return null
  return lpManager.toLowerCase() as `0x${string}`
}

async function readVaultOwner(
  publicClient: PublicClient,
  vaultAddress: `0x${string}`,
): Promise<`0x${string}` | null> {
  const owner = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_OWNER_ABI as unknown as Abi,
    functionName: 'owner',
  })) as `0x${string}`
  return normalizeAddress(owner)
}

export async function runShareMeshCompletion(params: {
  publicClient: PublicClient
  walletClient: WalletClient
  keeperAddress: `0x${string}`
  input: ShareMeshCompletionInput
  config: ShareMeshCompletionConfig
}): Promise<ShareMeshCompletionResult> {
  const result: ShareMeshCompletionResult = {
    deployStatus: 'skipped',
    seedLpManagerStatus: 'skipped',
    seedRebalanceStatus: 'skipped',
    deployTxHash: null,
    seedLpManagerTxHash: null,
    seedRebalanceTxHash: null,
    lpManagerAddress: null,
    deployError: null,
  }

  if (!params.config.enabled) return result

  let lpManager = await readLpManager(params.publicClient, params.input.ccaLaunchArmAddress)
  result.lpManagerAddress = lpManager

  if (!lpManager) {
    const missingConfig =
      !params.config.deploymentBatcher
      || !params.config.hookRegistryCodeId
      || !params.config.lpManagerCodeId
      || !params.config.positionManager
      || !params.config.poolHook
      || !params.config.registryOwner
      || !params.input.creatorCoinAddress
      || !params.input.shareTokenAddress
      || !params.input.vaultAddress
      || !params.input.oracleAddress

    if (missingConfig) {
      result.deployStatus = 'missing_config'
      return result
    }

    const vaultAddress = params.input.vaultAddress
    if (!vaultAddress) {
      result.deployStatus = 'missing_config'
      return result
    }

    const vaultOwner =
      params.input.vaultOwnerAddress
      ?? (await readVaultOwner(params.publicClient, vaultAddress))

    if (!vaultOwner || vaultOwner !== params.keeperAddress.toLowerCase()) {
      result.deployStatus = 'awaiting_vault_owner'
      return result
    }

    try {
      const deployTxHash = await params.walletClient.writeContract({
        address: params.config.deploymentBatcher!,
        abi: DEPLOYMENT_BATCHER_ABI as unknown as Abi,
        functionName: 'deployShareMeshLpManager',
        args: [
          {
            creatorToken: params.input.creatorCoinAddress,
            shareOFT: params.input.shareTokenAddress,
            vault: params.input.vaultAddress,
            ccaLaunchArm: params.input.ccaLaunchArmAddress,
            oracle: params.input.oracleAddress,
            owner: vaultOwner,
            version: params.config.deployVersion,
            positionManager: params.config.positionManager!,
            poolHook: params.config.poolHook!,
            registryOwner: params.config.registryOwner!,
            keeperManager: params.keeperAddress,
            hooksToApprove: [],
          },
          {
            approvedV4HooksRegistry: params.config.hookRegistryCodeId!,
            lpManager: params.config.lpManagerCodeId!,
          },
        ],
        account: params.keeperAddress,
        chain: base,
      })
      result.deployTxHash = deployTxHash
      const receipt = await params.publicClient.waitForTransactionReceipt({ hash: deployTxHash, timeout: 180_000 })
      if (receipt.status !== 'success') {
        result.deployStatus = 'failed'
        result.deployError = 'deployShareMeshLpManager_reverted'
        return result
      }
      result.deployStatus = 'success'
      lpManager = await readLpManager(params.publicClient, params.input.ccaLaunchArmAddress)
      result.lpManagerAddress = lpManager
    } catch (error) {
      result.deployStatus = 'failed'
      result.deployError = error instanceof Error ? error.message : 'deployShareMeshLpManager_failed'
      return result
    }
  } else {
    result.deployStatus = 'already_done'
  }

  if (!lpManager) return result

  try {
    const seedTxHash = await params.walletClient.writeContract({
      address: params.input.ccaLaunchArmAddress,
      abi: CCA_LP_MANAGER_ABI as unknown as Abi,
      functionName: 'seedLpManager',
      account: params.keeperAddress,
      chain: base,
    })
    result.seedLpManagerTxHash = seedTxHash
    const seedReceipt = await params.publicClient.waitForTransactionReceipt({ hash: seedTxHash, timeout: 180_000 })
    result.seedLpManagerStatus = seedReceipt.status === 'success' ? 'success' : 'failed'
  } catch (error) {
    result.seedLpManagerStatus = 'failed'
    result.deployError = error instanceof Error ? error.message : 'seedLpManager_failed'
  }

  try {
    const fullRange = (await params.publicClient.readContract({
      address: lpManager,
      abi: LP_MANAGER_ABI as unknown as Abi,
      functionName: 'fullRangePosition',
    })) as readonly [number, number, bigint, bigint]
    const liquidity = BigInt(fullRange[2] ?? 0)
    if (liquidity > 0n) {
      result.seedRebalanceStatus = 'already_seeded'
      return result
    }

    const rebalanceTxHash = await params.walletClient.writeContract({
      address: lpManager,
      abi: LP_MANAGER_ABI as unknown as Abi,
      functionName: 'seedRebalance',
      account: params.keeperAddress,
      chain: base,
    })
    result.seedRebalanceTxHash = rebalanceTxHash
    const rebalanceReceipt = await params.publicClient.waitForTransactionReceipt({
      hash: rebalanceTxHash,
      timeout: 180_000,
    })
    result.seedRebalanceStatus = rebalanceReceipt.status === 'success' ? 'success' : 'failed'
  } catch (error) {
    result.seedRebalanceStatus = 'failed'
    result.deployError = error instanceof Error ? error.message : 'seedRebalance_failed'
  }

  return result
}

export type ShareMeshInvariantInput = {
  ccaLaunchArmAddress: `0x${string}`
  shareTokenAddress: `0x${string}` | null
  oracleAddress: `0x${string}` | null
}

export async function evaluateShareMeshInvariants(params: {
  publicClient: PublicClient
  input: ShareMeshInvariantInput
  recordViolation: (code: string, message: string, expected?: string | null, actual?: string | null) => void
}): Promise<number> {
  let checksRun = 0

  if (!params.input.oracleAddress) {
    params.recordViolation('missing_expected_oracle', 'Missing expected oracleAddress for share-mesh completion invariants')
    return checksRun
  }

  const v4PoolConfigured = (await params.publicClient.readContract({
    address: params.input.oracleAddress,
    abi: ORACLE_V4_ABI as unknown as Abi,
    functionName: 'v4PoolConfigured',
  })) as boolean
  checksRun++
  if (!v4PoolConfigured) {
    params.recordViolation(
      'oracle_v4_pool_not_configured',
      'Oracle v4PoolConfigured is false after migrate()',
      'true',
      String(v4PoolConfigured),
    )
  }

  const lpManager = await readLpManager(params.publicClient, params.input.ccaLaunchArmAddress)
  checksRun++
  if (!lpManager) {
    params.recordViolation(
      'share_mesh_lp_manager_missing',
      'CCA lpManager is unset after post-graduation share-mesh completion',
    )
    return checksRun
  }

  const configuredOracle = (await params.publicClient.readContract({
    address: lpManager,
    abi: LP_MANAGER_ABI as unknown as Abi,
    functionName: 'twapOracle',
  })) as `0x${string}`
  checksRun++
  if (configuredOracle.toLowerCase() !== params.input.oracleAddress.toLowerCase()) {
    params.recordViolation(
      'share_mesh_oracle_mismatch',
      'LP manager twapOracle does not match expected Phase 2 oracle',
      params.input.oracleAddress,
      configuredOracle,
    )
  }

  const poolId = (await params.publicClient.readContract({
    address: lpManager,
    abi: LP_MANAGER_ABI as unknown as Abi,
    functionName: 'poolId',
  })) as `0x${string}`
  checksRun++
  if (poolId === `0x${'0'.repeat(64)}`) {
    params.recordViolation('share_mesh_pool_not_configured', 'LP manager poolId is unset')
  }

  if (params.input.shareTokenAddress) {
    const poolKey = (await params.publicClient.readContract({
      address: params.input.ccaLaunchArmAddress,
      abi: CCA_LP_MANAGER_ABI as unknown as Abi,
      functionName: 'getPoolKey',
    })) as {
      currency0: `0x${string}`
      currency1: `0x${string}`
    }
    checksRun++
    const currency0 = poolKey.currency0.toLowerCase()
    const currency1 = poolKey.currency1.toLowerCase()
    const share = params.input.shareTokenAddress.toLowerCase()
    const nativePair =
      (currency0 === zeroAddress && currency1 === share)
      || (currency1 === zeroAddress && currency0 === share)
    if (!nativePair) {
      params.recordViolation(
        'share_mesh_pool_key_mismatch',
        'CCA pool key is not ShareOFT/native ETH mesh pairing',
        `${share}/native`,
        `${currency0}/${currency1}`,
      )
    }
  }

  const fullRange = (await params.publicClient.readContract({
    address: lpManager,
    abi: LP_MANAGER_ABI as unknown as Abi,
    functionName: 'fullRangePosition',
  })) as readonly [number, number, bigint, bigint]
  checksRun++
  if (BigInt(fullRange[2] ?? 0) === 0n) {
    params.recordViolation(
      'share_mesh_not_seeded',
      'LP manager full-range position is empty after seedRebalance()',
    )
  }

  return checksRun
}
