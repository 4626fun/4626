import {
  concatHex,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  isAddress,
  keccak256,
  padHex,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'

import { DEPLOY_BYTECODE } from '../../deploy/bytecode.generated.js'
import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '@/config/contracts.defaults'
import { ROBINHOOD_REMOTE_SHARE_OFT } from '../../config/remoteShareOftChains.js'
import type { ShareBridgeReadClient } from './shareBridgeReadClient.js'
import {
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
} from './perVaultVanityVersionSearch.js'

export const BASE_HUB_EID = ROBINHOOD_REMOTE_SHARE_OFT.hubEid
export const ROBINHOOD_EID = ROBINHOOD_REMOTE_SHARE_OFT.eid
export const ROBINHOOD_CHAIN_ID = ROBINHOOD_REMOTE_SHARE_OFT.chainId
export const ROBINHOOD_LZ_ENDPOINT = getAddress(ROBINHOOD_REMOTE_SHARE_OFT.lzEndpoint)

/** Hub phase-1 ShareOFT constructor owner — must match Base batcher for CREATE2 parity. */
export const HUB_SHARE_OFT_CONSTRUCTOR_OWNER = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)

const OFT_BOOTSTRAP_SALT = keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))

export type PredictRemoteShareOftAddressParams = {
  create2Deployer: Address
  shareName: string
  shareSymbol: string
  oftBootstrapRegistry: Address
  /** Lane token — salt-scoped (AUDIT-2026-07-08-C01). */
  creatorToken: Address
  /** Creator CSW — used for shareOftSalt derivation. */
  owner: Address
  deploymentVersion: string
  shareOftSaltOverride?: Hex | null
  /** Defaults to hub batcher address for cross-chain parity. */
  constructorOwner?: Address
}

/** Predict ShareOFT CREATE2 address using the same inputs as hub phase-1 finalize. */
export function predictRemoteShareOftAddress(params: PredictRemoteShareOftAddressParams): Address {
  const shareSymbolUpper = params.shareSymbol.toUpperCase()
  const shareSymbolLower = params.shareSymbol.toLowerCase()
  const constructorOwner = params.constructorOwner ?? HUB_SHARE_OFT_CONSTRUCTOR_OWNER
  const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
    params.shareName,
    shareSymbolUpper,
    params.oftBootstrapRegistry,
    constructorOwner,
  ])
  const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
  const derivedSalt = deriveShareOftSaltFromVersion({
    creatorToken: params.creatorToken,
    owner: params.owner,
    shareSymbol: shareSymbolLower,
    version: params.deploymentVersion,
  })
  const shareOftSalt = params.shareOftSaltOverride ?? derivedSalt
  return predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: shareOftSalt,
    initCode: shareOftInitCode,
  })
}

/** Predict OFTBootstrapRegistry address at the hub v1 salt (empty constructor args). */
export function predictOftBootstrapRegistryAddress(create2Deployer: Address): Address {
  return predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: OFT_BOOTSTRAP_SALT,
    initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
  })
}

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const QUOTE_AMOUNT_LD = 1_000_000_000_000_000_000n

const REGISTRY_4626_ABI = [
  {
    type: 'function',
    name: 'getEidForChainId',
    stateMutability: 'view',
    inputs: [{ name: '_chainId', type: 'uint256' }],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'getLayerZeroEndpoint',
    stateMutability: 'view',
    inputs: [{ name: '_chainId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getRemoteOFTPeer',
    stateMutability: 'view',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_chainEid', type: 'uint32' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

const SHARE_OFT_REMOTE_ABI = [
  {
    type: 'function',
    name: 'chainEid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'isHub',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hubEid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'hubGaugeReceiver',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'peers',
    stateMutability: 'view',
    inputs: [{ name: 'eid', type: 'uint32' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'quoteSend',
    stateMutability: 'view',
    inputs: [
      {
        name: '_sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
      { name: '_payInLzToken', type: 'bool' },
    ],
    outputs: [
      {
        name: 'fee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
    ],
  },
] as const

export type RobinhoodMeshCheck = {
  id: string
  ok: boolean
  detail: string
}

export type RobinhoodShareMeshWiringStatus = {
  ready: boolean
  checks: RobinhoodMeshCheck[]
  baseToRobinhoodQuoteWei: bigint | null
  robinhoodToBaseQuoteWei: bigint | null
}

function addressToBytes32(address: Address): Hex {
  return padHex(address as Hex, { size: 32 })
}

function normalizeBytes32(value: unknown): Hex | null {
  if (typeof value !== 'string' || !value.startsWith('0x') || value.length !== 66) return null
  return value.toLowerCase() === ZERO_BYTES32.toLowerCase() ? null : (value as Hex)
}

function peerMatchesAddress(peer: Hex | null, address: Address): boolean {
  if (!peer) return false
  return peer.toLowerCase() === addressToBytes32(address).toLowerCase()
}

async function quoteBridgeFee(params: {
  publicClient: ShareBridgeReadClient
  shareOft: Address
  dstEid: number
  recipient: Address
}): Promise<bigint | null> {
  try {
    const fee = (await params.publicClient.readContract({
      address: params.shareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'quoteSend',
      args: [
        {
          dstEid: params.dstEid,
          to: addressToBytes32(params.recipient),
          amountLD: QUOTE_AMOUNT_LD,
          minAmountLD: QUOTE_AMOUNT_LD,
          extraOptions: '0x' as Hex,
          composeMsg: '0x' as Hex,
          oftCmd: '0x' as Hex,
        },
        false,
      ],
    })) as { nativeFee: bigint; lzTokenFee: bigint }
    return fee.nativeFee > 0n ? fee.nativeFee : null
  } catch {
    return null
  }
}

export async function readRobinhoodShareMeshWiringStatus(params: {
  baseClient: ShareBridgeReadClient
  robinhoodClient: ShareBridgeReadClient & { getChainId?: () => Promise<bigint> }
  registryAddress: Address
  creatorToken: Address
  baseShareOft: Address
  robinhoodShareOft: Address
  hubGaugeReceiver?: Address
  robinhoodChainId?: bigint
}): Promise<RobinhoodShareMeshWiringStatus> {
  const checks: RobinhoodMeshCheck[] = []

  const robinhoodChainId =
    params.robinhoodChainId ??
    (params.robinhoodClient.getChainId ? await params.robinhoodClient.getChainId() : 0n)
  checks.push({
    id: 'robinhood_chain_id',
    ok: robinhoodChainId === BigInt(ROBINHOOD_CHAIN_ID),
    detail: `chainId=${robinhoodChainId}`,
  })

  checks.push({
    id: 'share_oft_address_parity',
    ok: getAddress(params.baseShareOft) === getAddress(params.robinhoodShareOft),
    detail: `base=${params.baseShareOft} robinhood=${params.robinhoodShareOft}`,
  })

  const [registryEid, registryEndpoint, registryPeer] = await Promise.all([
    params.baseClient.readContract({
      address: params.registryAddress,
      abi: REGISTRY_4626_ABI,
      functionName: 'getEidForChainId',
      args: [BigInt(ROBINHOOD_CHAIN_ID)],
    }) as Promise<number>,
    params.baseClient.readContract({
      address: params.registryAddress,
      abi: REGISTRY_4626_ABI,
      functionName: 'getLayerZeroEndpoint',
      args: [BigInt(ROBINHOOD_CHAIN_ID)],
    }) as Promise<Address>,
    params.baseClient.readContract({
      address: params.registryAddress,
      abi: REGISTRY_4626_ABI,
      functionName: 'getRemoteOFTPeer',
      args: [params.creatorToken, ROBINHOOD_EID],
    }) as Promise<Address>,
  ])

  checks.push({
    id: 'registry_eid',
    ok: registryEid === ROBINHOOD_EID,
    detail: `eid=${registryEid}`,
  })
  checks.push({
    id: 'registry_endpoint',
    ok: getAddress(registryEndpoint) === ROBINHOOD_LZ_ENDPOINT,
    detail: registryEndpoint,
  })
  checks.push({
    id: 'registry_remote_peer',
    ok: isAddress(registryPeer) && getAddress(registryPeer) === getAddress(params.robinhoodShareOft),
    detail: registryPeer,
  })

  const [
    robinhoodChainEid,
    robinhoodIsHub,
    robinhoodHubEid,
    robinhoodHubGauge,
    robinhoodHubPeer,
    baseRobinhoodPeer,
  ] = await Promise.all([
    params.robinhoodClient.readContract({
      address: params.robinhoodShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'chainEid',
    }) as Promise<number>,
    params.robinhoodClient.readContract({
      address: params.robinhoodShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'isHub',
    }) as Promise<boolean>,
    params.robinhoodClient.readContract({
      address: params.robinhoodShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'hubEid',
    }) as Promise<number>,
    params.robinhoodClient.readContract({
      address: params.robinhoodShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'hubGaugeReceiver',
    }) as Promise<Address>,
    params.robinhoodClient.readContract({
      address: params.robinhoodShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'peers',
      args: [BASE_HUB_EID],
    }) as Promise<Hex>,
    params.baseClient.readContract({
      address: params.baseShareOft,
      abi: SHARE_OFT_REMOTE_ABI,
      functionName: 'peers',
      args: [ROBINHOOD_EID],
    }) as Promise<Hex>,
  ])

  checks.push({
    id: 'remote_chain_eid',
    ok: robinhoodChainEid === ROBINHOOD_EID,
    detail: `chainEid=${robinhoodChainEid}`,
  })
  checks.push({
    id: 'remote_is_hub',
    ok: robinhoodIsHub === false,
    detail: `isHub=${robinhoodIsHub}`,
  })
  checks.push({
    id: 'remote_hub_eid',
    ok: robinhoodHubEid === BASE_HUB_EID,
    detail: `hubEid=${robinhoodHubEid}`,
  })

  const hubGaugeOk = params.hubGaugeReceiver
    ? getAddress(robinhoodHubGauge) === getAddress(params.hubGaugeReceiver)
    : isAddress(robinhoodHubGauge) && robinhoodHubGauge !== '0x0000000000000000000000000000000000000000'
  checks.push({
    id: 'remote_hub_gauge',
    ok: hubGaugeOk,
    detail: robinhoodHubGauge,
  })
  checks.push({
    id: 'remote_peer_to_base',
    ok: peerMatchesAddress(normalizeBytes32(robinhoodHubPeer), params.baseShareOft),
    detail: robinhoodHubPeer,
  })
  checks.push({
    id: 'base_peer_to_robinhood',
    ok: peerMatchesAddress(normalizeBytes32(baseRobinhoodPeer), params.robinhoodShareOft),
    detail: baseRobinhoodPeer,
  })

  const [baseToRobinhoodQuoteWei, robinhoodToBaseQuoteWei] = await Promise.all([
    quoteBridgeFee({
      publicClient: params.baseClient,
      shareOft: params.baseShareOft,
      dstEid: ROBINHOOD_EID,
      recipient: params.robinhoodShareOft,
    }),
    quoteBridgeFee({
      publicClient: params.robinhoodClient,
      shareOft: params.robinhoodShareOft,
      dstEid: BASE_HUB_EID,
      recipient: params.baseShareOft,
    }),
  ])

  checks.push({
    id: 'quote_base_to_robinhood',
    ok: baseToRobinhoodQuoteWei !== null,
    detail: baseToRobinhoodQuoteWei?.toString() ?? 'quote failed',
  })
  checks.push({
    id: 'quote_robinhood_to_base',
    ok: robinhoodToBaseQuoteWei !== null,
    detail: robinhoodToBaseQuoteWei?.toString() ?? 'quote failed',
  })

  return {
    ready: checks.every((check) => check.ok),
    checks,
    baseToRobinhoodQuoteWei,
    robinhoodToBaseQuoteWei,
  }
}
