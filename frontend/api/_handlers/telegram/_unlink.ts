import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import { ensureTelegramTradingSchema, getTelegramLinkByUserId, revokeTelegramLink } from '../../../server/_lib/telegramTrading.js'
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, readTelegramUserId } from './webhook/utils.js'

type UnlinkBody = {
  telegramUserId?: string | number
  reason?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(
    rateLimitKey('telegram-unlink', getClientIp(req)),
    RATE_LIMITS.telegramAdminWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!verifyTelegramLinkApiSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<UnlinkBody>(req, { maxBytes: 8_192 }).catch(() => null)) ?? (req.body as UnlinkBody | null) ?? {}
  const telegramUserId = readTelegramUserId(body.telegramUserId)
  if (!telegramUserId) {
    return res.status(400).json({ success: false, error: 'telegramUserId is required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)
  await ensureTelegramTradingSchema(db as any)

  const before = await getTelegramLinkByUserId({
    db: db as any,
    telegramUserId,
  })
  if (!before) {
    return res.status(200).json({
      success: true,
      data: {
        telegramUserId,
        revoked: false,
        status: 'not_linked',
      },
    } satisfies ApiEnvelope<{
      telegramUserId: string
      revoked: boolean
      status: string
    }>)
  }

  const result = await revokeTelegramLink({
    db: db as any,
    telegramUserId,
    reason: asTrimmed(body.reason) || 'api_unlink',
  })
  return res.status(200).json({
    success: true,
    data: {
      telegramUserId,
      revoked: result.revoked,
      status: result.link?.linkStatus ?? 'unknown',
      canonicalCswAddress: result.link?.canonicalCswAddress ?? before.canonicalCswAddress,
    },
  } satisfies ApiEnvelope<{
    telegramUserId: string
    revoked: boolean
    status: string
    canonicalCswAddress: string | null
  }>)
}
