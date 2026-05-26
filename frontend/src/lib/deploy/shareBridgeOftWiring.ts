import { getAddress, isAddress, type Address, type Hex, type PublicClient } from 'viem'

import { BASE_DEFAULTS } from '@/config/contracts.defaults'

import {
  decodeFinalizePhase2Call,
  quoteFinalizeShareBridgeNativeFee,
  type FinalizeShareBridgeQuoteError,
} from './finalizeShareBridgeFee'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex

const CREATOR_REGISTRY_REMOTE_PEER_ABI = [
  {
    type: 'function',
    name: 'getRemoteOFTPeerBytes32',
    stateMutability: 'view',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_chainEid', type: 'uint32' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const SHARE_OFT_PEER_ABI = [
  {
    type: 'function',
    name: 'peers',
    stateMutability: 'view',
    inputs: [{ name: 'eid', type: 'uint32' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const

export type ShareBridgeOftWiringStatus = {
  bridgeRequired: boolean
  solanaEid: number
  destination: Hex
  registryPeer: Hex | null
  batcherDefaultPeer: Hex | null
  effectivePeer: Hex | null
  shareOftPeer: Hex | null
  registryPeerConfigured: boolean
  shareOftPeerConfigured: boolean
}

export class ShareBridgeOftWiringError extends Error {
  readonly code:
    | 'finalize_decode_failed'
    | 'bridge_not_configured'
    | 'oft_peer_not_configured'
    | 'share_oft_peer_mismatch'
    | 'quote_failed'

  constructor(
    code: ShareBridgeOftWiringError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'ShareBridgeOftWiringError'
    this.code = code
  }
}

function normalizeBytes32(value: unknown): Hex | null {
  if (typeof value !== 'string' || !value.startsWith('0x') || value.length !== 66) return null
  return value.toLowerCase() === ZERO_BYTES32.toLowerCase() ? null : (value as Hex)
}

export async function readShareBridgeOftWiringStatus(params: {
  publicClient: Pick<PublicClient, 'readContract'>
  batcherAddress: Address
  finalizeCallData: Hex
  registryAddress?: Address
}): Promise<ShareBridgeOftWiringStatus | FinalizeShareBridgeQuoteError> {
  const quote = await quoteFinalizeShareBridgeNativeFee({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    finalizeCallData: params.finalizeCallData,
    registryAddress: params.registryAddress,
  })
  if ('code' in quote) {
    return quote
  }

  const decoded = decodeFinalizePhase2Call(params.finalizeCallData)
  const registryAddress = params.registryAddress ?? getAddress(BASE_DEFAULTS.registry as Address)
  let registryPeer: Hex | null = null
  let batcherDefaultPeer: Hex | null = null
  let shareOftPeer: Hex | null = null

  if (quote.required && decoded) {
    const [registryPeerRaw, batcherDefaultPeerRaw] = await Promise.all([
      params.publicClient.readContract({
        address: registryAddress,
        abi: CREATOR_REGISTRY_REMOTE_PEER_ABI,
        functionName: 'getRemoteOFTPeerBytes32',
        args: [decoded.params.creatorToken, quote.dstEid],
      }),
      params.publicClient.readContract({
        address: params.batcherAddress,
        abi: [
          {
            type: 'function',
            name: 'solanaShareOftPeer',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'bytes32' }],
          },
        ] as const,
        functionName: 'solanaShareOftPeer',
      }),
    ])
    registryPeer = normalizeBytes32(registryPeerRaw)
    batcherDefaultPeer = normalizeBytes32(batcherDefaultPeerRaw)

    try {
      shareOftPeer = normalizeBytes32(
        await params.publicClient.readContract({
          address: decoded.params.shareOFT,
          abi: SHARE_OFT_PEER_ABI,
          functionName: 'peers',
          args: [quote.dstEid],
        }),
      )
    } catch {
      shareOftPeer = null
    }
  }

  const effectivePeer = registryPeer ?? batcherDefaultPeer

  return {
    bridgeRequired: quote.required,
    solanaEid: quote.dstEid,
    destination: quote.destination,
    registryPeer,
    batcherDefaultPeer,
    effectivePeer,
    shareOftPeer,
    registryPeerConfigured: effectivePeer !== null,
    shareOftPeerConfigured:
      effectivePeer !== null &&
      (shareOftPeer === null || shareOftPeer.toLowerCase() === effectivePeer.toLowerCase()),
  }
}

export async function assertShareBridgeOftWiringForFinalize(params: {
  publicClient: Pick<PublicClient, 'readContract'>
  batcherAddress: Address
  finalizeCallData: Hex
  registryAddress?: Address
}): Promise<void> {
  if (!isAddress(params.batcherAddress)) {
    throw new ShareBridgeOftWiringError('bridge_not_configured', 'Deployment batcher address is invalid.')
  }

  const status = await readShareBridgeOftWiringStatus(params)
  if ('code' in status) {
    if (status.code === 'oft_peer_not_configured') {
      throw new ShareBridgeOftWiringError(
        status.code,
        status.message,
      )
    }
    if (status.code === 'finalize_decode_failed') {
      throw new ShareBridgeOftWiringError(status.code, status.message)
    }
    if (status.code === 'quote_failed') {
      throw new ShareBridgeOftWiringError(status.code, status.message)
    }
    return
  }

  if (!status.bridgeRequired) return
}
