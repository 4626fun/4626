import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureTelegramTradingSchema, getTelegramLinkStatus } from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

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

  const link = await getTelegramLinkStatus({
    db: db as any,
    telegramUserId,
  })
  return res.status(200).json({
    success: true,
    data: {
      linked: Boolean(link && link.linkStatus === 'active'),
      linkStatus: link?.linkStatus ?? 'none',
      ownerVerified: link?.ownerVerified ?? false,
      canonicalCswAddress: link?.canonicalCswAddress ?? null,
      profileId: link?.profileId ?? null,
      linkedAt: link?.linkedAt ?? null,
    },
  } satisfies ApiEnvelope<{
    linked: boolean
    linkStatus: string
    ownerVerified: boolean
    canonicalCswAddress: string | null
    profileId: number | null
    linkedAt: string | null
  }>)
}

