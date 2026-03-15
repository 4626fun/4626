import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { bootstrapCanonicalDelegationState } from '../../../server/_lib/canonicalCswDelegation.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  ensureTelegramTradingSchema,
  isTelegramFunnelEventsEnabledForChat,
  logTelegramFunnelEvent,
  readTelegramLinkStartTokenStatus,
  upsertTelegramUserLink,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, resolveTelegramLinkErrorStatusCode } from './webhook/utils.js'

type LinkCompleteBody = {
  token?: string
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

  const body = (await readJsonBody<LinkCompleteBody>(req).catch(() => null)) ?? (req.body as LinkCompleteBody | null) ?? {}
  const token = asTrimmed(body.token ?? '')
  const tokenStatus = readTelegramLinkStartTokenStatus(token)
  if (!tokenStatus.ok) {
    const statusCode = tokenStatus.reason === 'expired' ? 410 : 400
    return res.status(statusCode).json({
      success: false,
      error:
        tokenStatus.reason === 'expired'
          ? 'Telegram link expired. Run /link in Telegram and open the new Mini App button.'
          : 'Invalid link token',
    } satisfies ApiEnvelope<never>)
  }
  const parsed = tokenStatus.payload
  const shouldEmitFunnelEvent = isTelegramFunnelEventsEnabledForChat(parsed.chatId)

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
    await ensureTelegramTradingSchema(db as any)

    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const link = await upsertTelegramUserLink({
      db: db as any,
      telegramUserId: parsed.telegramUserId,
      telegramUsername: asTrimmed(body.telegramUsername ?? '') || null,
      profileId: bootstrap.profileId,
      privyUserId: bootstrap.privyUserId,
      canonicalCswAddress: bootstrap.canonicalCswAddress,
      ownerVerified: bootstrap.privyIsOwner,
    })
    if (!link) {
      return res.status(500).json({ success: false, error: 'Failed to persist telegram link' } satisfies ApiEnvelope<never>)
    }

    if (shouldEmitFunnelEvent) {
      await logTelegramFunnelEvent({
        db: db as any,
        telegramUserId: parsed.telegramUserId,
        chatId: parsed.chatId,
        eventName: 'link_complete_success',
        actionType: 'link',
        context: { profileId: link.profileId, ownerVerified: link.ownerVerified, linkStatus: link.linkStatus },
      }).catch(() => {})
    }

    return res.status(200).json({
      success: true,
      data: {
        linked: link.linkStatus === 'active',
        telegramUserId: link.telegramUserId,
        chatId: parsed.chatId,
        profileId: link.profileId,
        privyUserId: link.privyUserId,
        canonicalCswAddress: link.canonicalCswAddress,
        ownerVerified: link.ownerVerified,
        linkStatus: link.linkStatus,
        linkedAt: link.linkedAt,
      },
    } satisfies ApiEnvelope<{
      linked: boolean
      telegramUserId: string
      chatId: string
      profileId: number
      privyUserId: string
      canonicalCswAddress: string
      ownerVerified: boolean
      linkStatus: string
      linkedAt: string | null
    }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete Telegram link'
    if (shouldEmitFunnelEvent) {
      await logTelegramFunnelEvent({
        db: db as any,
        telegramUserId: parsed.telegramUserId,
        chatId: parsed.chatId,
        eventName: 'link_complete_failed',
        actionType: 'link',
        context: { message },
      }).catch(() => {})
    }
    return res.status(resolveTelegramLinkErrorStatusCode(error)).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
