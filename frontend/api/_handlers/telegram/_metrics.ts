import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import {
  ensureTelegramTradingSchema,
  getTelegramFunnelMetrics,
  isTelegramFunnelMetricsEnabled,
  isTelegramFunnelMetricsEnabledForChat,
} from '../../../server/_lib/telegramTrading.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { parseWindowHours, readQueryString } from './webhook/utils.js'

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
  if (!isTelegramFunnelMetricsEnabled()) {
    return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<never>)
  }

  const chatId = readQueryString(req, 'chatId')
  if (!isTelegramFunnelMetricsEnabledForChat(chatId)) {
    return res.status(403).json({ success: false, error: 'Chat is not in metrics rollout cohort' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)
  await ensureTelegramTradingSchema(db as any)

  const windowHours = parseWindowHours(readQueryString(req, 'windowHours'))
  const metrics = await getTelegramFunnelMetrics({
    db: db as any,
    chatId,
    windowHours,
  })
  return res.status(200).json({
    success: true,
    data: metrics,
  } satisfies ApiEnvelope<Awaited<ReturnType<typeof getTelegramFunnelMetrics>>>)
}
