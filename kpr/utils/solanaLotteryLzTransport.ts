/**
 * Fail-closed Solana→Base LZ lottery transport (KPR-side).
 * Twin / EOA → processSwapLottery permanently forbidden.
 */

import { keccak256, stringToHex } from 'viem'

export const SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE = 'solana_lottery_lz_transport_unavailable'
export const SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN = 'solana_lottery_eoa_submit_forbidden'
export const MSG_TYPE_LOTTERY_ENTRY = 3
export const SOLANA_LZ_EID = 30168
export const SOLANA_LOTTERY_SOURCE_EVENT_DOMAIN = '4626.solana.lottery.source-event.v1:'

export type SolanaLotteryLzTransportReadiness = {
  ready: boolean
  reasons: string[]
  relayEntriesEnabled: boolean
  transportReadyEnv: boolean
  peerBytes32: string | null
}

export function truthyEnv(raw: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(String(raw ?? '').trim().toLowerCase())
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function assessSolanaLotteryLzTransportReadiness(
  env: NodeJS.ProcessEnv = process.env,
): SolanaLotteryLzTransportReadiness {
  const reasons: string[] = []
  const relayEntriesEnabled = truthyEnv(env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED)
  const transportReadyEnv = truthyEnv(env.SOLANA_LOTTERY_LZ_TRANSPORT_READY)
  const peerRaw = String(env.SOLANA_LOTTERY_OAPP_PEER_BYTES32 ?? '').trim().toLowerCase()
  const peerBytes32 = /^0x[a-f0-9]{64}$/.test(peerRaw) ? peerRaw : null

  if (!relayEntriesEnabled) reasons.push('relay_flag_disabled')
  if (!transportReadyEnv) reasons.push('transport_ready_env_unset')
  if (!peerBytes32) reasons.push('missing_solana_lottery_oapp_peer')

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

export async function submitSolanaLotteryEntryViaLz(_request: {
  sourceEventId: string
  buyer: string
  tokenIn: string
  amount: bigint
}): Promise<never> {
  if (truthyEnv(process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP)) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }
  const readiness = assessSolanaLotteryLzTransportReadiness()
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }
  hashSolanaLotterySourceEventId(_request.sourceEventId)
  throw new Error(
    `${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:solana_lottery_oapp_send_not_implemented`,
  )
}

export async function submitSolanaLotteryWinnerViaLz(_params: {
  winId: string
  creatorMint: string
  winnerSolana: string
  sharesPaid: bigint
}): Promise<never> {
  throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:winner_relay_not_implemented`)
}
