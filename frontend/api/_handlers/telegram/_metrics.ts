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

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readQueryString(req: VercelRequest, key: string): string | null {
  const value = req.query?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return null
}

function verifyTelegramLinkApiSecret(req: VercelRequest): boolean {
  const configured = asTrimmed(process.env.TELEGRAM_LINK_API_SECRET)
  if (!configured) return true
  const provided = asTrimmed(req.headers['x-telegram-link-secret'])
  return provided === configured
}

function parseWindowHours(raw: string | null): number {
  const parsed = Number(raw ?? '')
  if (!Number.isFinite(parsed) || parsed <= 0) return 24
  return Math.floor(parsed)
}

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
