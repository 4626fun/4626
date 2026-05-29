import { getAddress, isAddress, type Address } from 'viem'

export const PHASE1_MODULE_ON_BATCHER_ABI = [
  {
    type: 'function',
    name: 'phase1Module',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

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

export async function readPhase1ModuleAddress(params: {
  publicClient: ReadClient
  batcherAddress: Address
}): Promise<Address | null> {
  try {
    const phase1Module = await params.publicClient.readContract({
      address: params.batcherAddress,
      abi: PHASE1_MODULE_ON_BATCHER_ABI,
      functionName: 'phase1Module',
    })
    if (!isAddress(String(phase1Module))) return null
    const resolved = getAddress(phase1Module as Address)
    return resolved === '0x0000000000000000000000000000000000000000' ? null : resolved
  } catch {
    return null
  }
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
}): Promise<Address | null> {
  const phase1ModuleAddress = await readPhase1ModuleAddress(params)
  if (phase1ModuleAddress) {
    const fromPhase1 = await readPhase1ModuleField({
      publicClient: params.publicClient,
      phase1ModuleAddress,
      functionName: params.functionName,
    })
    if (fromPhase1) return fromPhase1
  }
  return readBatcherShellField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: params.functionName,
  })
}

export async function resolveCreate2DeployerForBatcher(params: {
  publicClient: ReadClient
  batcherAddress: Address
  fallback?: Address | null
}): Promise<Address | null> {
  const resolved = await resolvePhase1ModuleDeployField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: 'create2Deployer',
  })
  if (resolved) return resolved
  if (params.fallback && isAddress(params.fallback)) return getAddress(params.fallback)
  return null
}

export async function resolveBytecodeStoreForBatcher(params: {
  publicClient: ReadClient
  batcherAddress: Address
  fallback?: Address | null
}): Promise<Address | null> {
  const resolved = await resolvePhase1ModuleDeployField({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    functionName: 'bytecodeStore',
  })
  if (resolved) return resolved
  if (params.fallback && isAddress(params.fallback)) return getAddress(params.fallback)
  return null
}

export async function resolveWiredCreatorOvaultModules(params: {
  publicClient: ReadClient
  batcherAddress: Address
}): Promise<{ core: Address; strategies: Address; admin: Address } | null> {
  const [core, strategies, admin] = await Promise.all([
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultCoreModule' }),
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultStrategiesModule' }),
    resolvePhase1ModuleDeployField({ ...params, functionName: 'vaultAdminModule' }),
  ])
  if (!core || !strategies || !admin) return null
  return { core, strategies, admin }
}
