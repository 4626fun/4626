import { AKITA_DEFAULTS, BASE_DEFAULTS } from '@/config/contracts.defaults'

import {
  decodeFunctionData,
  encodeFunctionData,
  encodePacked,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from 'viem'

import type { ShareBridgeReadClient } from './shareBridgeReadClient'

/** Matches DeploymentBatcherPhase2Module.SOLANA_ALLOC_PERCENT */
export const FINALIZE_SHARE_BRIDGE_SOLANA_PERCENT = 30n
export const FINALIZE_SHARE_BRIDGE_GAS_LIMIT = 200_000n
/** Paymaster allows surplus above live quoteSend fee (contract refunds to owner). */
export const FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI = 500_000_000_000_000n // 0.0005 ETH

export const SELECTOR_BATCHER_FINALIZE_PHASE2 = '0xbd4583fb'
export const SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2 = '0xab56c176'
/** LayerZero OFT `NoPeer(uint32)` — greenfield ShareOFT peer is set inside finalizePhase2. */
export const LZ_NO_PEER_SELECTOR = '0xf6ff4fb7'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex

const FINALIZE_PHASE2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

const FINALIZE_PHASE2_WITH_PERMIT2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2WithPermit2',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: FINALIZE_PHASE2_ABI[0].inputs[0].components,
      },
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

const BATCHER_SOLANA_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
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
  {
    type: 'function',
    name: 'solanaShareOftPeer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const WRAPPER_PREVIEW_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    inputs: [{ name: 'creatorCoinAmount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const SHARE_OFT_QUOTE_ABI = [
  {
    type: 'function',
    name: 'quoteOFT',
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
    ],
    outputs: [
      {
        name: 'limit',
        type: 'tuple',
        components: [
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'maxAmountLD', type: 'uint256' },
        ],
      },
      {
        name: 'oftFeeDetails',
        type: 'tuple[]',
        components: [
          { name: 'feeAmountLD', type: 'int256' },
          { name: 'description', type: 'string' },
        ],
      },
      {
        name: 'receipt',
        type: 'tuple',
        components: [
          { name: 'amountSentLD', type: 'uint256' },
          { name: 'amountReceivedLD', type: 'uint256' },
        ],
      },
    ],
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

export type FinalizePhase2SolanaIx = {
  programId: Address
  serializedAccounts: readonly Address[]
  data: Hex
}

export type FinalizePhase2Params = {
  creatorToken: Address
  owner: Address
  vault: Address
  wrapper: Address
  shareOFT: Address
  gaugeController: Address
  ccaStrategy: Address
  oracle: Address
  version: string
  depositAmount: bigint
  requiredRaise: bigint
  floorPriceQ96: bigint
  auctionSteps: Hex
  meteoraAlphaVault: Hex
  solanaIxs: readonly FinalizePhase2SolanaIx[]
}

export type FinalizeShareBridgeQuote = {
  required: boolean
  nativeFee: bigint
  solanaAmount: bigint
  dstEid: number
  destination: Hex
}

export type FinalizeShareBridgeQuoteError = {
  code:
    | 'finalize_decode_failed'
    | 'bridge_not_configured'
    | 'oft_peer_not_configured'
    | 'deposit_amount_invalid'
    | 'share_amount_zero'
    | 'quote_failed'
  message: string
}

function getSelector(data: Hex): string {
  return data.length >= 10 ? data.slice(0, 10).toLowerCase() : ''
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value as Address)
}

function normalizeBytes32Peer(value: unknown): Hex | null {
  if (typeof value !== 'string' || !value.startsWith('0x') || value.length !== 66) return null
  return value.toLowerCase() === ZERO_BYTES32.toLowerCase() ? null : (value as Hex)
}

export function isLayerZeroNoPeerQuoteError(error: unknown): boolean {
  const message = formatUnknownError(error)
  const lower = message.toLowerCase()
  return (
    lower.includes(LZ_NO_PEER_SELECTOR) ||
    lower.includes(LZ_NO_PEER_SELECTOR.slice(2)) ||
    /\bnopeer\s*\(/i.test(message)
  )
}

function formatUnknownError(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 6; depth += 1) {
    if (current instanceof Error) {
      if (current.message.trim()) parts.push(current.message)
      current = current.cause
      continue
    }
    if (typeof current === 'string' && current.trim()) {
      parts.push(current)
    }
    break
  }
  return parts.join(' | ')
}

function readReferenceWiredShareOftCandidates(): Address[] {
  const out: Address[] = []
  const viteReference =
    typeof import.meta !== 'undefined' && import.meta.env
      ? String(import.meta.env.VITE_REFERENCE_WIRED_SHARE_OFT ?? '').trim()
      : ''
  for (const raw of [
    typeof process !== 'undefined' ? process.env?.REFERENCE_WIRED_SHARE_OFT : undefined,
    viteReference || undefined,
    AKITA_DEFAULTS.shareOFT,
  ]) {
    const normalized = normalizeAddress(raw)
    if (normalized && !out.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      out.push(normalized)
    }
  }
  return out
}

async function readShareOftPeerBytes32(params: {
  publicClient: ShareBridgeReadClient
  shareOft: Address
  dstEid: number
}): Promise<Hex | null> {
  if (typeof params.publicClient.getBytecode === 'function') {
    try {
      const code = await params.publicClient.getBytecode({ address: params.shareOft })
      if (!code || code === '0x') return null
    } catch {
      return null
    }
  }
  try {
    const peer = await params.publicClient.readContract({
      address: params.shareOft,
      abi: SHARE_OFT_PEER_ABI,
      functionName: 'peers',
      args: [params.dstEid],
    })
    return normalizeBytes32Peer(peer)
  } catch {
    return null
  }
}

async function readShareOftPeerConfigured(params: {
  publicClient: ShareBridgeReadClient
  shareOft: Address
  dstEid: number
}): Promise<boolean | null> {
  const peer = await readShareOftPeerBytes32(params)
  if (peer === null) return null
  return true
}

async function resolveReferenceWiredShareOftForQuote(params: {
  publicClient: ShareBridgeReadClient
  dstEid: number
  exclude?: Address
}): Promise<Address | null> {
  for (const candidate of readReferenceWiredShareOftCandidates()) {
    if (params.exclude && candidate.toLowerCase() === params.exclude.toLowerCase()) continue
    const configured = await readShareOftPeerConfigured({
      publicClient: params.publicClient,
      shareOft: candidate,
      dstEid: params.dstEid,
    })
    if (configured === false) continue
    if (configured === null && typeof params.publicClient.getBytecode === 'function') {
      try {
        const code = await params.publicClient.getBytecode({ address: candidate })
        if (!code || code === '0x') continue
      } catch {
        continue
      }
    }
    return candidate
  }
  return null
}

function shareOftPeerMatchesEffective(params: {
  shareOftPeer: Hex | null
  effectivePeer: Hex
}): boolean {
  return (
    params.shareOftPeer !== null &&
    params.shareOftPeer.toLowerCase() === params.effectivePeer.toLowerCase()
  )
}

async function resolveShareOftForLayerZeroQuote(params: {
  publicClient: ShareBridgeReadClient
  targetShareOft: Address
  dstEid: number
  effectivePeer: Hex
}): Promise<
  | { quoteShareOft: Address; quotedViaReferenceShareOft: boolean }
  | FinalizeShareBridgeQuoteError
> {
  const referenceShareOft = await resolveReferenceWiredShareOftForQuote({
    publicClient: params.publicClient,
    dstEid: params.dstEid,
    exclude: params.targetShareOft,
  })

  // Greenfield ShareOFTs are unwired until finalizePhase2 setPeer — never quoteSend on them
  // when a distinct reference wired ShareOFT exists (AKITA / REFERENCE_WIRED_SHARE_OFT).
  if (
    referenceShareOft &&
    referenceShareOft.toLowerCase() !== params.targetShareOft.toLowerCase()
  ) {
    return { quoteShareOft: referenceShareOft, quotedViaReferenceShareOft: true }
  }

  const targetPeer = await readShareOftPeerBytes32({
    publicClient: params.publicClient,
    shareOft: params.targetShareOft,
    dstEid: params.dstEid,
  })
  if (
    shareOftPeerMatchesEffective({
      shareOftPeer: targetPeer,
      effectivePeer: params.effectivePeer,
    })
  ) {
    return { quoteShareOft: params.targetShareOft, quotedViaReferenceShareOft: false }
  }

  if (referenceShareOft) {
    return { quoteShareOft: referenceShareOft, quotedViaReferenceShareOft: true }
  }

  return {
    code: 'oft_peer_not_configured',
    message:
      `LayerZero NoPeer(${params.dstEid}): ${params.targetShareOft} is not wired for Solana yet — ` +
      'greenfield finalize calls setPeer during finalizePhase2 before send. ' +
      'Set batcher/registry solanaShareOftPeer, or configure REFERENCE_WIRED_SHARE_OFT for fee quoting via a wired reference ShareOFT.',
  }
}

async function quoteNativeFeeOnShareOft(params: {
  publicClient: ShareBridgeReadClient
  shareOft: Address
  baseSendParam: {
    dstEid: number
    to: Hex
    amountLD: bigint
    minAmountLD: bigint
    extraOptions: Hex
    composeMsg: Hex
    oftCmd: Hex
  }
}): Promise<bigint> {
  const quoteOft = (await params.publicClient.readContract({
    address: params.shareOft,
    abi: SHARE_OFT_QUOTE_ABI,
    functionName: 'quoteOFT',
    args: [params.baseSendParam],
  })) as readonly [unknown, unknown, { amountReceivedLD?: bigint }]
  const amountReceivedLD = BigInt(quoteOft?.[2]?.amountReceivedLD ?? 0n)
  const sendParam = {
    ...params.baseSendParam,
    minAmountLD: amountReceivedLD,
  }
  const fee = (await params.publicClient.readContract({
    address: params.shareOft,
    abi: SHARE_OFT_QUOTE_ABI,
    functionName: 'quoteSend',
    args: [sendParam, false],
  })) as { nativeFee?: bigint; lzTokenFee?: bigint }
  const nativeFee = BigInt(fee?.nativeFee ?? 0n)
  if (nativeFee <= 0n) {
    throw new Error('LayerZero quoteSend returned zero nativeFee for finalize share bridge.')
  }
  return nativeFee
}

function readShareAddress(params: Record<string, unknown> | null | undefined): Address | null {
  if (!params) return null
  return normalizeAddress(params.shareOFT ?? params.shareToken)
}

export function buildShareBridgeExecutorLzReceiveOptions(gasLimit = FINALIZE_SHARE_BRIDGE_GAS_LIMIT): Hex {
  const option = encodePacked(['uint128'], [gasLimit])
  return encodePacked(
    ['uint16', 'uint8', 'uint16', 'uint8', 'bytes'],
    [3, 1, Number(option.length + 1), 1, option],
  )
}

export function decodeFinalizePhase2Call(data: Hex): {
  functionName: 'finalizePhase2' | 'finalizePhase2WithPermit2'
  params: FinalizePhase2Params
} | null {
  const selector = getSelector(data)
  if (selector === SELECTOR_BATCHER_FINALIZE_PHASE2) {
    try {
      const decoded = decodeFunctionData({ abi: FINALIZE_PHASE2_ABI, data })
      const params = decoded.args?.[0] as Record<string, unknown>
      const shareOFT = readShareAddress(params)
      const creatorToken = normalizeAddress(params?.creatorToken)
      const owner = normalizeAddress(params?.owner)
      const wrapper = normalizeAddress(params?.wrapper)
      const vault = normalizeAddress(params?.vault)
      const gaugeController = normalizeAddress(params?.gaugeController)
      const ccaStrategy = normalizeAddress(params?.ccaStrategy)
      const oracle = normalizeAddress(params?.oracle)
      const depositAmount = BigInt((params?.depositAmount ?? 0n) as bigint | string | number)
      if (!creatorToken || !owner || !wrapper || !vault || !shareOFT || !gaugeController || !ccaStrategy || !oracle) {
        return null
      }
      return {
        functionName: 'finalizePhase2',
        params: {
          creatorToken,
          owner,
          vault,
          wrapper,
          shareOFT,
          gaugeController,
          ccaStrategy,
          oracle,
          version: typeof params?.version === 'string' ? params.version : '',
          depositAmount,
          requiredRaise: BigInt((params?.requiredRaise ?? 0n) as bigint | string | number),
          floorPriceQ96: BigInt((params?.floorPriceQ96 ?? 0n) as bigint | string | number),
          auctionSteps: (params?.auctionSteps ?? '0x') as Hex,
          meteoraAlphaVault: (params?.meteoraAlphaVault ?? ZERO_BYTES32) as Hex,
          solanaIxs: Array.isArray(params?.solanaIxs) ? params.solanaIxs : [],
        },
      }
    } catch {
      return null
    }
  }
  if (selector === SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2) {
    try {
      const decoded = decodeFunctionData({ abi: FINALIZE_PHASE2_WITH_PERMIT2_ABI, data })
      const params = decoded.args?.[0] as Record<string, unknown>
      const shareOFT = readShareAddress(params)
      const creatorToken = normalizeAddress(params?.creatorToken)
      const owner = normalizeAddress(params?.owner)
      const wrapper = normalizeAddress(params?.wrapper)
      const vault = normalizeAddress(params?.vault)
      const gaugeController = normalizeAddress(params?.gaugeController)
      const ccaStrategy = normalizeAddress(params?.ccaStrategy)
      const oracle = normalizeAddress(params?.oracle)
      const depositAmount = BigInt((params?.depositAmount ?? 0n) as bigint | string | number)
      if (!creatorToken || !owner || !wrapper || !vault || !shareOFT || !gaugeController || !ccaStrategy || !oracle) {
        return null
      }
      return {
        functionName: 'finalizePhase2WithPermit2',
        params: {
          creatorToken,
          owner,
          vault,
          wrapper,
          shareOFT,
          gaugeController,
          ccaStrategy,
          oracle,
          version: typeof params?.version === 'string' ? params.version : '',
          depositAmount,
          requiredRaise: BigInt((params?.requiredRaise ?? 0n) as bigint | string | number),
          floorPriceQ96: BigInt((params?.floorPriceQ96 ?? 0n) as bigint | string | number),
          auctionSteps: (params?.auctionSteps ?? '0x') as Hex,
          meteoraAlphaVault: (params?.meteoraAlphaVault ?? ZERO_BYTES32) as Hex,
          solanaIxs: Array.isArray(params?.solanaIxs) ? params.solanaIxs : [],
        },
      }
    } catch {
      return null
    }
  }
  return null
}

export function buildFinalizePhase2CallData(params: FinalizePhase2Params): Hex {
  return encodeFunctionData({
    abi: FINALIZE_PHASE2_ABI,
    functionName: 'finalizePhase2',
    args: [params as never],
  })
}

function readOvaultRuntime(value: unknown): { enabled: boolean; solanaEid: number } {
  const tuple = Array.isArray(value) ? value : null
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const enabled =
    typeof obj?.enabled === 'boolean'
      ? obj.enabled
      : tuple && typeof tuple[2] === 'boolean'
        ? tuple[2]
        : false
  const solanaEid =
    typeof obj?.solanaEid === 'number'
      ? obj.solanaEid
      : typeof obj?.solanaEid === 'bigint'
        ? Number(obj.solanaEid)
        : tuple && typeof tuple[1] === 'number'
          ? tuple[1]
          : tuple && typeof tuple[1] === 'bigint'
            ? Number(tuple[1])
            : 0
  return { enabled, solanaEid }
}

/** Returns false when wrapper address is known but has no Base bytecode yet (Phase 1 pending). */
export async function readFinalizePhase2WrapperHasBytecode(params: {
  publicClient: ShareBridgeReadClient
  finalizeCallData: Hex
}): Promise<boolean | null> {
  const decoded = decodeFinalizePhase2Call(params.finalizeCallData)
  if (!decoded?.params.wrapper || !isAddress(decoded.params.wrapper)) return null
  if (typeof params.publicClient.getBytecode !== 'function') return null
  try {
    const code = await params.publicClient.getBytecode({ address: getAddress(decoded.params.wrapper) })
    return Boolean(code && code !== '0x')
  } catch {
    return null
  }
}

export async function quoteFinalizeShareBridgeNativeFee(params: {
  publicClient: ShareBridgeReadClient
  batcherAddress: Address
  finalizeCallData: Hex
  registryAddress?: Address
}): Promise<FinalizeShareBridgeQuote | FinalizeShareBridgeQuoteError> {
  const decoded = decodeFinalizePhase2Call(params.finalizeCallData)
  if (!decoded) {
    return {
      code: 'finalize_decode_failed',
      message: 'Could not decode finalizePhase2 call for ShareOFT bridge fee quoting.',
    }
  }
  if (decoded.params.depositAmount <= 0n) {
    return { code: 'deposit_amount_invalid', message: 'finalizePhase2 depositAmount must be positive.' }
  }

  const [runtimeRaw, destinationRaw] = await Promise.all([
    params.publicClient.readContract({
      address: params.batcherAddress,
      abi: BATCHER_SOLANA_VIEW_ABI,
      functionName: 'getOVaultRuntimeConfig',
    }),
    params.publicClient.readContract({
      address: params.batcherAddress,
      abi: BATCHER_SOLANA_VIEW_ABI,
      functionName: 'solanaDestination',
    }),
  ])

  const runtime = readOvaultRuntime(runtimeRaw)
  const destination = typeof destinationRaw === 'string' ? (destinationRaw as Hex) : ZERO_BYTES32
  const bridgeConfigured =
    runtime.enabled === true && runtime.solanaEid > 0 && destination !== ZERO_BYTES32
  if (!bridgeConfigured) {
    return {
      required: false,
      nativeFee: 0n,
      solanaAmount: 0n,
      dstEid: runtime.solanaEid,
      destination,
    }
  }

  let shareTokens: bigint
  try {
    shareTokens = (await params.publicClient.readContract({
      address: decoded.params.wrapper,
      abi: WRAPPER_PREVIEW_DEPOSIT_ABI,
      functionName: 'previewDeposit',
      args: [decoded.params.depositAmount],
    })) as bigint
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'previewDeposit failed')
    if (/returned no data|does not have any code|contract does not exist/i.test(message)) {
      return {
        code: 'quote_failed',
        message:
          `LayerZero finalize share bridge quote blocked: wrapper ${decoded.params.wrapper} is not deployed on Base yet. ` +
          'Pipe A quoting needs a live CreatorOVaultWrapper — finish Phase 1 core (vault + wrapper CREATE2 deploy) and confirm bytecode on Basescan before finalize.',
      }
    }
    return { code: 'quote_failed', message: `LayerZero finalize share bridge quote failed: ${message}` }
  }
  const solanaAmount = (shareTokens * FINALIZE_SHARE_BRIDGE_SOLANA_PERCENT) / 100n
  if (solanaAmount <= 0n) {
    return {
      required: false,
      nativeFee: 0n,
      solanaAmount: 0n,
      dstEid: runtime.solanaEid,
      destination,
    }
  }

  const registryAddress = params.registryAddress ?? getAddress(BASE_DEFAULTS.registry as Address)
  const [registryPeerRaw, batcherDefaultPeerRaw] = await Promise.all([
    params.publicClient.readContract({
      address: registryAddress,
      abi: CREATOR_REGISTRY_REMOTE_PEER_ABI,
      functionName: 'getRemoteOFTPeerBytes32',
      args: [decoded.params.creatorToken, runtime.solanaEid],
    }),
    params.publicClient.readContract({
      address: params.batcherAddress,
      abi: BATCHER_SOLANA_VIEW_ABI,
      functionName: 'solanaShareOftPeer',
    }),
  ])
  const registryPeer =
    typeof registryPeerRaw === 'string' && registryPeerRaw.toLowerCase() !== ZERO_BYTES32.toLowerCase()
      ? (registryPeerRaw as Hex)
      : null
  const batcherDefaultPeer =
    typeof batcherDefaultPeerRaw === 'string' &&
    batcherDefaultPeerRaw.toLowerCase() !== ZERO_BYTES32.toLowerCase()
      ? (batcherDefaultPeerRaw as Hex)
      : null
  if (!registryPeer && !batcherDefaultPeer) {
    return {
      code: 'oft_peer_not_configured',
      message:
        `CreatorRegistry and deployment batcher have no LayerZero remote ShareOFT peer for ${decoded.params.creatorToken} ` +
        `on Solana EID ${runtime.solanaEid}. Seed registry peer wiring or set batcher solanaShareOftPeer before finalizePhase2.`,
    }
  }

  const extraOptions = buildShareBridgeExecutorLzReceiveOptions()
  const baseSendParam = {
    dstEid: runtime.solanaEid,
    to: destination,
    amountLD: solanaAmount,
    minAmountLD: 0n,
    extraOptions,
    composeMsg: '0x' as Hex,
    oftCmd: '0x' as Hex,
  }

  const effectivePeer = (registryPeer ?? batcherDefaultPeer) as Hex
  const quoteShareOftResolution = await resolveShareOftForLayerZeroQuote({
    publicClient: params.publicClient,
    targetShareOft: decoded.params.shareOFT,
    dstEid: runtime.solanaEid,
    effectivePeer,
  })
  if ('code' in quoteShareOftResolution) {
    return quoteShareOftResolution
  }
  const { quoteShareOft, quotedViaReferenceShareOft } = quoteShareOftResolution

  try {
    let nativeFee = await quoteNativeFeeOnShareOft({
      publicClient: params.publicClient,
      shareOft: quoteShareOft,
      baseSendParam,
    })
    if (quotedViaReferenceShareOft && nativeFee <= 0n) {
      throw new Error('LayerZero quoteSend returned zero nativeFee for finalize share bridge.')
    }
    return {
      required: true,
      nativeFee,
      solanaAmount,
      dstEid: runtime.solanaEid,
      destination,
    }
  } catch (error) {
    if (
      !quotedViaReferenceShareOft &&
      isLayerZeroNoPeerQuoteError(error)
    ) {
      const referenceShareOft = await resolveReferenceWiredShareOftForQuote({
        publicClient: params.publicClient,
        dstEid: runtime.solanaEid,
        exclude: decoded.params.shareOFT,
      })
      if (referenceShareOft) {
        try {
          const nativeFee = await quoteNativeFeeOnShareOft({
            publicClient: params.publicClient,
            shareOft: referenceShareOft,
            baseSendParam,
          })
          return {
            required: true,
            nativeFee,
            solanaAmount,
            dstEid: runtime.solanaEid,
            destination,
          }
        } catch (referenceError) {
          error = referenceError
        }
      }
    }
    const message = formatUnknownError(error)
    if (isLayerZeroNoPeerQuoteError(error) || message.toLowerCase().includes(LZ_NO_PEER_SELECTOR)) {
      return {
        code: 'oft_peer_not_configured',
        message:
          `LayerZero NoPeer(${runtime.solanaEid}): ${decoded.params.shareOFT} is not wired for Solana yet. ` +
          'Greenfield finalize calls setPeer during finalizePhase2; pre-finalize fee quotes use a reference wired ShareOFT when available. ' +
          'Ensure batcher solanaShareOftPeer / registry peer is set and REFERENCE_WIRED_SHARE_OFT (or AKITA shareOFT) has Solana peer wiring.',
      }
    }
    return { code: 'quote_failed', message: `LayerZero finalize share bridge quote failed: ${message}` }
  }
}

export function parseCallValue(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      return BigInt(value.trim())
    } catch {
      return 0n
    }
  }
  return 0n
}

export type DeploySessionStyleCall = {
  to: Address | string
  value?: string | number | bigint
  data: Hex
}

export async function attachFinalizeShareBridgeValueToCalls<T extends DeploySessionStyleCall>(params: {
  publicClient: ShareBridgeReadClient
  calls: T[]
}): Promise<T[]> {
  const out = [...params.calls]
  for (let index = 0; index < out.length; index += 1) {
    const call = out[index]
    if (!call) continue
    if (typeof call.data !== 'string') {
      throw new Error('Deploy session call data must be a hex string.')
    }
    const selector = getSelector(call.data as Hex)
    if (
      selector !== SELECTOR_BATCHER_FINALIZE_PHASE2 &&
      selector !== SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2
    ) {
      continue
    }
    const batcherAddress =
      typeof call.to === 'string' && isAddress(call.to) ? getAddress(call.to as Address) : null
    if (!batcherAddress) {
      throw new Error('finalizePhase2 call target must be a valid deployment batcher address.')
    }

    const wrapperDeployed = await readFinalizePhase2WrapperHasBytecode({
      publicClient: params.publicClient,
      finalizeCallData: call.data as Hex,
    })
    if (wrapperDeployed === false) {
      out[index] = {
        ...call,
        value: '0',
      }
      continue
    }

    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: params.publicClient,
      batcherAddress,
      finalizeCallData: call.data as Hex,
    })
    if ('code' in quote) {
      throw new Error(quote.message)
    }
    out[index] = {
      ...call,
      value: quote.required ? String(quote.nativeFee) : '0',
    }
  }
  return out
}

export async function assertFinalizeShareBridgeCallValue(params: {
  publicClient: ShareBridgeReadClient
  batcherAddress: Address
  callData: Hex
  value: bigint
}): Promise<void> {
  const quote = await quoteFinalizeShareBridgeNativeFee({
    publicClient: params.publicClient,
    batcherAddress: params.batcherAddress,
    finalizeCallData: params.callData,
  })
  if ('code' in quote) {
    throw new Error(quote.code)
  }
  if (!quote.required) {
    if (params.value !== 0n) throw new Error('finalize_share_bridge_fee_unexpected')
    return
  }
  if (params.value < quote.nativeFee) throw new Error('finalize_share_bridge_fee_insufficient')
  if (params.value > quote.nativeFee + FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI) {
    throw new Error('finalize_share_bridge_fee_excessive')
  }
}
