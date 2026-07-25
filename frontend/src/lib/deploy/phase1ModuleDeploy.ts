import { getAddress, isAddress, toFunctionSelector, type Address, type Hex } from 'viem'

export const PHASE1_MODULE_ON_BATCHER_ABI = [
  {
    type: 'function',
    name: 'phase1Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export const PHASE1_MODULE_ON_BATCHER_SELECTOR = toFunctionSelector('phase1Module()')

export type Phase1ModuleReadState =
  | { status: 'configured'; address: Address }
  | { status: 'not_configured' }
  | { status: 'unsupported' }
  | { status: 'read_failed' }

export const PHASE1_MODULE_DEPS_ABI = [
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
    name: 'vaultCoreModule',
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
] as const

type ReadClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export async function readPhase1ModuleState(params: {
  publicClient: ReadClient
  batcherAddress: Address
}): Promise<Phase1ModuleReadState> {
  try {
    const phase1Module = await params.publicClient.readContract({
      address: params.batcherAddress,
      abi: PHASE1_MODULE_ON_BATCHER_ABI,
      functionName: 'phase1Module',
    })
    if (!isAddress(String(phase1Module))) return { status: 'read_failed' }
    const resolved = getAddress(phase1Module as Address)
    return resolved === '0x0000000000000000000000000000000000000000'
      ? { status: 'not_configured' }
      : { status: 'configured', address: resolved }
  } catch {
    return { status: 'read_failed' }
  }
}

export function classifyPhase1ModuleReadState(params: {
  readState: Phase1ModuleReadState
  batcherBytecode: Hex | null | undefined
}): Phase1ModuleReadState {
  if (params.readState.status !== 'read_failed') return params.readState
  if (
    params.batcherBytecode &&
    params.batcherBytecode !== '0x' &&
    !params.batcherBytecode.toLowerCase().includes(PHASE1_MODULE_ON_BATCHER_SELECTOR.slice(2))
  ) {
    return { status: 'unsupported' }
  }
  return params.readState
}

export async function readPhase1ModuleAddress(params: {
  publicClient: ReadClient
  batcherAddress: Address
}): Promise<Address | null> {
  const state = await readPhase1ModuleState(params)
  return state.status === 'configured' ? state.address : null
}

async function readPhase1ModuleField(params: {
  publicClient: ReadClient
  phase1ModuleAddress: Address
  functionName: 'create2Deployer' | 'bytecodeStore' | 'vaultCoreModule' | 'vaultStrategiesModule' | 'vaultAdminModule'
}): Promise<Address | null> {
  try {
    const value = await params.publicClient.readContract({
      address: params.phase1ModuleAddress,
      abi: PHASE1_MODULE_DEPS_ABI,
      functionName: params.functionName,
    })
    if (!isAddress(String(value))) return null
    const resolved = getAddress(value as Address)
    return resolved === '0x0000000000000000000000000000000000000000' ? null : resolved
  } catch {
    return null
  }
}

async function readBatcherShellField(params: {
  publicClient: ReadClient
  batcherAddress: Address
  functionName: 'create2Deployer' | 'bytecodeStore' | 'vaultCoreModule' | 'vaultStrategiesModule' | 'vaultAdminModule'
}): Promise<Address | null> {
  try {
    const value = await params.publicClient.readContract({
      address: params.batcherAddress,
      abi: PHASE1_MODULE_DEPS_ABI,
      functionName: params.functionName,
    })
    if (!isAddress(String(value))) return null
    const resolved = getAddress(value as Address)
    return resolved === '0x0000000000000000000000000000000000000000' ? null : resolved
  } catch {
    return null
  }
}

/** Phase-1 delegatecall uses DeploymentBatcherPhase1Module immutables, not batcher shell getters. */
export async function resolvePhase1ModuleDeployField(params: {
  publicClient: ReadClient
  batcherAddress: Address
  functionName: 'create2Deployer' | 'bytecodeStore' | 'vaultCoreModule' | 'vaultStrategiesModule' | 'vaultAdminModule'
  phase1ModuleState?: Phase1ModuleReadState
}): Promise<Address | null> {
  if (params.phase1ModuleState?.status === 'read_failed') return null
  const phase1ModuleAddress = params.phase1ModuleState
    ? params.phase1ModuleState.status === 'configured'
      ? params.phase1ModuleState.address
      : null
    : await readPhase1ModuleAddress(params)
  if (phase1ModuleAddress) {
    const fromPhase1 = await readPhase1ModuleField({
      publicClient: params.publicClient,
      phase1ModuleAddress,
      functionName: params.functionName,
    })
    // If a Phase1Module is configured, it is the source of truth for Phase-1 deploy immutables.
    // Fallback to shell getters here can silently reintroduce stale CREATE2/store/module wiring.
    if (fromPhase1) return fromPhase1
    return null
  }
  return readBatcherShellField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: params.functionName,
  })
}

const CREATE2_DEPLOYER_STORE_ABI = [
  {
    type: 'function',
    name: 'store',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type Phase1DeployDeps =
  | { ok: true; create2Deployer: Address; bytecodeStore: Address }
  | { ok: false; message: string; create2Deployer?: Address; bytecodeStore?: Address; deployerStore?: Address }

async function readCreate2DeployerStore(params: {
  publicClient: ReadClient
  create2Deployer: Address
}): Promise<Address | null> {
  try {
    const store = await params.publicClient.readContract({
      address: params.create2Deployer,
      abi: CREATE2_DEPLOYER_STORE_ABI,
      functionName: 'store',
    })
    if (!isAddress(String(store))) return null
    return getAddress(store as Address)
  } catch {
    return null
  }
}

/** Phase-1 CREATE2 deploy reads bytecode from create2Deployer.store(), not the batcher bytecodeStore getter alone. */
export async function resolveAlignedPhase1DeployDeps(params: {
  publicClient: ReadClient
  batcherAddress: Address
  fallbacks?: { create2Deployer?: Address | null; bytecodeStore?: Address | null }
  phase1ModuleState?: Phase1ModuleReadState
}): Promise<Phase1DeployDeps> {
  const bytecodeStore =
    (await resolveBytecodeStoreForBatcher({
      publicClient: params.publicClient,
      batcherAddress: params.batcherAddress,
      fallback: params.fallbacks?.bytecodeStore ?? null,
      phase1ModuleState: params.phase1ModuleState,
    })) ?? null
  const create2Deployer =
    (await resolveCreate2DeployerForBatcher({
      publicClient: params.publicClient,
      batcherAddress: params.batcherAddress,
      fallback: params.fallbacks?.create2Deployer ?? null,
      phase1ModuleState: params.phase1ModuleState,
    })) ?? null

  if (!bytecodeStore || !create2Deployer) {
    return {
      ok: false,
      message:
        `Configured batcher at ${params.batcherAddress} does not expose expected phased deploy interface ` +
        '(bytecodeStore/create2Deployer). Update VITE_DEPLOYMENT_BATCHER / DEPLOYMENT_BATCHER.',
    }
  }

  const deployerStore = await readCreate2DeployerStore({
    publicClient: params.publicClient,
    create2Deployer,
  })
  if (!deployerStore) {
    return {
      ok: false,
      message: `Configured create2 deployer at ${create2Deployer} does not expose expected store() interface.`,
      create2Deployer,
      bytecodeStore,
    }
  }

  if (deployerStore.toLowerCase() === bytecodeStore.toLowerCase()) {
    return { ok: true, create2Deployer, bytecodeStore }
  }

  const shellCreate2 = await readBatcherShellField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: 'create2Deployer',
  })
  const shellStore = shellCreate2
    ? await readCreate2DeployerStore({ publicClient: params.publicClient, create2Deployer: shellCreate2 })
    : null
  const shellAligned =
    shellCreate2 &&
    shellStore &&
    shellStore.toLowerCase() === bytecodeStore.toLowerCase()

  return {
    ok: false,
    message:
      `Phase1Module create2 deployer is not paired with its bytecode store: ` +
      `bytecodeStore=${bytecodeStore} but create2Deployer(${create2Deployer}).store=${deployerStore}. ` +
      (shellAligned
        ? `The batcher shell create2 deployer ${shellCreate2} is store-aligned — redeploy Phase1Module with that deployer ` +
          'via script/RotateLiveBatcherPhase1ModulesV121.s.sol (UNIVERSAL_CREATE2_DEPLOYER=shell value) and execute setPhase1Module on the Safe.'
        : 'Rotate Phase1Module wiring so create2Deployer.store() matches bytecodeStore before retrying deploy.'),
    create2Deployer,
    bytecodeStore,
    deployerStore,
  }
}

export async function resolveCreate2DeployerForBatcher(params: {
  publicClient: ReadClient
  batcherAddress: Address
  fallback?: Address | null
  phase1ModuleState?: Phase1ModuleReadState
}): Promise<Address | null> {
  const resolved = await resolvePhase1ModuleDeployField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: 'create2Deployer',
    phase1ModuleState: params.phase1ModuleState,
  })
  if (resolved) return resolved
  if (
    params.phase1ModuleState?.status === 'configured' ||
    params.phase1ModuleState?.status === 'read_failed'
  ) {
    return null
  }
  if (params.fallback && isAddress(params.fallback)) return getAddress(params.fallback)
  return null
}

export async function resolveBytecodeStoreForBatcher(params: {
  publicClient: ReadClient
  batcherAddress: Address
  fallback?: Address | null
  phase1ModuleState?: Phase1ModuleReadState
}): Promise<Address | null> {
  const resolved = await resolvePhase1ModuleDeployField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: 'bytecodeStore',
    phase1ModuleState: params.phase1ModuleState,
  })
  if (resolved) return resolved
  if (
    params.phase1ModuleState?.status === 'configured' ||
    params.phase1ModuleState?.status === 'read_failed'
  ) {
    return null
  }
  if (params.fallback && isAddress(params.fallback)) return getAddress(params.fallback)
  return null
}

export async function resolveWiredCreatorOvaultModules(params: {
  publicClient: ReadClient
  batcherAddress: Address
  phase1ModuleState?: Phase1ModuleReadState
}): Promise<{ core: Address; strategies: Address; admin: Address } | null> {
  const [core, strategies, admin] = await Promise.all([
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultCoreModule' }),
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultStrategiesModule' }),
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultAdminModule' }),
  ])
  if (!core || !strategies || !admin) return null
  return { core, strategies, admin }
}

const AGENT_VAULT_CORE_MODULE_ABI = [
  {
    type: 'function',
    name: 'agentVaultCoreModule',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export async function resolveAgentVaultCoreModule(params: {
  publicClient: ReadClient
  batcherAddress: Address
}): Promise<Address | null> {
  try {
    const value = await params.publicClient.readContract({
      address: params.batcherAddress,
      abi: AGENT_VAULT_CORE_MODULE_ABI,
      functionName: 'agentVaultCoreModule',
    })
    if (!isAddress(String(value))) return null
    const resolved = getAddress(value as Address)
    return resolved === '0x0000000000000000000000000000000000000000' ? null : resolved
  } catch {
    return null
  }
}
