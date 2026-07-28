import { decodeAbiParameters, getAddress, type Address, type Hex } from 'viem'

import type { ShareBridgeReadClient } from './shareBridgeReadClient'
import {
  SHARE_MESH_SOLANA_EID,
  assessBaseShareMeshUlnForPipeA,
  normalizeBaseUlnSlice,
  type PathwayGateCheck,
  type UlnConfirmationsSlice,
} from './shareMeshLzPathwayPolicy.js'

/** LayerZero EndpointV2 on Base mainnet. */
export const BASE_LZ_ENDPOINT_V2 = getAddress('0x1a44076050125825900e736c501f859c50fE728c')
const ULN_CONFIG_TYPE = 2

const ULN_CONFIG_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'confirmations', type: 'uint64' },
      { name: 'requiredDvnCount', type: 'uint8' },
      { name: 'optionalDvnCount', type: 'uint8' },
      { name: 'optionalDvnThreshold', type: 'uint8' },
      { name: 'requiredDvns', type: 'address[]' },
      { name: 'optionalDvns', type: 'address[]' },
    ],
  },
] as const

const ENDPOINT_ABI = [
  {
    type: 'function',
    name: 'getSendLibrary',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'dstEid', type: 'uint32' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getReceiveLibrary',
    stateMutability: 'view',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'srcEid', type: 'uint32' },
    ],
    outputs: [
      { type: 'address' },
      { type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getConfig',
    stateMutability: 'view',
    inputs: [
      { name: 'oapp', type: 'address' },
      { name: 'lib', type: 'address' },
      { name: 'eid', type: 'uint32' },
      { name: 'configType', type: 'uint32' },
    ],
    outputs: [{ type: 'bytes' }],
  },
] as const

const SHARE_OFT_ABI = [
  {
    type: 'function',
    name: 'enforcedOptions',
    stateMutability: 'view',
    inputs: [
      { name: 'eid', type: 'uint32' },
      { name: 'msgType', type: 'uint16' },
    ],
    outputs: [{ type: 'bytes' }],
  },
] as const

function decodeUln(encoded: Hex): UlnConfirmationsSlice {
  const [decoded] = decodeAbiParameters(ULN_CONFIG_ABI, encoded)
  return normalizeBaseUlnSlice({
    confirmations: decoded.confirmations,
    requiredDvnCount: decoded.requiredDvnCount,
    optionalDvnCount: decoded.optionalDvnCount,
    optionalDvnThreshold: decoded.optionalDvnThreshold,
  })
}

export type BaseShareMeshUlnGateResult = {
  ok: boolean
  checks: PathwayGateCheck[]
  baseSend: UlnConfirmationsSlice
  baseReceive: UlnConfirmationsSlice
  enforcedOptions: Hex
}

export async function readAndAssessBaseShareMeshUln(params: {
  publicClient: ShareBridgeReadClient
  shareOft: Address
  solanaEid?: number
  endpoint?: Address
}): Promise<BaseShareMeshUlnGateResult> {
  const shareOft = getAddress(params.shareOft)
  const solanaEid = params.solanaEid ?? SHARE_MESH_SOLANA_EID
  const endpoint = params.endpoint ?? BASE_LZ_ENDPOINT_V2

  const sendLib = (await params.publicClient.readContract({
    address: endpoint,
    abi: ENDPOINT_ABI,
    functionName: 'getSendLibrary',
    args: [shareOft, solanaEid],
  })) as Address

  const receiveLibResult = (await params.publicClient.readContract({
    address: endpoint,
    abi: ENDPOINT_ABI,
    functionName: 'getReceiveLibrary',
    args: [shareOft, solanaEid],
  })) as readonly [Address, boolean]
  const receiveLib = receiveLibResult[0]

  const [baseSendRaw, baseReceiveRaw, enforcedOptions] = await Promise.all([
    params.publicClient.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [shareOft, sendLib, solanaEid, ULN_CONFIG_TYPE],
    }) as Promise<Hex>,
    params.publicClient.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [shareOft, receiveLib, solanaEid, ULN_CONFIG_TYPE],
    }) as Promise<Hex>,
    params.publicClient.readContract({
      address: shareOft,
      abi: SHARE_OFT_ABI,
      functionName: 'enforcedOptions',
      args: [solanaEid, 1],
    }) as Promise<Hex>,
  ])

  const baseSend = decodeUln(baseSendRaw)
  const baseReceive = decodeUln(baseReceiveRaw)
  const assessed = assessBaseShareMeshUlnForPipeA({
    baseSend,
    baseReceive,
    enforcedOptionsHex: enforcedOptions,
  })

  return {
    ok: assessed.ok,
    checks: assessed.checks,
    baseSend,
    baseReceive,
    enforcedOptions,
  }
}

export function formatBaseShareMeshUlnGateFailure(result: BaseShareMeshUlnGateResult): string {
  const failed = result.checks.filter((c) => !c.ok).map((c) => `${c.id} (${c.detail})`)
  return (
    'Share-mesh LayerZero ULN gate failed for Pipe A. ' +
    'Base ShareOFT outbound confirmations / DVNs / enforced options must match template [15, 32] + 3-of-5. ' +
    `Failed: ${failed.join('; ')}. ` +
    'Wire via layerzero-share-mesh.config.ts then pnpm -C frontend ops:verify-share-mesh-lz.'
  )
}
