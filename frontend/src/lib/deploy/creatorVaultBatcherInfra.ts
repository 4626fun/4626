import { getAddress, type Address, type Hex } from 'viem'

import { isShareOftSaltOverrideDisabledBatcher } from '@/config/contracts.defaults'
import { assertCreatorOvaultModuleStorageCompatible } from '@/lib/deploy/ovaultModuleIdentity'
import { resolveAlignedPhase1DeployDeps } from '@/lib/deploy/phase1ModuleDeploy'

const BATCHER_PHASE1_WITH_SALT_SELECTOR = '297cb1e6'
const BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR = '4154f24e'
const BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR = '3bc09a8b'
const BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR = 'e7fdf838'

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
}): CreatorVaultBatcherCapabilities {
  const batcherBytecodeLower = (params.batcherBytecode ?? '0x').toLowerCase()
  const batcherAddressLower = String(params.batcherAddress ?? '').toLowerCase()
  const saltOverridesDisabledByBatcher =
    isShareOftSaltOverrideDisabledBatcher(batcherAddressLower) ||
    batcherBytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR)
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
  const [alignedDeps, batcherBytecode] = await Promise.all([
    resolveAlignedPhase1DeployDeps({
      publicClient:
        params.publicClient as unknown as Parameters<typeof resolveAlignedPhase1DeployDeps>[0]['publicClient'],
      batcherAddress: params.batcherAddress,
      fallbacks: {
        create2Deployer: params.fallbacks.create2Deployer,
        bytecodeStore: params.fallbacks.bytecodeStore,
      },
    }),
    params.publicClient.getBytecode({ address: params.batcherAddress }).catch(() => null),
  ])

  if (!alignedDeps.ok) {
    return { ok: false, message: alignedDeps.message }
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
    batcherAddress: params.batcherAddress,
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
      }),
    },
  }
}