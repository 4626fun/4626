import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from 'viem'

import { resolveProtocolTreasuryAddress } from '../wallet/protocolTreasurySafe.js'
import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const PHASE3_HELPER_ARTIFACT_PATH = path.join(
  REPO_ROOT,
  'out/DeploymentBatcher.sol/DeploymentBatcherPhase3Helper.json',
)

const ANVIL_DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const
const ANVIL_DEPLOYER_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const

const BATCHER_ABI = [
  {
    type: 'function',
    name: 'phase3Helper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'phase2Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniV4Helper',
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
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'wireDeploymentHelpers',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'phase2Module', type: 'address' },
      { name: 'phase3Helper', type: 'address' },
      { name: 'uniV4Helper', type: 'address' },
      { name: 'utilsHelper', type: 'address' },
    ],
    outputs: [],
  },
] as const

const PHASE3_HELPER_IMMUTABLES_ABI = [
  {
    type: 'function',
    name: 'protocolAutomation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniswapV3Factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniswapRouter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ajnaFactory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

type ReadContractClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  getBytecode: (args: { address: Address }) => Promise<Hex | undefined>
}

type SendTransactionClient = {
  sendTransaction: (args: {
    account: Address
    to: Address
    data: Hex
    value?: bigint
    chain?: unknown
  }) => Promise<Hex>
}

type WaitReceiptClient = {
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{
    status: string
    contractAddress?: Address | null
  }>
}

function normalizeRuntimeBytecode(code: string | undefined): string {
  const trimmed = String(code ?? '').trim().toLowerCase()
  return trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
}

function readLocalPhase3HelperArtifact(): {
  abi: readonly unknown[]
  bytecode: Hex
  deployedBytecode: string
  immutableReferences: ImmutableReferenceMap
} {
  const artifact = JSON.parse(readFileSync(PHASE3_HELPER_ARTIFACT_PATH, 'utf8')) as {
    abi: readonly unknown[]
    bytecode?: { object?: string }
    deployedBytecode?: {
      object?: string
      immutableReferences?: ImmutableReferenceMap
    }
  }
  const bytecode = artifact.bytecode?.object?.trim()
  const deployedBytecode = artifact.deployedBytecode?.object?.trim()
  if (!bytecode || bytecode === '0x' || !deployedBytecode || deployedBytecode === '0x') {
    throw new Error(
      `Missing Phase3 helper bytecode in ${PHASE3_HELPER_ARTIFACT_PATH}. Run forge build at repo root first.`,
    )
  }
  return {
    abi: artifact.abi,
    bytecode: bytecode as Hex,
    deployedBytecode: normalizeRuntimeBytecode(deployedBytecode),
    immutableReferences: artifact.deployedBytecode?.immutableReferences ?? {},
  }
}

type ImmutableReferenceMap = Record<string, Array<{ start: number; length: number }>>

function stripImmutableSlots(runtimeBytecode: string, immutableReferences: ImmutableReferenceMap): string {
  const normalized = normalizeRuntimeBytecode(runtimeBytecode)
  if (normalized.length === 0) return normalized
  const bytes = Buffer.from(normalized, 'hex')
  const slots = Object.values(immutableReferences).flat()
  for (const slot of slots) {
    const end = slot.start + slot.length
    if (slot.start < 0 || end > bytes.length) continue
    bytes.fill(0, slot.start, end)
  }
  return bytes.toString('hex')
}

function comparePhase3HelperRuntimeBytecode(params: {
  onChainBytecode: string | undefined
  localDeployedBytecode: string
  immutableReferences: ImmutableReferenceMap
}): boolean {
  const onChain = normalizeRuntimeBytecode(params.onChainBytecode)
  if (!onChain) return false
  const localComparable = stripImmutableSlots(params.localDeployedBytecode, params.immutableReferences)
  const onChainComparable = stripImmutableSlots(onChain, params.immutableReferences)
  return onChainComparable === localComparable
}

function deployPhase3HelperViaForge(params: {
  rpcUrl: string
  create2Deployer: Address
  protocolTreasury: Address
  protocolAutomation: Address
  usdc: Address
  uniswapV3Factory: Address
  uniswapRouter: Address
  ajnaFactory: Address
  batcher: Address
}): Address {
  const command = [
    'forge',
    'create',
    'contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcherPhase3Helper',
    '--rpc-url',
    params.rpcUrl,
    '--private-key',
    ANVIL_DEPLOYER_KEY,
    '--broadcast',
    '--constructor-args',
    params.create2Deployer,
    params.protocolTreasury,
    params.protocolAutomation,
    params.usdc,
    params.uniswapV3Factory,
    params.uniswapRouter,
    params.ajnaFactory,
    params.batcher,
  ]
  let output = ''
  try {
    output = execSync(command.join(' '), {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const combined = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim()
    throw new Error(
      combined.length > 0
        ? `forge create DeploymentBatcherPhase3Helper failed:\n${combined.slice(-4000)}`
        : (err.message ?? 'forge create failed'),
    )
  }
  const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/)
  if (!match?.[1]) {
    throw new Error(`forge create did not report Deployed to address. Output tail:\n${output.slice(-2000)}`)
  }
  return getAddress(match[1] as Address)
}

export async function readPhase3HelperBytecodeAligned(params: {
  publicClient: ReadContractClient
  batcher: Address
}): Promise<{ aligned: boolean; phase3Helper: Address; localDeployedBytecode: string; onChainBytecode: string }> {
  const batcher = getAddress(params.batcher)
  const phase3Helper = getAddress(
    (await params.publicClient.readContract({
      address: batcher,
      abi: BATCHER_ABI,
      functionName: 'phase3Helper',
    })) as Address,
  )
  const { deployedBytecode: localDeployedBytecode, immutableReferences } = readLocalPhase3HelperArtifact()
  const onChainBytecode = normalizeRuntimeBytecode(
    await params.publicClient.getBytecode({ address: phase3Helper }),
  )
  return {
    aligned: comparePhase3HelperRuntimeBytecode({
      onChainBytecode,
      localDeployedBytecode,
      immutableReferences,
    }),
    phase3Helper,
    localDeployedBytecode,
    onChainBytecode,
  }
}

/**
 * Live mainnet Phase 3 helper still calls addStrategy internally; fork dry-runs deploy
 * a fresh helper from local forge artifacts and wire it on the canonical batcher shell.
 */
export async function ensurePhase3DryRunHelperOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: WaitReceiptClient['waitForTransactionReceipt']
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  batcher: Address
  rpcUrl: string
  ownerBalanceHex?: Hex
}): Promise<{
  alreadyAligned: boolean
  ensured: boolean
  previousPhase3Helper: Address
  phase3Helper: Address
}> {
  const batcher = getAddress(params.batcher)
  const before = await readPhase3HelperBytecodeAligned({
    publicClient: params.publicClient,
    batcher,
  })
  if (before.aligned) {
    return {
      alreadyAligned: true,
      ensured: false,
      previousPhase3Helper: before.phase3Helper,
      phase3Helper: before.phase3Helper,
    }
  }

  const previousPhase3Helper = before.phase3Helper
  const [create2Deployer, phase2Module, uniV4Helper, utilsHelper, protocolAutomation, usdc, uniswapV3Factory, uniswapRouter, ajnaFactory] =
    await Promise.all([
      params.publicClient.readContract({
        address: batcher,
        abi: BATCHER_ABI,
        functionName: 'create2Deployer',
      }),
      params.publicClient.readContract({
        address: batcher,
        abi: BATCHER_ABI,
        functionName: 'phase2Module',
      }),
      params.publicClient.readContract({
        address: batcher,
        abi: BATCHER_ABI,
        functionName: 'uniV4Helper',
      }),
      params.publicClient.readContract({
        address: batcher,
        abi: BATCHER_ABI,
        functionName: 'utilsHelper',
      }),
      params.publicClient.readContract({
        address: previousPhase3Helper,
        abi: PHASE3_HELPER_IMMUTABLES_ABI,
        functionName: 'protocolAutomation',
      }),
      params.publicClient.readContract({
        address: previousPhase3Helper,
        abi: PHASE3_HELPER_IMMUTABLES_ABI,
        functionName: 'usdc',
      }),
      params.publicClient.readContract({
        address: previousPhase3Helper,
        abi: PHASE3_HELPER_IMMUTABLES_ABI,
        functionName: 'uniswapV3Factory',
      }),
      params.publicClient.readContract({
        address: previousPhase3Helper,
        abi: PHASE3_HELPER_IMMUTABLES_ABI,
        functionName: 'uniswapRouter',
      }),
      params.publicClient.readContract({
        address: previousPhase3Helper,
        abi: PHASE3_HELPER_IMMUTABLES_ABI,
        functionName: 'ajnaFactory',
      }),
    ])

  const protocolTreasury = resolveProtocolTreasuryAddress()
  const balanceHex = params.ownerBalanceHex ?? ('0x56bc75e2d63100000' as Hex)
  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: [ANVIL_DEPLOYER, balanceHex],
  })

  const deployedHelper = deployPhase3HelperViaForge({
    rpcUrl: params.rpcUrl,
    create2Deployer: getAddress(create2Deployer as Address),
    protocolTreasury,
    protocolAutomation: getAddress(protocolAutomation as Address),
    usdc: getAddress(usdc as Address),
    uniswapV3Factory: getAddress(uniswapV3Factory as Address),
    uniswapRouter: getAddress(uniswapRouter as Address),
    ajnaFactory: getAddress(ajnaFactory as Address),
    batcher,
  })

  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: [protocolTreasury, balanceHex],
  })
  await params.forkRequest({
    method: params.forkMode.impersonateMethod,
    params: [protocolTreasury],
  })

  try {
    const wireData = encodeFunctionData({
      abi: BATCHER_ABI,
      functionName: 'wireDeploymentHelpers',
      args: [
        getAddress(phase2Module as Address),
        deployedHelper,
        getAddress(uniV4Helper as Address),
        getAddress(utilsHelper as Address),
      ],
    })
    const wireHash = await params.walletClient.sendTransaction({
      account: protocolTreasury,
      to: batcher,
      data: wireData,
      value: 0n,
    })
    const wireReceipt = await params.waitForTransactionReceipt({ hash: wireHash })
    if (wireReceipt.status !== 'success') {
      throw new Error(`wireDeploymentHelpers reverted on fork (tx ${wireHash}).`)
    }
  } finally {
    try {
      await params.forkRequest({
        method: params.forkMode.stopMethod,
        params: [protocolTreasury],
      })
    } catch {
      // Best-effort cleanup on local forks.
    }
  }

  const after = await readPhase3HelperBytecodeAligned({
    publicClient: params.publicClient,
    batcher,
  })
  if (!after.aligned) {
    throw new Error(
      `Phase3 helper on fork still misaligned after wireDeploymentHelpers ` +
        `(wired=${deployedHelper}, batcher.phase3Helper=${after.phase3Helper}).`,
    )
  }

  return {
    alreadyAligned: false,
    ensured: true,
    previousPhase3Helper,
    phase3Helper: after.phase3Helper,
  }
}
