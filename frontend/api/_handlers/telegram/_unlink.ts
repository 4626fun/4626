import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  ensureTelegramTradingSchema,
  getTelegramLinkByUserId,
  revokeTelegramLink,
} from '@4626/server-core'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, readTelegramUserId } from './webhook/utils.js'

type UnlinkBody = {
  telegramUserId?: string | number
  reason?: string
}
const TELEGRAM_UNLINK_MAX_BODY_BYTES = 8_192

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

  let body: UnlinkBody
  try {
    body = (await readBoundedJsonObjectBody<UnlinkBody>(req, { maxBytes: TELEGRAM_UNLINK_MAX_BODY_BYTES })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
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
