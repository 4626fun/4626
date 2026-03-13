import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureTelegramTradingSchema, getTelegramLinkByUserId, revokeTelegramLink } from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type UnlinkBody = {
  telegramUserId?: string | number
  reason?: string
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTelegramUserId(body: UnlinkBody): string | null {
  const raw = typeof body.telegramUserId === 'number' ? String(Math.trunc(body.telegramUserId)) : asTrimmed(body.telegramUserId)
  if (!/^\d+$/.test(raw)) return null
  return raw
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!verifyTelegramLinkApiSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<UnlinkBody>(req).catch(() => null)) ?? (req.body as UnlinkBody | null) ?? {}
  const telegramUserId = readTelegramUserId(body)
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
    canonicalCswAddress: string
  }>)
}

