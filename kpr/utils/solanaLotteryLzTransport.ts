/**
 * Fail-closed Solana→Base LZ lottery transport (KPR-side).
 * Twin / EOA → processSwapLottery permanently forbidden.
 */

import { encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem'
import { CANONICAL_LOTTERY_MANAGER } from './solanaCanonicalAddresses.js'
import {
  resolveSolanaLotteryOappSender,
  type SolanaLotteryOappSender,
} from './solanaLotteryOappSender.js'

export const SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE = 'solana_lottery_lz_transport_unavailable'
export const SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN = 'solana_lottery_eoa_submit_forbidden'
export const MSG_TYPE_LOTTERY_ENTRY = 3
export const SOLANA_LZ_EID = 30168
export const SOLANA_LOTTERY_SOURCE_EVENT_DOMAIN = '4626.solana.lottery.source-event.v1:'
export const CANONICAL_LOTTERY_MANAGER_PEER_BYTES32 =
  `0x${CANONICAL_LOTTERY_MANAGER.slice(2).padStart(64, '0')}`.toLowerCase()

export type SolanaLotteryLzTransportReadiness = {
  ready: boolean
  reasons: string[]
  relayEntriesEnabled: boolean
  transportReadyEnv: boolean
  peerBytes32: string | null
  lotteryManager: string | null
}

export function truthyEnv(raw: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(String(raw ?? '').trim().toLowerCase())
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function assessSolanaLotteryLzTransportReadiness(
  env: NodeJS.ProcessEnv = process.env,
  options: { allowCanary?: boolean } = {},
): SolanaLotteryLzTransportReadiness {
  const reasons: string[] = []
  const relayEntriesEnabled = truthyEnv(env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED)
  const transportReadyEnv = truthyEnv(env.SOLANA_LOTTERY_LZ_TRANSPORT_READY)
  const peerRaw = String(env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 ?? '').trim().toLowerCase()
  const peerBytes32 = /^0x[a-f0-9]{64}$/.test(peerRaw) ? peerRaw : null
  const managerRaw = String(
    env.LOTTERY_MANAGER ??
    env.LOTTERY_MANAGER_ADDRESS ??
    env.VITE_LOTTERY_MANAGER ??
    env.VITE_LOTTERY_MANAGER_ADDRESS ??
    '',
  ).trim().toLowerCase()
  const lotteryManager = /^0x[a-f0-9]{40}$/.test(managerRaw) ? managerRaw : null

  // The only production-flag bypass is a single-use DB authorization consumed
  // by the frontend worker before it invokes the OApp sender.
  if (!relayEntriesEnabled && !options.allowCanary) reasons.push('relay_flag_disabled')
  if (!transportReadyEnv) reasons.push('transport_ready_env_unset')
  if (!peerBytes32) reasons.push('missing_solana_lottery_oapp_peer')
  else if (peerBytes32 !== CANONICAL_LOTTERY_MANAGER_PEER_BYTES32) {
    reasons.push('noncanonical_solana_lottery_oapp_peer')
  }
  if (!lotteryManager) reasons.push('missing_lottery_manager')
  else if (lotteryManager !== CANONICAL_LOTTERY_MANAGER.toLowerCase()) {
    reasons.push('noncanonical_lottery_manager')
  }

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

/** Encode Solana-only V3 payload fields for tests / dry-run (no live send). */
export function buildSolanaLotteryLzV3PayloadFields(input: {
  buyer: string
  tokenIn: string
  amount: bigint
  sourceChainId: number
  buyerCurrentShareBalance: bigint
  sourceEventId: string
}): {
  msgType: number
  buyer: string
  tokenIn: string
  amount: bigint
  sourceChainId: number
  buyerCurrentShareBalance: bigint
  sourceEventId: `0x${string}`
} {
  if (input.buyerCurrentShareBalance !== 0n) {
    throw new Error('solana_lottery_coverage_must_be_zero')
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.buyer)) throw new Error('invalid_buyer')
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.tokenIn)) throw new Error('invalid_token_in')
  if (input.buyer.toLowerCase() === ZERO_ADDRESS) throw new Error('invalid_buyer')
  if (input.tokenIn.toLowerCase() === ZERO_ADDRESS) throw new Error('invalid_token_in')
  if (input.amount <= 0n) throw new Error('invalid_amount')
  const sourceEventId = hashSolanaLotterySourceEventId(input.sourceEventId)
  return {
    msgType: MSG_TYPE_LOTTERY_ENTRY,
    buyer: input.buyer.toLowerCase(),
    tokenIn: input.tokenIn.toLowerCase(),
    amount: input.amount,
    sourceChainId: input.sourceChainId,
    buyerCurrentShareBalance: 0n,
    sourceEventId,
  }
}

export function hashSolanaLotterySourceEventId(sourceEventId: string): `0x${string}` {
  const normalized = sourceEventId.trim()
  if (!normalized) throw new Error('invalid_source_event_id')
  return keccak256(stringToHex(`${SOLANA_LOTTERY_SOURCE_EVENT_DOMAIN}${normalized}`))
}

/** Build the exact V3 payload consumed by Base LotteryManager4626. */
export function buildSolanaLotteryLzV3Payload(input: {
  buyer: string
  tokenIn: string
  amount: bigint
  sourceChainId: number
  sourceEventId: Hex
}): Hex {
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.buyer) || /^0x0{40}$/i.test(input.buyer)) {
    throw new Error('invalid_buyer')
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.tokenIn) || /^0x0{40}$/i.test(input.tokenIn)) {
    throw new Error('invalid_token_in')
  }
  if (input.amount <= 0n) throw new Error('invalid_amount')
  if (!Number.isInteger(input.sourceChainId) || input.sourceChainId < 0 || input.sourceChainId > 0xffffffff) {
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
      input.buyer as `0x${string}`,
      input.tokenIn as `0x${string}`,
      input.amount,
      input.sourceChainId,
      0n,
      input.sourceEventId,
    ],
  )
}

export type SolanaLotteryLzSubmitResult = {
  ok: true
  lzGuid: string
  baseTxHash: string | null
}

export async function submitSolanaLotteryEntryViaLz(
  request: {
    sourceEventId: string
    buyer: string
    tokenIn: string
    amount: bigint
    sourceChainId?: number
  },
  options?: { sender?: SolanaLotteryOappSender | null; canaryAuthorized?: boolean },
): Promise<SolanaLotteryLzSubmitResult> {
  if (truthyEnv(process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP)) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }
  const readiness = assessSolanaLotteryLzTransportReadiness(process.env, {
    allowCanary: options?.canaryAuthorized === true,
  })
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }
  if (!readiness.peerBytes32 || !readiness.lotteryManager) {
    throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
  }
  const sourceEventDigest = hashSolanaLotterySourceEventId(request.sourceEventId)
  const payload = buildSolanaLotteryLzV3Payload({
    buyer: request.buyer,
    tokenIn: request.tokenIn,
    amount: request.amount,
    sourceChainId: request.sourceChainId ?? 0,
    sourceEventId: sourceEventDigest,
  })
  try {
    const sent = await resolveSolanaLotteryOappSender(options?.sender).send({
      payload,
      sourceEventId: request.sourceEventId,
      sourceEventDigest,
      buyer: request.buyer,
      tokenIn: request.tokenIn,
      amount: request.amount,
      peerBytes32: readiness.peerBytes32 as `0x${string}`,
      lotteryManager: readiness.lotteryManager,
    })
    return { ok: true, lzGuid: sent.lzGuid, baseTxHash: sent.baseTxHash }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)) throw error
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${message}`)
  }
}
