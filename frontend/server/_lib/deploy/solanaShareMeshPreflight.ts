import { getAddress, isAddress, type Address, type Hex, type PublicClient } from 'viem'

import { assertShareBridgeOftWiringForFinalize } from '../../../src/lib/deploy/shareBridgeOftWiring.js'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address

const CREATOR_VAULT_BATCHER_OVAULT_RUNTIME_VIEW_ABI = [
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
] as const

export type OvaultMeshPreflightResult = {
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  assetPeerSet: boolean
  sharePeerSet: boolean
  meshStep: 'ovault_mesh_confirmed'
}

export const DEFAULT_OVAULT_MESH_PREFLIGHT_RESULT: OvaultMeshPreflightResult = {
  existingMintCompatible: true,
  depositEligible: true,
  redeemEligible: true,
  assetPeerSet: true,
  sharePeerSet: true,
  meshStep: 'ovault_mesh_confirmed',
}

export function isLegacySolanaBridgePreflightEnabled(): boolean {
  const raw = String(process.env.DEPLOY_SOLANA_LEGACY_BRIDGE_PREFLIGHT ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isOvaultRequestEnabled(solanaOvault: unknown): boolean {
  if (!isPlainObject(solanaOvault)) return false
  return solanaOvault.enabled === true
}

function isOvaultRuntimeConfigured(runtime: unknown): boolean {
  const obj = isPlainObject(runtime) ? runtime : null
  const tuple = Array.isArray(runtime) ? runtime : null
  const hubComposer =
    typeof obj?.hubComposer === 'string'
      ? obj.hubComposer
      : tuple && typeof tuple[0] === 'string'
        ? tuple[0]
        : ''
  const solanaEid =
    typeof obj?.solanaEid === 'number'
      ? obj.solanaEid
      : tuple && typeof tuple[1] === 'number'
        ? tuple[1]
        : tuple && typeof tuple[1] === 'bigint'
          ? Number(tuple[1])
          : 0
  const enabled =
    typeof obj?.enabled === 'boolean'
      ? obj.enabled
      : tuple && typeof tuple[2] === 'boolean'
        ? tuple[2]
        : false
  return (
    enabled === true &&
    typeof hubComposer === 'string' &&
    isAddress(hubComposer) &&
    getAddress(hubComposer as Address).toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    Number(solanaEid) > 0
  )
}

async function assertOvaultRuntimeReady(params: {
  publicClient: Pick<PublicClient, 'readContract'>
  batcherAddress: Address
}): Promise<void> {
  const runtime = await params.publicClient
    .readContract({
      address: params.batcherAddress,
      abi: CREATOR_VAULT_BATCHER_OVAULT_RUNTIME_VIEW_ABI,
      functionName: 'getOVaultRuntimeConfig',
    })
    .catch(() => null)
  if (!isOvaultRuntimeConfigured(runtime)) {
    throw new Error(
      `Solana preflight failed: OVault runtime config is not enabled on deployment batcher ${params.batcherAddress}. ` +
        'Wire Pipe A platform readiness (setSolanaShareOftPeer) per docs/operations/solana-share-mesh-budget-paths.md.',
    )
  }
}

export async function ensureShareMeshOvaultPreflight(params: {
  publicClient: Pick<PublicClient, 'readContract'>
  finalizeCall: { to: Address; data: Hex }
  ovaultRequested: boolean
}): Promise<OvaultMeshPreflightResult> {
  if (!params.ovaultRequested) return DEFAULT_OVAULT_MESH_PREFLIGHT_RESULT
  const batcherAddress = getAddress(params.finalizeCall.to)
  await assertOvaultRuntimeReady({ publicClient: params.publicClient, batcherAddress })
  await assertShareBridgeOftWiringForFinalize({
    publicClient: params.publicClient,
    batcherAddress,
    finalizeCallData: params.finalizeCall.data,
  })
  return DEFAULT_OVAULT_MESH_PREFLIGHT_RESULT
}
