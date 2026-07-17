/**
 * Solana lottery LZ submit action (not registered on orchestrator).
 *
 * Invokes the Keeper inbox submit worker over machine auth. Still fail-closed
 * unless SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1 and transport readiness
 * passes on the API side. Never calls processSwapLottery / Twin adapter.
 */

import {
  assessSolanaLotteryLzTransportReadiness,
  SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  submitSolanaLotteryWinnerViaLz,
  truthyEnv,
} from '../utils/solanaLotteryLzTransport.js'

function keeperBaseUrl(): string {
  const raw = String(
    process.env.KPR_API_BASE_URL ?? process.env.KEEPR_API_BASE_URL ?? 'https://app.4626.fun/api',
  )
    .trim()
    .replace(/\/$/, '')
  return raw
}

function keeperApiKey(): string {
  return String(process.env.KPR_API_KEY ?? process.env.KEEPR_API_KEY ?? '').trim()
}

export async function executeSolanaLotterySubmit(
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (truthyEnv(process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP)) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }

  const readiness = assessSolanaLotteryLzTransportReadiness()
  if (!readiness.relayEntriesEnabled) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:relay_flag_disabled`)
  }
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }

  const apiKey = keeperApiKey()
  if (!apiKey) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:missing_kpr_api_key`)
  }

  const limit =
    typeof payload.limit === 'number' && Number.isFinite(payload.limit)
      ? Math.max(1, Math.min(Math.floor(payload.limit), 50))
      : 10
  const leaseOwner =
    typeof payload.leaseOwner === 'string' && payload.leaseOwner.trim()
      ? payload.leaseOwner.trim()
      : `kpr-solana-lottery-submit:${process.pid}`

  const response = await fetch(`${keeperBaseUrl()}/keeper/solana/lottery-submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ leaseOwner, limit }),
  })
  const text = await response.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { error: text.slice(0, 200) }
  }
  if (!response.ok || json.success === false) {
    throw new Error(
      `${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:keeper_submit_${response.status}:${String(json.error ?? text).slice(0, 200)}`,
    )
  }
  return (json.data && typeof json.data === 'object' ? json.data : json) as Record<string, unknown>
}

export async function executeSolanaLotteryWinnerRelay(
  payload: Record<string, unknown> = {},
): Promise<never> {
  const winId = typeof payload.winId === 'string' ? payload.winId : ''
  const creatorMint = typeof payload.creatorMint === 'string' ? payload.creatorMint : ''
  const winnerSolana = typeof payload.winnerSolana === 'string' ? payload.winnerSolana : ''
  const sharesPaid = typeof payload.sharesPaid === 'string' || typeof payload.sharesPaid === 'number'
    ? BigInt(payload.sharesPaid)
    : 0n

  if (!winId || !creatorMint || !winnerSolana) {
    throw new Error('winner_relay_invalid_payload')
  }
  // Strict u64: reject oversized payouts (preserve SOL-P1-03).
  if (sharesPaid < 0n || sharesPaid > 0xffffffffffffffffn) {
    throw new Error('winner_relay_shares_paid_overflow')
  }

  await submitSolanaLotteryWinnerViaLz({
    winId,
    creatorMint,
    winnerSolana,
    sharesPaid,
  })
  throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
}
