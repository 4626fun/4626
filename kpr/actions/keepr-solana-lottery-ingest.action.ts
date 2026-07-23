/**
 * Solana lottery finalized-log ingest action (not registered on orchestrator).
 *
 * Fail-closed by default. Does not enable relay, clear the ring buffer, or
 * submit to Base. Ring buffer is never treated as the sole eligibility source.
 */

import {
  assessSolanaLotteryLzTransportReadiness,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  truthyEnv,
} from '../utils/solanaLotteryLzTransport.js'

export type SolanaLotteryIngestResult = Record<string, unknown>

function keeperBaseUrl(): string {
  return String(process.env.KPR_API_BASE_URL ?? process.env.KEEPR_API_BASE_URL ?? 'https://app.4626.fun/api')
    .trim()
    .replace(/\/$/, '')
}

function keeperApiKey(): string {
  return String(process.env.KPR_API_KEY ?? process.env.KEEPR_API_KEY ?? '').trim()
}

/**
 * Ingest is intentionally a no-op until explicitly enabled AND transport
 * design is accepted. Default: report disabled and leave inbox untouched.
 */
export async function executeSolanaLotteryIngest(
  payload: Record<string, unknown> = {},
): Promise<SolanaLotteryIngestResult> {
  const transport = assessSolanaLotteryLzTransportReadiness()

  // Hard reject if someone tries to use retired Twin defaults.
  if (transport.reasons.includes('retired_twin_adapter_configured')) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:retired_twin_adapter_configured`)
  }

  if (!truthyEnv(process.env.SOLANA_LOTTERY_INGEST_ENABLED)) {
    return {
      ok: true,
      mode: 'disabled',
      reason: 'SOLANA_LOTTERY_INGEST_ENABLED not set',
      transport,
    }
  }

  const apiKey = keeperApiKey()
  if (!apiKey) throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:missing_kpr_api_key`)
  const limit = typeof payload.limit === 'number' && Number.isFinite(payload.limit)
    ? Math.max(1, Math.min(Math.floor(payload.limit), 100))
    : 25
  const response = await fetch(`${keeperBaseUrl()}/keeper/solana/lottery-ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ limit }),
  })
  const text = await response.text()
  let json: Record<string, unknown> = {}
  try { json = text ? JSON.parse(text) as Record<string, unknown> : {} } catch { json = { error: text.slice(0, 200) } }
  if (!response.ok || json.success === false) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:keeper_ingest_${response.status}:${String(json.error ?? text).slice(0, 200)}`)
  }
  return (json.data && typeof json.data === 'object' ? json.data : json) as Record<string, unknown>
}
