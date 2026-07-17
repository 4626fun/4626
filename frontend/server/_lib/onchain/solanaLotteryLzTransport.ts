/**
 * Fail-closed Solana→Base LayerZero lottery transport (SOL-P0-01).
 *
 * Twin / EOA → processSwapLottery is permanently rejected.
 * Submission requires an authorized Solana lottery OApp peer + relay flag.
 * Until that peer exists, every submit throws
 * `solana_lottery_lz_transport_unavailable`.
 */

import { encodeAbiParameters, type Hex } from 'viem'

export const SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE = 'solana_lottery_lz_transport_unavailable'
export const SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN = 'solana_lottery_eoa_submit_forbidden'
export const MSG_TYPE_LOTTERY_ENTRY = 3
/** Solana mainnet LayerZero endpoint id. */
export const SOLANA_LZ_EID = 30168

export type SolanaLotteryLzPayloadInput = {
  buyer: `0x${string}`
  tokenIn: `0x${string}`
  amount: bigint
  /** Metadata chain id (Solana uses 0 or a dedicated marker; LM uses srcEid for routing). */
  sourceChainId: number
  /** Forced 0 for Solana base-odds-only. */
  buyerCurrentShareBalance: bigint
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
 * Build V2 remote lottery payload matching CreatorShareOFT._prepareLotteryEntryMessage.
 * Coverage must be 0 for Solana until personal boost attribution is proven.
 */
export function buildSolanaLotteryLzV2Payload(input: SolanaLotteryLzPayloadInput): Hex {
  if (input.buyerCurrentShareBalance !== 0n) {
    throw new Error('solana_lottery_coverage_must_be_zero')
  }
  const zero = '0x0000000000000000000000000000000000000000'
  if (input.buyer.toLowerCase() === zero) throw new Error('invalid_buyer')
  if (input.tokenIn.toLowerCase() === zero) throw new Error('invalid_token_in')
  if (input.amount <= 0n) throw new Error('invalid_amount')

  return encodeAbiParameters(
    [
      { type: 'uint16' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint32' },
      { type: 'uint256' },
    ],
    [
      MSG_TYPE_LOTTERY_ENTRY,
      input.buyer,
      input.tokenIn,
      input.amount,
      input.sourceChainId,
      0n,
    ],
  )
}

export function assessSolanaLotteryLzTransportReadiness(
  env: NodeJS.ProcessEnv = process.env,
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
    const raw = String(env.LOTTERY_MANAGER_ADDRESS ?? env.VITE_LOTTERY_MANAGER_ADDRESS ?? '')
      .trim()
      .toLowerCase()
    return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
  })()

  if (!relayEntriesEnabled) reasons.push('relay_flag_disabled')
  if (!transportReadyEnv) reasons.push('transport_ready_env_unset')
  if (!peerBytes32) reasons.push('missing_solana_lottery_oapp_peer')
  if (!lotteryManager) reasons.push('missing_lottery_manager')
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
  payload: Hex
}

/**
 * Submit path — always fail-closed until Solana lottery OApp peer is live.
 * Never calls processSwapLottery / Twin adapter.
 */
export async function submitSolanaLotteryEntryViaLz(
  request: SolanaLotteryLzSubmitRequest,
): Promise<SolanaLotteryLzSubmitResult> {
  // Explicit guard: EOA / processSwapLottery is architecturally forbidden.
  if (envFlag('SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP')) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }

  const readiness = assessSolanaLotteryLzTransportReadiness()
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }

  // Peer exists in env for readiness, but no live Solana OApp send is wired
  // in this PR (deploy forbidden). Fail closed rather than papering over.
  const peer = readBytes32Env('SOLANA_LOTTERY_OAPP_PEER_BYTES32')
  const lm = readAddressEnv('LOTTERY_MANAGER_ADDRESS') ?? readAddressEnv('VITE_LOTTERY_MANAGER_ADDRESS')
  if (!peer || !lm) {
    throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
  }

  buildSolanaLotteryLzV2Payload({
    buyer: request.buyer,
    tokenIn: request.tokenIn,
    amount: request.amount,
    sourceChainId: request.sourceChainId ?? 0,
    buyerCurrentShareBalance: 0n,
  })

  throw new Error(
    `${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:solana_lottery_oapp_send_not_implemented`,
  )
}

/** Winner relay stub — fail closed (Twin winner path retired). */
export async function submitSolanaLotteryWinnerViaLz(_params: {
  winId: `0x${string}`
  creatorMint: string
  winnerSolana: string
  sharesPaid: bigint
}): Promise<never> {
  throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:winner_relay_not_implemented`)
}
