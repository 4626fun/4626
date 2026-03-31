import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import { trackTelegramLinkEvent } from '../../../server/_lib/telegramLinkTelemetry.js'
import {
  claimTelegramMiniAppReplayNonce,
  createTelegramMiniAppSession,
  ensureTelegramTradingSchema,
  findReusableTelegramMiniAppSession,
} from '../../../server/_lib/telegramTrading.js'

import { getTelegramWebhookConfig } from './webhook/config.js'
import { resolveTelegramMiniAppVerificationStatusCode, verifyTelegramMiniAppInitData } from './webhook/miniAppAuth.js'
import { isTelegramMiniAppSessionEnabled } from './webhook/services/access.js'
import { asTrimmed } from './webhook/utils.js'

type MiniAppSessionBody = {
  initData?: string
  flowId?: string | null
}

type MiniAppSessionData = {
  sessionToken: string
  expiresAt: string
  telegramUserId: string
  telegramUsername: string | null
  chatId: string | null
  chatType: string | null
  chatInstance: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const config = getTelegramWebhookConfig()
  const botToken = asTrimmed(config.botToken)
  if (!botToken) {
    return res.status(503).json({ success: false, error: 'Telegram bot is not configured' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<MiniAppSessionBody>(req).catch(() => null)) ?? (req.body as MiniAppSessionBody | null) ?? {}
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
  let reusedExistingSession = false
  if (!replayAccepted) {
    const reusable = await findReusableTelegramMiniAppSession({
      db: db as any,
      telegramUserId: identity.telegramUserId,
      chatId: identity.chatId,
      initDataHash: identity.initDataHash,
      authDate: identity.authDate,
    })
    if (!reusable) {
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
    reusedExistingSession = true
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
        reusedExistingSession,
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
      reusedExistingSession,
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
