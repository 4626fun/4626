import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  createTelegramLinkStartToken,
  ensureTelegramTradingSchema,
  isTelegramFunnelEventsEnabledForChat,
  logTelegramFunnelEvent,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { buildTelegramLinkSwapNextPath, buildTelegramMiniAppUrl, resolveTelegramMiniAppUrl } from './webhook/miniApp.js'
import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, readTelegramChatId, readTelegramUserId } from './webhook/utils.js'

type LinkStartBody = {
  telegramUserId?: string | number
  chatId?: string | number
  telegramUsername?: string | null
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

  const body = (await readJsonBody<LinkStartBody>(req).catch(() => null)) ?? (req.body as LinkStartBody | null) ?? {}
  const telegramUserId = readTelegramUserId(body.telegramUserId)
  const chatId = readTelegramChatId(body.chatId)
  if (!telegramUserId || !chatId) {
    return res.status(400).json({ success: false, error: 'telegramUserId and chatId are required' } satisfies ApiEnvelope<never>)
  }

  const token = createTelegramLinkStartToken({ telegramUserId, chatId, ttlSeconds: 60 * 15 })

  const nextPath = buildTelegramLinkSwapNextPath({ token: token.token, chatId, telegramUsername: body.telegramUsername })
  const url = buildTelegramMiniAppUrl({
    baseUrl: resolveTelegramMiniAppUrl(),
    pathname: '/continue',
    query: { from: 'waitlist', autologin: '1', auth: 'wallet', next: nextPath },
  })

  const shouldEmitFunnelEvent = isTelegramFunnelEventsEnabledForChat(chatId)
  if (shouldEmitFunnelEvent) {
    const db = await getDb().catch(() => null)
    if (db) {
      await ensureWaitlistSchema(db as any).catch(() => {})
      await ensureTelegramTradingSchema(db as any).catch(() => {})
      await logTelegramFunnelEvent({
        db: db as any,
        telegramUserId,
        chatId,
        eventName: 'link_start',
        actionType: 'link',
        context: { hasUsername: Boolean(asTrimmed(body.telegramUsername ?? '')) },
      }).catch(() => {})
    }
  }

  return res.status(200).json({
    success: true,
    data: { url, expiresAt: token.expiresAt, telegramUserId, chatId },
  } satisfies ApiEnvelope<{
    url: string
    expiresAt: string
    telegramUserId: string
    chatId: string
  }>)
}
