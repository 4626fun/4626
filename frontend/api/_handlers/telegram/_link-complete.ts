import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { bootstrapCanonicalDelegationState } from '../../../server/_lib/canonicalCswDelegation.js'
import { getDb } from '../../../server/_lib/postgres.js'
import {
  readTelegramMiniAppSession,
  ensureTelegramTradingSchema,
  isTelegramFunnelEventsEnabledForChat,
  logTelegramFunnelEvent,
  readTelegramLinkStartTokenStatus,
  runTelegramMergePreflight,
  upsertTelegramUserLink,
} from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

import { readTelegramMiniAppSessionToken } from './webhook/miniAppAuth.js'
import { isTelegramMiniAppSessionEnabled, verifyTelegramLinkApiSecret } from './webhook/services/access.js'
import { asTrimmed, resolveTelegramLinkErrorStatusCode } from './webhook/utils.js'

type LinkCompleteBody = {
  token?: string
  telegramUsername?: string | null
  miniAppSessionToken?: string
  sessionToken?: string
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
  const miniAppSessionRequired = isTelegramMiniAppSessionEnabled({
    chatId: parsed.chatId,
    userId: parsed.telegramUserId,
  })

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
    await ensureTelegramTradingSchema(db as any)

    if (miniAppSessionRequired) {
      const miniAppSessionToken = readTelegramMiniAppSessionToken({
        req,
        bodyToken: asTrimmed(body.miniAppSessionToken ?? body.sessionToken ?? ''),
      })
      if (!miniAppSessionToken) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session token is required. Re-open the Mini App from Telegram and retry.',
        } satisfies ApiEnvelope<never>)
      }
      const miniAppSession = await readTelegramMiniAppSession({
        db: db as any,
        sessionToken: miniAppSessionToken,
      })
      if (!miniAppSession.ok) {
        const isExpired = miniAppSession.reason === 'expired'
        return res.status(isExpired ? 410 : 401).json({
          success: false,
          error: isExpired
            ? 'Telegram Mini App session expired. Re-open the Mini App from Telegram and retry.'
            : 'Invalid Telegram Mini App session. Re-open the Mini App from Telegram and retry.',
        } satisfies ApiEnvelope<never>)
      }
      if (miniAppSession.session.telegramUserId !== parsed.telegramUserId) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session user mismatch. Start /link again from Telegram.',
        } satisfies ApiEnvelope<never>)
      }
      if (miniAppSession.session.chatId && miniAppSession.session.chatId !== parsed.chatId) {
        return res.status(401).json({
          success: false,
          error: 'Telegram Mini App session chat mismatch. Start /link again from Telegram.',
        } satisfies ApiEnvelope<never>)
      }
    }

    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const mergePreflight = await runTelegramMergePreflight({
      db: db as any,
      telegramUserId: parsed.telegramUserId,
      privyUserId: bootstrap.privyUserId,
    })
    if (!mergePreflight.ok) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this Telegram account is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_TELEGRAM_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }

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
    if ((error as any)?.code === 'IDENTITY_RECOVERY_REQUIRED') {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this Telegram account is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_TELEGRAM_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }
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
