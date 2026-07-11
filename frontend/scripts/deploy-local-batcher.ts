import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  isDeprecatedDeploymentBatcherAddress,
} from '../src/config/contracts.defaults.js'
import { deploymentBatcherNotConfiguredMessage } from '../src/lib/deploy/deploymentBatcherConfigError.js'
import { readPhase1ModuleAddress } from '../src/lib/deploy/phase1ModuleDeploy.js'

const DEFAULT_SOURCE_BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER as Address
// Anvil account #0. Local-only default used to deploy the replacement batcher onto the fork.
const DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const PHASE1_MODULE_DEPS_ABI = [
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'bytecodeStore',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'registry',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultCoreModule',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'agentVaultCoreModule',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultStrategiesModule',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultAdminModule',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultActivationBatcher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'utilsHelper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const SET_PHASE1_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase1Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase1Module', type: 'address' }],
    outputs: [],
  },
] as const

const SET_PHASE2_MODULE_ABI = [
  {
    type: 'function',
    name: 'setPhase2Module',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_phase2Module', type: 'address' }],
    outputs: [],
  },
] as const

const APPROVE_PHASE_MODULE_CODEHASH_ABI = [
  {
    type: 'function',
    name: 'approvePhaseModuleCodehash',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'module', type: 'address' },
      { name: 'codehash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

/** 100 ETH — forked Safe/treasury balances are often too low for gas. */
const ANVIL_FUNDED_BALANCE = '0x56bc75e2d63100000'

const OVAULT_RUNTIME_ABI = [
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hubComposer', type: 'address' },
          { name: 'solanaEid', type: 'uint32' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'setOVaultRuntimeConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_hubComposer', type: 'address' },
      { name: '_solanaEid', type: 'uint32' },
      { name: '_enabled', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const SOLANA_CONFIG_ABI = [
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setSolanaConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_adapter', type: 'address' },
      { name: '_destination', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'solanaShareOftPeer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setSolanaShareOftPeer',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_peer', type: 'bytes32' }],
    outputs: [],
  },
] as const

const CREATE2_AUTH_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ name: 'deployer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setAuthorizedDeployer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'deployer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const REGISTRY_4626_AUTH_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedFactories',
    stateMutability: 'view',
    inputs: [{ name: 'factory', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setAuthorizedFactory',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'factory', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')

const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC ?? 'http://127.0.0.1:8545').trim()
const sourceBatcherRaw = (
  process.env.DEPLOY_DRY_RUN_SOURCE_BATCHER ??
  DEFAULT_SOURCE_BATCHER
).trim()
const deployerPrivateKey = (process.env.DEPLOY_DRY_RUN_DEPLOYER_PRIVATE_KEY ?? DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY).trim()

if (!isAddress(sourceBatcherRaw)) {
  throw new Error(`Invalid DEPLOY_DRY_RUN_SOURCE_BATCHER: ${sourceBatcherRaw || '(empty)'}`)
}
if (isDeprecatedDeploymentBatcherAddress(sourceBatcherRaw)) {
  throw new Error(
    `DEPLOY_DRY_RUN_SOURCE_BATCHER is a deprecated alias. ${deploymentBatcherNotConfiguredMessage(sourceBatcherRaw)}`,
  )
}
if (!/^0x[a-fA-F0-9]{64}$/.test(deployerPrivateKey)) {
  throw new Error('DEPLOY_DRY_RUN_DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.')
}

const sourceBatcher = getAddress(sourceBatcherRaw) as Address
const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl, { timeout: 30_000 }),
})

function addressGetterAbi(name: string) {
  return [
    {
      type: 'function',
      name,
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'address' }],
    },
  ] as const
}

async function readAddressGetter(batcher: Address, name: string): Promise<Address> {
  const abi = addressGetterAbi(name)
  const data = encodeFunctionData({ abi, functionName: name as never })
  const result = await publicClient.call({
    to: batcher,
    data,
  })
  const value = decodeFunctionResult({
    abi,
    functionName: name as never,
    data: result.data,
  }) as Address
  return getAddress(value) as Address
}

const CONSTRUCTOR_GETTER_FALLBACKS: Record<string, readonly string[]> = {
  // Older batcher shells expose this helper as `shareMeshHelper()` instead of `uniV4Helper()`.
  uniV4Helper: ['shareMeshHelper'],
}

const CONSTRUCTOR_GETTER_ENV_FALLBACKS: Record<string, readonly string[]> = {
  uniV4Helper: ['DEPLOYMENT_BATCHER_SHARE_MESH_HELPER', 'VITE_DEPLOYMENT_BATCHER_SHARE_MESH_HELPER'],
}

async function resolveConstructorGetter(batcher: Address, getterName: string): Promise<Address> {
  const attemptedGetters: string[] = []
  const getterCandidates = [getterName, ...(CONSTRUCTOR_GETTER_FALLBACKS[getterName] ?? [])]

  for (const candidate of getterCandidates) {
    attemptedGetters.push(candidate)
    try {
      return await readAddressGetter(batcher, candidate)
    } catch {
      // Try the next alias.
    }
  }

  const envFallbackKeys = CONSTRUCTOR_GETTER_ENV_FALLBACKS[getterName] ?? []
  for (const envKey of envFallbackKeys) {
    const raw = String(process.env[envKey] ?? '').trim()
    if (!raw) continue
    if (!isAddress(raw)) {
      throw new Error(
        `${envKey} is set but invalid: ${raw}. Provide a valid address to satisfy ${getterName}() fallback.`,
      )
    }
    return getAddress(raw) as Address
  }

  const attempted = attemptedGetters.map((name) => `${name}()`).join(', ')
  const envHint =
    envFallbackKeys.length > 0
      ? ` or set one of: ${envFallbackKeys.join(', ')}`
      : ''
  throw new Error(
    `Source batcher ${batcher} is missing required constructor getter(s): ${attempted}${envHint}.`,
  )
}

async function anvilRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message?: string } }
  if (json.error) throw new Error(json.error.message ?? `anvil ${method} failed`)
  return json.result as T
}

async function fundAndImpersonate(account: Address): Promise<void> {
  await anvilRpc('anvil_setBalance', [account, ANVIL_FUNDED_BALANCE])
  await anvilRpc<boolean>('anvil_impersonateAccount', [account])
}

async function sendImpersonatedTx(params: {
  from: Address
  to: Address
  data: Hex
  label: string
}): Promise<Hex> {
  const txHash = await anvilRpc<Hex>('eth_sendTransaction', [
    {
      from: params.from,
      to: params.to,
      data: params.data,
      value: '0x0',
    },
  ])
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 })
  if (receipt.status !== 'success') {
    throw new Error(`${params.label} reverted (tx ${txHash})`)
  }
  return txHash
}

async function extCodehash(module: Address): Promise<Hex> {
  const code = await publicClient.getBytecode({ address: module })
  if (!code || code === '0x') {
    throw new Error(`No bytecode at module ${module}`)
  }
  return keccak256(code)
}

/**
 * AUDIT-2026-07-08-H08: setPhase*Module requires a prior non-zero codehash approval.
 * Fresh local batchers start with an empty allowlist, so approve before wiring.
 */
async function approveAndSetPhaseModule(params: {
  localBatcher: Address
  protocolTreasury: Address
  module: Address
  setFunctionName: 'setPhase1Module' | 'setPhase2Module'
}): Promise<void> {
  await fundAndImpersonate(params.protocolTreasury)
  const codehash = await extCodehash(params.module)
  await sendImpersonatedTx({
    from: params.protocolTreasury,
    to: params.localBatcher,
    data: encodeFunctionData({
      abi: APPROVE_PHASE_MODULE_CODEHASH_ABI,
      functionName: 'approvePhaseModuleCodehash',
      args: [params.module, codehash],
    }),
    label: `approvePhaseModuleCodehash(${params.module})`,
  })
  const setAbi =
    params.setFunctionName === 'setPhase1Module' ? SET_PHASE1_MODULE_ABI : SET_PHASE2_MODULE_ABI
  await sendImpersonatedTx({
    from: params.protocolTreasury,
    to: params.localBatcher,
    data: encodeFunctionData({
      abi: setAbi,
      functionName: params.setFunctionName,
      args: [params.module],
    }),
    label: `${params.setFunctionName}(${params.module})`,
  })
}

function runForgeCreate(contract: string, constructorArgs: readonly string[]): Address {
  const baseForgePrefixArgs = [
    'create',
    contract,
    '--rpc-url',
    rpcUrl,
    '--private-key',
    deployerPrivateKey,
    '--broadcast',
  ]
  const legacyGasPrice = (process.env.DEPLOY_DRY_RUN_LEGACY_GAS_PRICE ?? '2000000000').trim()

  const runCreate = (extraArgs: string[] = []): Address => {
    const forgeArgs = [...baseForgePrefixArgs, ...extraArgs]
    if (constructorArgs.length > 0) {
      forgeArgs.push('--constructor-args', ...constructorArgs)
    }
    const stdout = execFileSync('forge', forgeArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        FOUNDRY_DISABLE_NIGHTLY_WARNING: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const match = stdout.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/i)
    if (!match) {
      throw new Error(`Could not parse deployed address from forge output:\n${stdout}`)
    }
    return getAddress(match[1] as Address) as Address
  }

  try {
    return runCreate()
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = String((error as { stdout?: string | Buffer }).stdout ?? '')
      const stderr = String((error as { stderr?: string | Buffer }).stderr ?? '')
      const combined = `${stdout}\n${stderr}`.toLowerCase()
      if (combined.includes('max fee per gas less than block base fee')) {
        try {
          return runCreate(['--legacy', '--gas-price', legacyGasPrice])
        } catch (legacyError) {
          if (legacyError && typeof legacyError === 'object' && 'stdout' in legacyError) {
            const legacyStdout = String((legacyError as { stdout?: string | Buffer }).stdout ?? '')
            const legacyStderr = String((legacyError as { stderr?: string | Buffer }).stderr ?? '')
            throw new Error(`forge create failed after EIP-1559 + legacy retry.\n${legacyStdout}\n${legacyStderr}`.trim())
          }
          throw legacyError
        }
      }
      throw new Error(`forge create failed.\n${stdout}\n${stderr}`.trim())
    }
    throw error
  }
}

async function resolveAgentVaultCoreModuleForLocalPhase1(params: {
  phase1ModuleAddress: Address
}): Promise<Address> {
  const fromEnv = (process.env.DEPLOY_DRY_RUN_AGENT_VAULT_CORE_MODULE ?? '').trim()
  if (isAddress(fromEnv)) {
    return getAddress(fromEnv) as Address
  }

  try {
    const value = await publicClient.readContract({
      address: params.phase1ModuleAddress,
      abi: PHASE1_MODULE_DEPS_ABI,
      functionName: 'agentVaultCoreModule',
    })
    if (isAddress(String(value))) {
      return getAddress(value as Address) as Address
    }
  } catch {
    // Live Phase1Module bytecode may predate agentVaultCoreModule.
  }

  return runForgeCreate(
    'contracts/agent/vault/modules/AgentOVaultCoreModule.sol:AgentOVaultCoreModule',
    [],
  )
}

async function readPhase1ModuleDeps(phase1ModuleAddress: Address): Promise<{
  create2Deployer: Address
  bytecodeStore: Address
  registry: Address
  vaultCoreModule: Address
  agentVaultCoreModule: Address
  vaultStrategiesModule: Address
  vaultAdminModule: Address
  vaultActivationBatcher: Address
  utilsHelper: Address
}> {
  const readField = async (
    functionName:
      | 'create2Deployer'
      | 'bytecodeStore'
      | 'registry'
      | 'vaultCoreModule'
      | 'vaultStrategiesModule'
      | 'vaultAdminModule'
      | 'vaultActivationBatcher'
      | 'utilsHelper',
  ): Promise<Address> => {
    const value = await publicClient.readContract({
      address: phase1ModuleAddress,
      abi: PHASE1_MODULE_DEPS_ABI,
      functionName,
    })
    if (!isAddress(String(value))) {
      throw new Error(`Phase1Module ${phase1ModuleAddress} missing ${functionName}`)
    }
    return getAddress(value as Address) as Address
  }

  const [
    create2Deployer,
    bytecodeStore,
    registry,
    vaultCoreModule,
    vaultStrategiesModule,
    vaultAdminModule,
    vaultActivationBatcher,
    utilsHelper,
    agentVaultCoreModule,
  ] = await Promise.all([
    readField('create2Deployer'),
    readField('bytecodeStore'),
    readField('registry'),
    readField('vaultCoreModule'),
    readField('vaultStrategiesModule'),
    readField('vaultAdminModule'),
    readField('vaultActivationBatcher'),
    readField('utilsHelper'),
    resolveAgentVaultCoreModuleForLocalPhase1({ phase1ModuleAddress }),
  ])

  return {
    create2Deployer,
    bytecodeStore,
    registry,
    vaultCoreModule,
    agentVaultCoreModule,
    vaultStrategiesModule,
    vaultAdminModule,
    vaultActivationBatcher,
    utilsHelper,
  }
}

async function ensureLocalBatcherCreate2Authorization(
  localBatcher: Address,
  create2Deployer: Address,
): Promise<void> {
  const authorized = (await publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [localBatcher],
  })) as boolean
  if (authorized) return

  const create2Owner = getAddress(
    (await publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_AUTH_ABI,
      functionName: 'owner',
    })) as Address,
  )

  await fundAndImpersonate(create2Owner)
  await sendImpersonatedTx({
    from: create2Owner,
    to: create2Deployer,
    data: encodeFunctionData({
      abi: CREATE2_AUTH_ABI,
      functionName: 'setAuthorizedDeployer',
      args: [localBatcher, true],
    }),
    label: `setAuthorizedDeployer(${localBatcher})`,
  })

  const verified = (await publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [localBatcher],
  })) as boolean
  if (!verified) {
    throw new Error(`Local batcher ${localBatcher} still unauthorized on create2 deployer ${create2Deployer}`)
  }
}

async function wireLocalPhase1Module(localBatcher: Address): Promise<Address> {
  const sourcePhase1Module = await readPhase1ModuleAddress({
    publicClient,
    batcherAddress: sourceBatcher,
  })
  if (!sourcePhase1Module) {
    throw new Error(`Source batcher ${sourceBatcher} has no configured phase1Module`)
  }

  const deps = await readPhase1ModuleDeps(sourcePhase1Module)
  const localPhase1Module = runForgeCreate(
    'contracts/shared/deploy/batchers/DeploymentBatcher.sol:DeploymentBatcherPhase1Module',
    [
      deps.create2Deployer,
      deps.bytecodeStore,
      deps.registry,
      deps.vaultCoreModule,
      deps.agentVaultCoreModule,
      deps.vaultStrategiesModule,
      deps.vaultAdminModule,
      deps.vaultActivationBatcher,
      deps.utilsHelper,
      localBatcher,
    ],
  )

  const wiredBatcher = await publicClient.readContract({
    address: localPhase1Module,
    abi: [{ type: 'function', name: 'batcher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
    functionName: 'batcher',
  })
  if (getAddress(wiredBatcher as Address) !== localBatcher) {
    throw new Error(`Local Phase1Module batcher mismatch: expected ${localBatcher}, got ${wiredBatcher}`)
  }

  const protocolTreasury = await readAddressGetter(localBatcher, 'protocolTreasury')
  await approveAndSetPhaseModule({
    localBatcher,
    protocolTreasury,
    module: localPhase1Module,
    setFunctionName: 'setPhase1Module',
  })

  const configuredPhase1 = await readPhase1ModuleAddress({
    publicClient,
    batcherAddress: localBatcher,
  })
  if (!configuredPhase1 || getAddress(configuredPhase1) !== localPhase1Module) {
    throw new Error(`setPhase1Module did not wire local batcher ${localBatcher}`)
  }

  await ensureLocalBatcherCreate2Authorization(localBatcher, deps.create2Deployer)

  return localPhase1Module
}

async function wireLocalPhase2Module(localBatcher: Address): Promise<Address> {
  const sourceCreate2Deployer = await readAddressGetter(sourceBatcher, 'create2Deployer')
  const sourceRegistry = await readAddressGetter(sourceBatcher, 'registry')
  const sourceChainlinkEthUsd = await readAddressGetter(sourceBatcher, 'chainlinkEthUsd')
  const sourcePoolManager = await readAddressGetter(sourceBatcher, 'poolManager')
  const sourceTaxHook = await readAddressGetter(sourceBatcher, 'taxHook')
  const sourceProtocolTreasury = await readAddressGetter(sourceBatcher, 'protocolTreasury')
  const sourceLotteryManager = await readAddressGetter(sourceBatcher, 'lotteryManager')
  const sourceVaultActivationBatcher = await readAddressGetter(sourceBatcher, 'vaultActivationBatcher')

  const localPhase2Module = runForgeCreate(
    'contracts/shared/deploy/batchers/DeploymentBatcher.sol:DeploymentBatcherPhase2Module',
    [
      sourceCreate2Deployer,
      sourceRegistry,
      sourceChainlinkEthUsd,
      sourcePoolManager,
      sourceTaxHook,
      sourceProtocolTreasury,
      sourceLotteryManager,
      sourceVaultActivationBatcher,
      localBatcher,
    ],
  )

  const wiredBatcher = await publicClient.readContract({
    address: localPhase2Module,
    abi: [{ type: 'function', name: 'batcher', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
    functionName: 'batcher',
  })
  if (getAddress(wiredBatcher as Address) !== localBatcher) {
    throw new Error(`Local Phase2Module batcher mismatch: expected ${localBatcher}, got ${wiredBatcher}`)
  }

  const protocolTreasury = await readAddressGetter(localBatcher, 'protocolTreasury')
  await approveAndSetPhaseModule({
    localBatcher,
    protocolTreasury,
    module: localPhase2Module,
    setFunctionName: 'setPhase2Module',
  })

  const configuredPhase2 = await readAddressGetter(localBatcher, 'phase2Module')
  if (getAddress(configuredPhase2) !== localPhase2Module) {
    throw new Error(`setPhase2Module did not wire local batcher ${localBatcher}`)
  }

  return localPhase2Module
}

async function syncOvaultRuntimeConfig(localBatcher: Address): Promise<void> {
  const sourceRuntimeRaw = await publicClient.readContract({
    address: sourceBatcher,
    abi: OVAULT_RUNTIME_ABI,
    functionName: 'getOVaultRuntimeConfig',
  })
  const sourceRuntime =
    sourceRuntimeRaw && typeof sourceRuntimeRaw === 'object'
      ? (sourceRuntimeRaw as { hubComposer?: Address; solanaEid?: number | bigint; enabled?: boolean })
      : null
  if (!sourceRuntime) return

  const hubComposerRaw = sourceRuntime.hubComposer
  const hubComposer = isAddress(String(hubComposerRaw ?? ''))
    ? (getAddress(hubComposerRaw as Address) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)
  const solanaEidRaw = sourceRuntime.solanaEid
  const solanaEid = Number(typeof solanaEidRaw === 'bigint' ? solanaEidRaw : solanaEidRaw ?? 0)
  const enabled = sourceRuntime.enabled === true

  const localRuntimeRaw = await publicClient.readContract({
    address: localBatcher,
    abi: OVAULT_RUNTIME_ABI,
    functionName: 'getOVaultRuntimeConfig',
  })
  const localRuntime =
    localRuntimeRaw && typeof localRuntimeRaw === 'object'
      ? (localRuntimeRaw as { hubComposer?: Address; solanaEid?: number | bigint; enabled?: boolean })
      : null
  const localHubComposerRaw = localRuntime?.hubComposer
  const localHubComposer = isAddress(String(localHubComposerRaw ?? ''))
    ? (getAddress(localHubComposerRaw as Address) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)
  const localSolanaEidRaw = localRuntime?.solanaEid
  const localSolanaEid = Number(typeof localSolanaEidRaw === 'bigint' ? localSolanaEidRaw : localSolanaEidRaw ?? 0)
  const localEnabled = localRuntime?.enabled === true
  if (
    localEnabled === enabled &&
    localHubComposer.toLowerCase() === hubComposer.toLowerCase() &&
    localSolanaEid === solanaEid
  ) {
    return
  }

  const protocolTreasury = await readAddressGetter(localBatcher, 'protocolTreasury')
  await fundAndImpersonate(protocolTreasury)
  await sendImpersonatedTx({
    from: protocolTreasury,
    to: localBatcher,
    data: encodeFunctionData({
      abi: OVAULT_RUNTIME_ABI,
      functionName: 'setOVaultRuntimeConfig',
      args: [hubComposer, solanaEid, enabled],
    }),
    label: 'setOVaultRuntimeConfig',
  })
}

async function syncSolanaConfig(localBatcher: Address): Promise<void> {
  const sourceAdapterRaw = await publicClient.readContract({
    address: sourceBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaBridgeAdapter',
  })
  const sourceDestinationRaw = await publicClient.readContract({
    address: sourceBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaDestination',
  })
  const sourceSharePeerRaw = await publicClient.readContract({
    address: sourceBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaShareOftPeer',
  })
  if (!isAddress(String(sourceAdapterRaw ?? ''))) return
  const sourceAdapter = getAddress(sourceAdapterRaw as Address) as Address
  const sourceDestination = sourceDestinationRaw as Hex
  const sourceSharePeer = sourceSharePeerRaw as Hex

  const localAdapterRaw = await publicClient.readContract({
    address: localBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaBridgeAdapter',
  })
  const localDestinationRaw = await publicClient.readContract({
    address: localBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaDestination',
  })
  const localSharePeerRaw = await publicClient.readContract({
    address: localBatcher,
    abi: SOLANA_CONFIG_ABI,
    functionName: 'solanaShareOftPeer',
  })
  const localAdapter = isAddress(String(localAdapterRaw ?? ''))
    ? (getAddress(localAdapterRaw as Address) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)
  const localDestination = localDestinationRaw as Hex
  const localSharePeer = localSharePeerRaw as Hex
  const solanaConfigMatches =
    localAdapter.toLowerCase() === sourceAdapter.toLowerCase() &&
    String(localDestination).toLowerCase() === String(sourceDestination).toLowerCase()
  const sharePeerMatches = String(localSharePeer).toLowerCase() === String(sourceSharePeer).toLowerCase()
  if (solanaConfigMatches && sharePeerMatches) {
    return
  }

  const protocolTreasury = await readAddressGetter(localBatcher, 'protocolTreasury')
  await fundAndImpersonate(protocolTreasury)
  if (!solanaConfigMatches) {
    await sendImpersonatedTx({
      from: protocolTreasury,
      to: localBatcher,
      data: encodeFunctionData({
        abi: SOLANA_CONFIG_ABI,
        functionName: 'setSolanaConfig',
        args: [sourceAdapter, sourceDestination],
      }),
      label: 'setSolanaConfig',
    })
  }

  if (!sharePeerMatches) {
    await sendImpersonatedTx({
      from: protocolTreasury,
      to: localBatcher,
      data: encodeFunctionData({
        abi: SOLANA_CONFIG_ABI,
        functionName: 'setSolanaShareOftPeer',
        args: [sourceSharePeer],
      }),
      label: 'setSolanaShareOftPeer',
    })
  }
}

async function ensureRegistryAuthorizedFactory(localBatcher: Address): Promise<void> {
  const registryRaw = await readAddressGetter(sourceBatcher, 'registry')
  if (!isAddress(String(registryRaw ?? ''))) return
  const registry = getAddress(registryRaw as Address) as Address

  const alreadyAuthorized = (await publicClient.readContract({
    address: registry,
    abi: REGISTRY_4626_AUTH_ABI,
    functionName: 'authorizedFactories',
    args: [localBatcher],
  })) as boolean
  if (alreadyAuthorized) return

  const registryOwner = getAddress(
    (await publicClient.readContract({
      address: registry,
      abi: REGISTRY_4626_AUTH_ABI,
      functionName: 'owner',
    })) as Address,
  )
  await fundAndImpersonate(registryOwner)
  await sendImpersonatedTx({
    from: registryOwner,
    to: registry,
    data: encodeFunctionData({
      abi: REGISTRY_4626_AUTH_ABI,
      functionName: 'setAuthorizedFactory',
      args: [localBatcher, true],
    }),
    label: `setAuthorizedFactory(${localBatcher})`,
  })
}

async function main() {
  const constructorGetterNames = [
    'registry',
    'bytecodeStore',
    'create2Deployer',
    'protocolTreasury',
    'poolManager',
    'taxHook',
    'chainlinkEthUsd',
    'vaultActivationBatcher',
    'lotteryManager',
    'permit2',
    'usdc',
    'uniswapV3Factory',
    'uniswapRouter',
    'ajnaFactory',
    'vaultCoreModule',
    'vaultStrategiesModule',
    'vaultAdminModule',
    'phase2Module',
    'phase3Helper',
    'uniV4Helper',
    'utilsHelper',
  ] as const

  const protocolAutomation = await (async () => {
    try {
      const phase3Helper = await readAddressGetter(sourceBatcher, 'phase3Helper')
      return (await publicClient.readContract({
        address: phase3Helper,
        abi: [
          {
            type: 'function',
            name: 'protocolAutomation',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }],
          },
        ],
        functionName: 'protocolAutomation',
      })) as Address
    } catch {
      const fromEnv = (process.env.PROTOCOL_AUTOMATION_SAFE ?? process.env.PROTOCOL_AUTOMATION ?? '').trim()
      if (isAddress(fromEnv)) return getAddress(fromEnv) as Address
      throw new Error('protocolAutomation missing on phase3Helper and PROTOCOL_AUTOMATION_SAFE env')
    }
  })()

  const constructorArgs = await Promise.all(
    constructorGetterNames.map((name) => resolveConstructorGetter(sourceBatcher, name)),
  )
  constructorArgs.splice(4, 0, protocolAutomation)
  const deployedBatcher = runForgeCreate(
    'contracts/shared/deploy/batchers/DeploymentBatcher.sol:DeploymentBatcher',
    constructorArgs,
  )
  await wireLocalPhase1Module(deployedBatcher)
  await wireLocalPhase2Module(deployedBatcher)
  await syncSolanaConfig(deployedBatcher)
  await syncOvaultRuntimeConfig(deployedBatcher)
  await ensureRegistryAuthorizedFactory(deployedBatcher)
  process.stdout.write(deployedBatcher)
}

await main()