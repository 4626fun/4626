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
  trackTelegramLinkEvent,
  claimTelegramMiniAppReplayNonce,
  createTelegramMiniAppSession,
  ensureTelegramTradingSchema,
} from '@4626/server-core'

import { getTelegramWebhookConfig } from './webhook/config.js'
import { resolveTelegramMiniAppVerificationStatusCode, verifyTelegramMiniAppInitData } from './webhook/miniAppAuth.js'
import { isTelegramMiniAppSessionEnabled } from './webhook/services/access.js'
import { asTrimmed } from './webhook/utils.js'

type MiniAppSessionBody = {
  initData?: string
  flowId?: string | null
}
const MINIAPP_SESSION_MAX_BODY_BYTES = 16_384

type MiniAppSessionData = {
  sessionToken: string
  expiresAt: string
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
}

type MiniAppSessionErrorEnvelope = ApiEnvelope<never> & {
  code?: string
  hint?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('telegram-miniapp-session', getClientIp(req)),
    RATE_LIMITS.telegramLinkWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const config = getTelegramWebhookConfig()
  const botToken = asTrimmed(config.botToken)
  if (!botToken) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId: '',
      phase: 'verify_telegram_session',
      status: 'failed',
      payload: {
        reason: 'bot_not_configured',
        code: 'TELEGRAM_BOT_NOT_CONFIGURED',
        hint: 'Set TELEGRAM_BOT_TOKEN on the server and redeploy.',
      },
    })
    return res.status(503).json({
      success: false,
      error: 'Telegram bot is not configured',
      code: 'TELEGRAM_BOT_NOT_CONFIGURED',
      hint: 'Set TELEGRAM_BOT_TOKEN on the server and redeploy.',
    } satisfies MiniAppSessionErrorEnvelope)
  }

  let body: MiniAppSessionBody
  try {
    body = (await readBoundedJsonObjectBody<MiniAppSessionBody>(req, { maxBytes: MINIAPP_SESSION_MAX_BODY_BYTES })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const initData = asTrimmed(body.initData ?? '')
  const flowId = asTrimmed(body.flowId ?? '')
  const verified = verifyTelegramMiniAppInitData({
    initData,
    botToken,
    maxAgeSeconds: config.miniAppInitDataMaxAgeSeconds,
  })
  if (!verified.ok) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId,
      phase: 'verify_telegram_session',
      status: 'failed',
      payload: {
        reason: verified.reason,
      },
    })
    return res.status(resolveTelegramMiniAppVerificationStatusCode(verified.reason)).json({
      success: false,
      error: `telegram_miniapp_${verified.reason}`,
    } satisfies ApiEnvelope<never>)
  }
  const identity = verified.identity

  if (
    !isTelegramMiniAppSessionEnabled({
      chatId: identity.chatId,
      userId: identity.telegramUserId,
    })
  ) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId,
      phase: 'verify_telegram_session',
      status: 'failed',
      telegramUserId: identity.telegramUserId,
      chatId: identity.chatId,
      payload: {
        reason: 'session_disabled',
      },
    })
    return res.status(403).json({ success: false, error: 'telegram_miniapp_session_disabled' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId,
      phase: 'verify_telegram_session',
      status: 'failed',
      telegramUserId: identity.telegramUserId,
      chatId: identity.chatId,
      payload: {
        reason: 'db_unavailable',
      },
    })
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureTelegramTradingSchema(db as any)

  const replayAccepted = await claimTelegramMiniAppReplayNonce({
    db: db as any,
    initDataHash: identity.initDataHash,
    telegramUserId: identity.telegramUserId,
    authDate: identity.authDate,
    ttlSeconds: config.miniAppReplayTtlSeconds,
  })
  if (!replayAccepted) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId,
      phase: 'verify_telegram_session',
      status: 'failed',
      telegramUserId: identity.telegramUserId,
      chatId: identity.chatId,
      payload: {
        reason: 'replay_detected',
        replayAccepted: false,
      },
    })
    return res.status(409).json({ success: false, error: 'telegram_miniapp_replay_detected' } satisfies ApiEnvelope<never>)
  }

  const created = await createTelegramMiniAppSession({
    db: db as any,
    telegramUserId: identity.telegramUserId,
    telegramUsername: identity.telegramUsername,
    chatId: identity.chatId,
    chatType: identity.chatType,
    chatInstance: identity.chatInstance,
    initDataHash: identity.initDataHash,
    authDate: identity.authDate,
    ttlSeconds: config.miniAppSessionTtlSeconds,
  })
  if (!created) {
    await trackTelegramLinkEvent({
      event: 'telegram_link_miniapp_session_result',
      source: 'telegram-miniapp-session',
      flowId,
      phase: 'verify_telegram_session',
      status: 'failed',
      telegramUserId: identity.telegramUserId,
      chatId: identity.chatId,
      payload: {
        reason: 'session_create_failed',
        replayAccepted,
      },
    })
    return res.status(500).json({ success: false, error: 'telegram_miniapp_session_create_failed' } satisfies ApiEnvelope<never>)
  }

  await trackTelegramLinkEvent({
    event: 'telegram_link_miniapp_session_result',
    source: 'telegram-miniapp-session',
    flowId,
    phase: 'verify_telegram_session',
    status: 'succeeded',
    telegramUserId: identity.telegramUserId,
    chatId: identity.chatId,
    payload: {
      replayAccepted,
    },
  })

  return res.status(200).json({
    success: true,
    data: {
      sessionToken: created.sessionToken,
      expiresAt: created.expiresAt,
      telegramUserId: identity.telegramUserId,
      telegramUsername: identity.telegramUsername,
      chatId: identity.chatId,
      chatType: identity.chatType,
      chatInstance: identity.chatInstance,
    } satisfies MiniAppSessionData,
  } satisfies ApiEnvelope<MiniAppSessionData>)
}
