import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem'

import { BASE_DEFAULTS } from '../../../src/config/contracts.defaults.js'
import { resolveAlignedPhase1DeployDeps } from '../../../src/lib/deploy/phase1ModuleDeploy.js'
import { resolveProtocolTreasuryAddress } from '../wallet/protocolTreasurySafe.js'
import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'
import {
  ANVIL_DEFAULT_DEPLOYER_PRIVATE_KEY,
  deployContractViaForgeCreate,
  scanDeployerCreateAddresses,
} from './forgeCreateOnFork.js'

/** Uniswap V3 swap router used by deploy UI auxiliary batcher calls. */
const DEFAULT_SWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481')

const AUX_BATCHER_IMMUTABLES_ABI = [
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
    name: 'deploymentBatcher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'protocolTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'swapRouter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
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

type ReadContractClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  getBytecode: (args: { address: Address }) => Promise<Hex | undefined>
  getTransactionCount: (args: { address: Address }) => Promise<number>
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

export type DryRunCall = {
  to: Address
  data: Hex
  value?: bigint | number | string
}

export function remapAuxiliaryDeployBatcherCalls<T extends DryRunCall>(
  calls: T[],
  from: Address,
  to: Address,
): T[] {
  const fromLower = getAddress(from).toLowerCase()
  const toAddress = getAddress(to)
  let rewrote = false
  const remapped = calls.map((call) => {
    if (getAddress(call.to).toLowerCase() !== fromLower) return call
    rewrote = true
    return { ...call, to: toAddress } as T
  })
  return rewrote ? remapped : calls
}

async function readAuxiliaryBatcherWiring(params: {
  publicClient: ReadContractClient
  batcher: Address
  configuredAuxiliaryBatcher: Address
}): Promise<{
  aligned: boolean
  configuredAuxiliaryBatcher: Address
  create2Deployer: Address
  bytecodeStore: Address
  swapRouter: Address
}> {
  const batcher = getAddress(params.batcher)
  const configuredAuxiliaryBatcher = getAddress(params.configuredAuxiliaryBatcher)
  const alignedDeps = await resolveAlignedPhase1DeployDeps({
    publicClient: params.publicClient as Parameters<typeof resolveAlignedPhase1DeployDeps>[0]['publicClient'],
    batcherAddress: batcher,
  })
  if (!alignedDeps.ok) {
    throw new Error(alignedDeps.message)
  }

  const expectedCreate2 = getAddress(alignedDeps.create2Deployer)
  const expectedStore = getAddress(alignedDeps.bytecodeStore)

  const bytecode = await params.publicClient.getBytecode({ address: configuredAuxiliaryBatcher })
  if (!bytecode || bytecode === '0x') {
    return {
      aligned: false,
      configuredAuxiliaryBatcher,
      create2Deployer: expectedCreate2,
      bytecodeStore: expectedStore,
      swapRouter: DEFAULT_SWAP_ROUTER,
    }
  }

  const [auxCreate2, auxStore, auxBatcher, swapRouter] = await Promise.all([
    params.publicClient.readContract({
      address: configuredAuxiliaryBatcher,
      abi: AUX_BATCHER_IMMUTABLES_ABI,
      functionName: 'create2Deployer',
    }),
    params.publicClient.readContract({
      address: configuredAuxiliaryBatcher,
      abi: AUX_BATCHER_IMMUTABLES_ABI,
      functionName: 'bytecodeStore',
    }),
    params.publicClient.readContract({
      address: configuredAuxiliaryBatcher,
      abi: AUX_BATCHER_IMMUTABLES_ABI,
      functionName: 'deploymentBatcher',
    }),
    params.publicClient.readContract({
      address: configuredAuxiliaryBatcher,
      abi: AUX_BATCHER_IMMUTABLES_ABI,
      functionName: 'swapRouter',
    }),
  ])

  const aligned =
    getAddress(auxCreate2 as Address) === expectedCreate2 &&
    getAddress(auxStore as Address) === expectedStore &&
    getAddress(auxBatcher as Address) === batcher

  return {
    aligned,
    configuredAuxiliaryBatcher,
    create2Deployer: expectedCreate2,
    bytecodeStore: expectedStore,
    swapRouter: getAddress(swapRouter as Address),
  }
}

async function findAlignedAuxiliaryBatcherFromForkDeploys(params: {
  publicClient: ReadContractClient
  batcher: Address
}): Promise<Address | null> {
  const candidates = await scanDeployerCreateAddresses({
    publicClient: params.publicClient,
    deployerPrivateKey: ANVIL_DEFAULT_DEPLOYER_PRIVATE_KEY,
  })
  for (const candidate of candidates) {
    const wiring = await readAuxiliaryBatcherWiring({
      publicClient: params.publicClient,
      batcher: params.batcher,
      configuredAuxiliaryBatcher: candidate,
    })
    if (wiring.aligned) {
      return candidate
    }
  }
  return null
}

function deployVaultAuxiliaryDeployBatcherViaForge(params: {
  rpcUrl: string
  create2Deployer: Address
  bytecodeStore: Address
  deploymentBatcher: Address
  protocolTreasury: Address
  swapRouter: Address
}): Address {
  return deployContractViaForgeCreate({
    rpcUrl: params.rpcUrl,
    contractPath: 'contracts/helpers/batchers/VaultAuxiliaryDeployBatcher.sol:VaultAuxiliaryDeployBatcher',
    contractLabel: 'VaultAuxiliaryDeployBatcher',
    constructorArgs: [
      params.create2Deployer,
      params.bytecodeStore,
      params.deploymentBatcher,
      params.protocolTreasury,
      params.swapRouter,
    ],
  })
}

async function ensureAuxiliaryBatcherCreate2AuthorizationOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  create2Deployer: Address
  auxiliaryBatcher: Address
  ownerBalanceHex?: Hex
}): Promise<{ alreadyAuthorized: boolean; ensured: boolean }> {
  const create2Deployer = getAddress(params.create2Deployer)
  const auxiliaryBatcher = getAddress(params.auxiliaryBatcher)
  const authorized = (await params.publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [auxiliaryBatcher],
  })) as boolean
  if (authorized === true) {
    return { alreadyAuthorized: true, ensured: false }
  }

  const owner = getAddress(
    (await params.publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_AUTH_ABI,
      functionName: 'owner',
    })) as Address,
  )
  const balanceHex = params.ownerBalanceHex ?? ('0x56bc75e2d63100000' as Hex)
  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: [owner, balanceHex],
  })
  await params.forkRequest({
    method: params.forkMode.impersonateMethod,
    params: [owner],
  })

  try {
    const data = encodeFunctionData({
      abi: CREATE2_AUTH_ABI,
      functionName: 'setAuthorizedDeployer',
      args: [auxiliaryBatcher, true],
    })
    const hash = await params.walletClient.sendTransaction({
      account: owner,
      to: create2Deployer,
      data,
      value: 0n,
    })
    const receipt = await params.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(
        `setAuthorizedDeployer(${auxiliaryBatcher}, true) reverted on fork (tx ${hash}).`,
      )
    }
  } finally {
    try {
      await params.forkRequest({
        method: params.forkMode.stopMethod,
        params: [owner],
      })
    } catch {
      // Best-effort cleanup on local forks.
    }
  }

  const after = (await params.publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [auxiliaryBatcher],
  })) as boolean
  if (after !== true) {
    throw new Error(
      `VaultAuxiliaryDeployBatcher ${auxiliaryBatcher} still unauthorized on create2 deployer ${create2Deployer}.`,
    )
  }
  return { alreadyAuthorized: false, ensured: true }
}

/**
 * Live VaultAuxiliaryDeployBatcher (0xa398…) still points at deprecated create2/store/batcher
 * wiring. Fork dry-runs deploy a fresh auxiliary batcher aligned to the canonical SPLIT batcher.
 */
export async function ensureVaultAuxiliaryDeployBatcherOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  batcher: Address
  rpcUrl: string
  configuredAuxiliaryBatcher?: Address
  ownerBalanceHex?: Hex
}): Promise<{
  alreadyAligned: boolean
  ensured: boolean
  configuredAuxiliaryBatcher: Address
  previousAuxiliaryBatcher: Address
  auxiliaryBatcher: Address
  create2Deployer: Address
  create2AlreadyAuthorized: boolean
  create2Ensured: boolean
}> {
  const batcher = getAddress(params.batcher)
  const configuredAuxiliaryBatcher = getAddress(
    params.configuredAuxiliaryBatcher ?? BASE_DEFAULTS.vaultAuxiliaryDeployBatcher,
  )
  const wiring = await readAuxiliaryBatcherWiring({
    publicClient: params.publicClient,
    batcher,
    configuredAuxiliaryBatcher,
  })

  if (wiring.aligned) {
    const auth = await ensureAuxiliaryBatcherCreate2AuthorizationOnFork({
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      waitForTransactionReceipt: params.waitForTransactionReceipt,
      forkRequest: params.forkRequest,
      forkMode: params.forkMode,
      create2Deployer: wiring.create2Deployer,
      auxiliaryBatcher: configuredAuxiliaryBatcher,
      ownerBalanceHex: params.ownerBalanceHex,
    })
    return {
      alreadyAligned: true,
      ensured: false,
      configuredAuxiliaryBatcher,
      previousAuxiliaryBatcher: configuredAuxiliaryBatcher,
      auxiliaryBatcher: configuredAuxiliaryBatcher,
      create2Deployer: wiring.create2Deployer,
      create2AlreadyAuthorized: auth.alreadyAuthorized,
      create2Ensured: auth.ensured,
    }
  }

  const protocolTreasury = resolveProtocolTreasuryAddress()
  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', params.ownerBalanceHex ?? '0x56bc75e2d63100000'],
  })

  const reusedAuxiliary = await findAlignedAuxiliaryBatcherFromForkDeploys({
    publicClient: params.publicClient,
    batcher,
  })
  const deployedAuxiliary =
    reusedAuxiliary ??
    deployVaultAuxiliaryDeployBatcherViaForge({
      rpcUrl: params.rpcUrl,
      create2Deployer: wiring.create2Deployer,
      bytecodeStore: wiring.bytecodeStore,
      deploymentBatcher: batcher,
      protocolTreasury,
      swapRouter: wiring.swapRouter,
    })

  const auth = await ensureAuxiliaryBatcherCreate2AuthorizationOnFork({
    publicClient: params.publicClient,
    walletClient: params.walletClient,
    waitForTransactionReceipt: params.waitForTransactionReceipt,
    forkRequest: params.forkRequest,
    forkMode: params.forkMode,
    create2Deployer: wiring.create2Deployer,
    auxiliaryBatcher: deployedAuxiliary,
    ownerBalanceHex: params.ownerBalanceHex,
  })

  const after = await readAuxiliaryBatcherWiring({
    publicClient: params.publicClient,
    batcher,
    configuredAuxiliaryBatcher: deployedAuxiliary,
  })
  if (!after.aligned) {
    throw new Error(
      `VaultAuxiliaryDeployBatcher on fork still misaligned after deploy ` +
        `(deployed=${deployedAuxiliary}).`,
    )
  }

  return {
    alreadyAligned: false,
    ensured: true,
    configuredAuxiliaryBatcher,
    previousAuxiliaryBatcher: configuredAuxiliaryBatcher,
    auxiliaryBatcher: deployedAuxiliary,
    create2Deployer: wiring.create2Deployer,
    create2AlreadyAuthorized: auth.alreadyAuthorized,
    create2Ensured: auth.ensured,
  }
}
