import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import {
  ensureTelegramTradingSchema,
  getTelegramPortfolioSummary,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { readQueryString } from './webhook/utils.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!verifyTelegramLinkApiSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const telegramUserId = readQueryString(req, 'telegramUserId')
  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return res.status(400).json({ success: false, error: 'telegramUserId is required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)
  await ensureTelegramTradingSchema(db as any)

  const summary = await getTelegramPortfolioSummary({
    db: db as any,
    telegramUserId,
    recentLimit: 10,
  })
  return res.status(200).json({
    success: true,
    data: summary,
  } satisfies ApiEnvelope<Awaited<ReturnType<typeof getTelegramPortfolioSummary>>>)
}

