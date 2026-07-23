import { SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE } from '../utils/solanaLotteryLzTransport.js'

function baseUrl(): string {
  return String(process.env.KPR_API_BASE_URL ?? process.env.KEEPR_API_BASE_URL ?? 'https://app.4626.fun/api').trim().replace(/\/$/, '')
}

export async function executeSolanaLotteryWinnerSettle(payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const key = String(process.env.KPR_API_KEY ?? process.env.KEEPR_API_KEY ?? '').trim()
  if (!key) throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:missing_kpr_api_key`)
  const limit = typeof payload.limit === 'number' && Number.isFinite(payload.limit) ? Math.max(1, Math.min(Math.floor(payload.limit), 100)) : 25
  const response = await fetch(`${baseUrl()}/keeper/solana/lottery-winner-settle`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ limit }),
  })
  const text = await response.text()
  let json: Record<string, unknown> = {}
  try { json = text ? JSON.parse(text) as Record<string, unknown> : {} } catch { json = { error: text.slice(0, 200) } }
  if (!response.ok || json.success === false) throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:winner_settle_${response.status}:${String(json.error ?? text).slice(0, 200)}`)
  return (json.data && typeof json.data === 'object' ? json.data : json) as Record<string, unknown>
}
