import { getAddress, type Address, type Hex } from 'viem'

import { CURRENT_DEPLOYMENT_BATCHER_SELECTORS } from './deploymentBatcherSelectors.js'
import { isShareOftSaltOverrideDisabledBatcher } from '@/config/contracts.defaults'
import { assertCreatorOvaultModuleStorageCompatible } from '@/lib/deploy/ovaultModuleIdentity'
import {
  classifyPhase1ModuleReadState,
  readPhase1ModuleState,
  resolveAlignedPhase1DeployDeps,
  resolveWiredCreatorOvaultModules,
} from '@/lib/deploy/phase1ModuleDeploy'

const BATCHER_PHASE1_WITH_SALT_SELECTOR = CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1WithSalt.slice(2)
const BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR = CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2)
const BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR = CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2)
const BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR = 'e7fdf838'
const BATCHER_INVALID_SHARE_OFT_SALT_OVERRIDE_ERROR_SELECTOR = 'aa12062d'

const BATCHER_VIEW_ABI = [
  {
    type: 'function',
    name: 'protocolTreasury',
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
    name: 'chainlinkEthUsd',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type CreatorVaultBatcherCapabilities = {
  saltOverridesDisabledByBatcher: boolean
  supportsLegacyPhase1WithSaltSelector: boolean
  supportsSplitPhase1WithSaltSelectors: boolean
  supportsPhase1WithSalt: boolean
}

export type CreatorVaultBatcherInfra = {
  create2Deployer: Address
  bytecodeStore: Address
  protocolTreasury: Address
  registry: Address
  chainlinkEthUsd: Address
  batcherBytecode: Hex | null
  capabilities: CreatorVaultBatcherCapabilities
}

type PublicClientLike = {
  getBytecode: (args: { address: Address }) => Promise<Hex | null | undefined>
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  multicall: (args: {
    contracts: Array<{
      address: Address
      abi: typeof BATCHER_VIEW_ABI
      functionName: 'protocolTreasury' | 'registry' | 'chainlinkEthUsd'
    }>
    allowFailure?: boolean
  }) => Promise<unknown[]>
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !value.startsWith('0x')) return null
  try {
    return getAddress(value)
  } catch {
    return null
  }
}

function readMulticallAddress(viewResults: unknown[] | null | undefined, index: number): Address | null {
  const entry = viewResults?.[index]
  if (!entry || typeof entry !== 'object') return null
  const status = (entry as { status?: unknown }).status
  if (status !== 'success') return null
  return normalizeAddress((entry as { result?: unknown }).result)
}

export function parseCreatorVaultBatcherCapabilities(params: {
  batcherAddress: string
  batcherBytecode: Hex | null | undefined
  phase1ModuleBytecode?: Hex | null
  phase1ModuleConfigured?: boolean
}): CreatorVaultBatcherCapabilities {
  const batcherBytecodeLower = (params.batcherBytecode ?? '0x').toLowerCase()
  const phase1ModuleBytecodeLower = (params.phase1ModuleBytecode ?? '0x').toLowerCase()
  const batcherAddressLower = String(params.batcherAddress ?? '').toLowerCase()
  const configuredPhase1ModuleBytecodeUnavailable =
    params.phase1ModuleConfigured === true &&
    (!params.phase1ModuleBytecode || params.phase1ModuleBytecode === '0x')
  const saltOverridesDisabledByBatcher =
    configuredPhase1ModuleBytecodeUnavailable ||
    isShareOftSaltOverrideDisabledBatcher(batcherAddressLower) ||
    batcherBytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR) ||
    phase1ModuleBytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR) ||
    phase1ModuleBytecodeLower.includes(BATCHER_INVALID_SHARE_OFT_SALT_OVERRIDE_ERROR_SELECTOR)
  const supportsLegacyPhase1WithSaltSelector =
    Boolean(params.batcherBytecode && params.batcherBytecode !== '0x') &&
    !saltOverridesDisabledByBatcher &&
    batcherBytecodeLower.includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
  const supportsSplitPhase1WithSaltSelectors =
    Boolean(params.batcherBytecode && params.batcherBytecode !== '0x') &&
    !saltOverridesDisabledByBatcher &&
    batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
    batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
  return {
    saltOverridesDisabledByBatcher,
    supportsLegacyPhase1WithSaltSelector,
    supportsSplitPhase1WithSaltSelectors,
    supportsPhase1WithSalt: supportsLegacyPhase1WithSaltSelector || supportsSplitPhase1WithSaltSelectors,
  }
}

export async function readCreatorVaultBatcherInfra(params: {
  publicClient: PublicClientLike
  batcherAddress: Address
  fallbacks: {
    create2Deployer: Address | null
    bytecodeStore: Address | null
    protocolTreasury: Address | null
    registry: Address | null
    chainlinkEthUsd: Address | null
  }
}): Promise<{ ok: true; infra: CreatorVaultBatcherInfra } | { ok: false; message: string }> {
  const [batcherBytecode, phase1ModuleReadState] = await Promise.all([
    params.publicClient.getBytecode({ address: params.batcherAddress }).catch(() => null),
    readPhase1ModuleState({
      publicClient:
        params.publicClient as unknown as Parameters<typeof readPhase1ModuleState>[0]['publicClient'],
      batcherAddress: params.batcherAddress,
    }),
  ])
  const phase1ModuleState = classifyPhase1ModuleReadState({
    readState: phase1ModuleReadState,
    batcherBytecode,
  })
  if (phase1ModuleState.status === 'read_failed') {
    return {
      ok: false,
      message: `Configured batcher at ${params.batcherAddress} advertises phase1Module(), but the module address read failed.`,
    }
  }
  const phase1ModuleAddress =
    phase1ModuleState.status === 'configured' ? phase1ModuleState.address : null
  const [alignedDeps, phase1ModuleBytecode, wiredModules] = await Promise.all([
    resolveAlignedPhase1DeployDeps({
      publicClient:
        params.publicClient as unknown as Parameters<typeof resolveAlignedPhase1DeployDeps>[0]['publicClient'],
      batcherAddress: params.batcherAddress,
      fallbacks: {
        create2Deployer: params.fallbacks.create2Deployer,
        bytecodeStore: params.fallbacks.bytecodeStore,
      },
      phase1ModuleState,
    }),
    phase1ModuleAddress
      ? params.publicClient.getBytecode({ address: phase1ModuleAddress }).catch(() => null)
      : Promise.resolve(null),
    phase1ModuleAddress
      ? resolveWiredCreatorOvaultModules({
          publicClient:
            params.publicClient as unknown as Parameters<typeof resolveWiredCreatorOvaultModules>[0]['publicClient'],
          batcherAddress: params.batcherAddress,
          phase1ModuleState,
        })
      : Promise.resolve(null),
  ])

  if (!alignedDeps.ok) {
    return { ok: false, message: alignedDeps.message }
  }
  if (phase1ModuleAddress && !wiredModules) {
    return {
      ok: false,
      message: `Configured Phase-1 module at ${phase1ModuleAddress} does not expose the expected vault module wiring.`,
    }
  }

  const viewResults = await params.publicClient
    .multicall({
      contracts: [
        { address: params.batcherAddress, abi: BATCHER_VIEW_ABI, functionName: 'protocolTreasury' },
        { address: params.batcherAddress, abi: BATCHER_VIEW_ABI, functionName: 'registry' },
        { address: params.batcherAddress, abi: BATCHER_VIEW_ABI, functionName: 'chainlinkEthUsd' },
      ],
      allowFailure: true,
    })
    .catch(() => null)

  const protocolTreasury =
    readMulticallAddress(viewResults, 0) ?? params.fallbacks.protocolTreasury
  const registry =
    readMulticallAddress(viewResults, 1) ?? params.fallbacks.registry
  const chainlinkEthUsd =
    readMulticallAddress(viewResults, 2) ?? params.fallbacks.chainlinkEthUsd

  if (!protocolTreasury) return { ok: false, message: 'Protocol treasury not available' }
  if (!registry) return { ok: false, message: 'Registry not available' }
  if (!chainlinkEthUsd) return { ok: false, message: 'Chainlink feed not available' }

  const bytecode = (batcherBytecode ?? null) as Hex | null
  const modulePreflight = await assertCreatorOvaultModuleStorageCompatible({
    publicClient:
      params.publicClient as unknown as Parameters<typeof assertCreatorOvaultModuleStorageCompatible>[0]['publicClient'],
    ...(wiredModules
      ? { moduleAddress: wiredModules.core }
      : { batcherAddress: params.batcherAddress }),
  })
  if (!modulePreflight.ok) {
    return { ok: false, message: modulePreflight.message }
  }

  return {
    ok: true,
    infra: {
      create2Deployer: alignedDeps.create2Deployer,
      bytecodeStore: alignedDeps.bytecodeStore,
      protocolTreasury,
      registry,
      chainlinkEthUsd,
      batcherBytecode: bytecode,
      capabilities: parseCreatorVaultBatcherCapabilities({
        batcherAddress: params.batcherAddress,
        batcherBytecode: bytecode,
        phase1ModuleBytecode: phase1ModuleBytecode as Hex | null,
        phase1ModuleConfigured: phase1ModuleAddress !== null,
      }),
    },
  }
}
