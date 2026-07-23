/** POST /api/keeper/solana/lottery-winner-settle — default-off winner readback worker. */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope, getDbForCron, handleOptions, isDbConfigured,
  readBoundedJsonObjectBody, requireKeeprApiKey, setCors, setNoStore,
} from '@4626/server-core'
import { processSolanaLotteryWinnerBatch } from '../../../server/_lib/onchain/solanaLotteryWinnerWorker.js'

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env.SOLANA_LOTTERY_WINNER_WORKER_ENABLED ?? '').trim().toLowerCase())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res); setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  if (!requireKeeprApiKey(req, res)) return
  if (!enabled()) return res.status(503).json({ success: false, error: 'solana_lottery_winner_worker_disabled' } satisfies ApiEnvelope<never>)
  if (!isDbConfigured()) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  const db = await getDbForCron()
  if (!db) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  const body = await readBoundedJsonObjectBody(req, { maxBytes: 4_096 })
  const limit = body && typeof body.limit === 'number' ? Math.max(1, Math.min(Math.floor(body.limit), 100)) : 25
  try {
    const result = await processSolanaLotteryWinnerBatch({ db: db as any, limit })
    return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    return res.status(500).json({ success: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 300) } satisfies ApiEnvelope<never>)
  }
}
