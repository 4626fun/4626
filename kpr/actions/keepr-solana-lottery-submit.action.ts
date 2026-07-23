/**
 * Solana lottery LZ submit action registered as the default-off lottery_submit lane.
 *
 * Invokes the Keeper inbox submit worker over machine auth. Still fail-closed
 * unless the production relay flag or the explicitly enabled single-use
 * canary lane is active and transport readiness passes on the API side. Never
 * calls processSwapLottery / Twin adapter.
 */

import {
  assessSolanaLotteryLzTransportReadiness,
  SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
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

  const canaryLaneEnabled = truthyEnv(process.env.SOLANA_B2_CANARY_AUTHORIZATION_ENABLED)
  const readiness = assessSolanaLotteryLzTransportReadiness(process.env, { allowCanary: canaryLaneEnabled })
  if (!readiness.relayEntriesEnabled && !canaryLaneEnabled) {
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
