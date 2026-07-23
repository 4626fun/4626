/**
 * Fail-closed Solana→Base LayerZero lottery transport (SOL-P0-01).
 *
 * Twin / EOA → processSwapLottery is permanently rejected.
 * Submission requires an authorized Solana lottery OApp peer + relay flag.
 * Until that peer exists, every submit throws
 * `solana_lottery_lz_transport_unavailable`.
 */

import { encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem'

import {
  sendSolanaLotteryOappMessage,
  type SolanaLotteryOappSender,
} from './solanaLotteryOappSender.js'

export const SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE = 'solana_lottery_lz_transport_unavailable'
export const SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN = 'solana_lottery_eoa_submit_forbidden'
export const MSG_TYPE_LOTTERY_ENTRY = 3
export const SOLANA_LOTTERY_SOURCE_EVENT_DOMAIN = '4626.solana.lottery.source-event.v1:'
/** Solana mainnet LayerZero endpoint id. */
export const SOLANA_LZ_EID = 30168
export const CANONICAL_LOTTERY_MANAGER = '0xb45e68a5867935a5734e4185977f81c528006650'
export const CANONICAL_LOTTERY_MANAGER_PEER_BYTES32 =
  `0x${CANONICAL_LOTTERY_MANAGER.slice(2).padStart(64, '0')}` as `0x${string}`

export type SolanaLotteryLzPayloadInput = {
  buyer: `0x${string}`
  tokenIn: `0x${string}`
  amount: bigint
  /** Metadata chain id (Solana uses 0 or a dedicated marker; LM uses srcEid for routing). */
  sourceChainId: number
  /** Forced 0 for Solana base-odds-only. */
  buyerCurrentShareBalance: bigint
  /** Domain-separated stable source-event digest used for Base replay protection. */
  sourceEventId: Hex
}

export type SolanaLotteryLzTransportReadiness = {
  ready: boolean
  reasons: string[]
  relayEntriesEnabled: boolean
  transportReadyEnv: boolean
  peerBytes32: `0x${string}` | null
  lotteryManager: `0x${string}` | null
}

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env[name] ?? '').trim().toLowerCase())
}

function readBytes32Env(name: string): `0x${string}` | null {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(raw)) return null
  return raw as `0x${string}`
}

function readAddressEnv(name: string): `0x${string}` | null {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

/**
 * Build the Solana-only V3 remote lottery payload.
 * V3 appends a domain-separated source-event digest for Base replay protection.
 * Coverage must be 0 until personal boost attribution is proven.
 */
export function buildSolanaLotteryLzV3Payload(input: SolanaLotteryLzPayloadInput): Hex {
  if (input.buyerCurrentShareBalance !== 0n) {
    throw new Error('solana_lottery_coverage_must_be_zero')
  }
  const zero = '0x0000000000000000000000000000000000000000'
  if (input.buyer.toLowerCase() === zero) throw new Error('invalid_buyer')
  if (input.tokenIn.toLowerCase() === zero) throw new Error('invalid_token_in')
  if (input.amount <= 0n) throw new Error('invalid_amount')
  if (!Number.isInteger(input.sourceChainId) || input.sourceChainId < 0 || input.sourceChainId > 0xffff_ffff) {
    throw new Error('invalid_source_chain_id')
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.sourceEventId) || /^0x0{64}$/i.test(input.sourceEventId)) {
    throw new Error('invalid_source_event_id')
  }

  return encodeAbiParameters(
    [
      { type: 'uint16' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint32' },
      { type: 'uint256' },
      { type: 'bytes32' },
    ],
    [
      MSG_TYPE_LOTTERY_ENTRY,
      input.buyer,
      input.tokenIn,
      input.amount,
      input.sourceChainId,
      0n,
      input.sourceEventId,
    ],
  )
}

export function hashSolanaLotterySourceEventId(sourceEventId: string): Hex {
  const normalized = sourceEventId.trim()
  if (!normalized) throw new Error('invalid_source_event_id')
  return keccak256(stringToHex(`${SOLANA_LOTTERY_SOURCE_EVENT_DOMAIN}${normalized}`))
}

export function assessSolanaLotteryLzTransportReadiness(
  env: NodeJS.ProcessEnv = process.env,
  options: { allowCanary?: boolean } = {},
): SolanaLotteryLzTransportReadiness {
  const reasons: string[] = []
  const relayEntriesEnabled = ['1', 'true', 'yes'].includes(
    String(env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED ?? '').trim().toLowerCase(),
  )
  const transportReadyEnv = ['1', 'true', 'yes'].includes(
    String(env.SOLANA_LOTTERY_LZ_TRANSPORT_READY ?? '').trim().toLowerCase(),
  )
  const peerRaw = String(env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 ?? '').trim().toLowerCase()
  const peerBytes32 = /^0x[a-f0-9]{64}$/.test(peerRaw) ? (peerRaw as `0x${string}`) : null
  const lotteryManager = (() => {
    const raw = String(
      env.LOTTERY_MANAGER ??
      env.LOTTERY_MANAGER_ADDRESS ??
      env.VITE_LOTTERY_MANAGER ??
      env.VITE_LOTTERY_MANAGER_ADDRESS ??
      '',
    )
      .trim()
      .toLowerCase()
    return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
  })()

  // A single-use, DB-backed canary authorization is the only path allowed to
  // bypass the production relay flag. The caller must prove that authorization
  // was consumed before passing allowCanary to submit.
  if (!relayEntriesEnabled && !options.allowCanary) reasons.push('relay_flag_disabled')
  if (!transportReadyEnv) reasons.push('transport_ready_env_unset')
  if (!peerBytes32) reasons.push('missing_solana_lottery_oapp_peer')
  else if (peerBytes32 !== CANONICAL_LOTTERY_MANAGER_PEER_BYTES32) {
    reasons.push('noncanonical_solana_lottery_oapp_peer')
  }
  if (!lotteryManager) reasons.push('missing_lottery_manager')
  else if (lotteryManager !== CANONICAL_LOTTERY_MANAGER) {
    reasons.push('noncanonical_lottery_manager')
  }
  const senderMode = String(env.SOLANA_LOTTERY_OAPP_SENDER_MODE ?? '').trim().toLowerCase()
  if (senderMode === 'http') {
    if (!String(env.SOLANA_LOTTERY_OAPP_SEND_URL ?? '').trim()) reasons.push('missing_oapp_send_url')
    if (!String(env.SOLANA_LOTTERY_OAPP_SEND_TOKEN ?? '').trim()) {
      reasons.push('missing_oapp_send_token')
    }
  } else if (senderMode === 'mock') {
    if (!['1', 'true', 'yes'].includes(String(env.SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND ?? '').trim().toLowerCase())) {
      reasons.push('mock_oapp_send_forbidden')
    }
  } else {
    reasons.push(senderMode ? 'unknown_oapp_sender_mode' : 'missing_oapp_sender_mode')
  }
  // Twin adapter must never be treated as active transport.
  const twin = String(env.SOLANA_BRIDGE_ADAPTER_ADDRESS ?? '').trim().toLowerCase()
  if (twin === '0x9a61814082a26192dd9cb201b44058506685be60') {
    reasons.push('retired_twin_adapter_configured')
  }

  return {
    ready: reasons.length === 0,
    reasons,
    relayEntriesEnabled,
    transportReadyEnv,
    peerBytes32,
    lotteryManager,
  }
}

export type SolanaLotteryLzSubmitRequest = {
  sourceEventId: string
  buyer: `0x${string}`
  tokenIn: `0x${string}`
  amount: bigint
  sourceChainId?: number
}

export type SolanaLotteryLzSubmitResult = {
  ok: true
  lzGuid: string
  baseTxHash: string | null
  solanaSignature: string
  payload: Hex
}

/**
 * Submit path — fail-closed until readiness + configured OApp sender are live.
 * Never calls processSwapLottery / Twin adapter.
 */
export async function submitSolanaLotteryEntryViaLz(
  request: SolanaLotteryLzSubmitRequest,
  options?: { sender?: SolanaLotteryOappSender | null; canaryAuthorized?: boolean },
): Promise<SolanaLotteryLzSubmitResult> {
  // Explicit guard: EOA / processSwapLottery is architecturally forbidden.
  if (envFlag('SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP')) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }

  const readiness = assessSolanaLotteryLzTransportReadiness(process.env, {
    allowCanary: options?.canaryAuthorized === true,
  })
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }

  const peer = readiness.peerBytes32
  const lm = readiness.lotteryManager
  if (!peer || !lm) {
    throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
  }

  const sourceEventDigest = hashSolanaLotterySourceEventId(request.sourceEventId)
  const payload = buildSolanaLotteryLzV3Payload({
    buyer: request.buyer,
    tokenIn: request.tokenIn,
    amount: request.amount,
    sourceChainId: request.sourceChainId ?? 0,
    buyerCurrentShareBalance: 0n,
    sourceEventId: sourceEventDigest,
  })

  try {
    const sent = await sendSolanaLotteryOappMessage(
      {
        payload,
        sourceEventId: request.sourceEventId,
        sourceEventDigest,
        buyer: request.buyer,
        tokenIn: request.tokenIn,
        amount: request.amount,
        peerBytes32: peer,
        lotteryManager: lm,
      },
      options?.sender,
    )
    return {
      ok: true,
      lzGuid: sent.lzGuid,
      baseTxHash: sent.baseTxHash,
      solanaSignature: sent.solanaSignature,
      payload,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)) throw error
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${message}`)
  }
}
