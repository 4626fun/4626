import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  type ApiEnvelope,
  readJsonBody,
} from '@4626/server-core'

import type { TelegramUpdate } from './types.js'
import { extractUpdateMessage, normalizeMessageContext } from './updates/message.js'
import { asTrimmed } from './utils.js'
import { ingestProliquidSignalFromTelegram, readProliquidSignalConfig } from '../../../../server/_lib/alfaclub/proliquidSignals.js'

type ProliquidWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
  ingest?: {
    status: string
    reason?: string
    signalKind?: string
  }
}

export async function handleProliquidTelegramWebhookIngress(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const config = readProliquidSignalConfig()
  if (!config.enabled) {
    res.status(503).json({
      success: false,
      error: 'ProLiquid signals are disabled (PROLIQUID_SIGNALS_ENABLED)',
    } satisfies ApiEnvelope<never>)
    return
  }
  if (!config.webhookSecret) {
    res.status(503).json({
      success: false,
      error: 'ProLiquid webhook secret is not configured (PROLIQUID_SIGNALS_WEBHOOK_SECRET)',
    } satisfies ApiEnvelope<never>)
    return
  }

  const providedSecret = asTrimmed(req.headers?.['x-telegram-bot-api-secret-token'])
  if (providedSecret !== config.webhookSecret) {
    res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' } satisfies ApiEnvelope<never>)
    return
  }

  const limiter = checkRateLimit(
    rateLimitKey('proliquid-telegram-webhook', getClientIp(req)),
    RATE_LIMITS.telegramWebhookIngest,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
    return
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
    return
  }

  const message = extractUpdateMessage(update)
  const normalizedMessage = normalizeMessageContext(message)
  if (!normalizedMessage || normalizedMessage.fromBot) {
    res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies ProliquidWebhookOk,
    } satisfies ApiEnvelope<ProliquidWebhookOk>)
    return
  }

  const ingestResult = await ingestProliquidSignalFromTelegram({
    chatId: normalizedMessage.chatId,
    chatUsername: message?.chat?.username ?? null,
    messageId: normalizedMessage.messageId ?? null,
    messageThreadId:
      typeof message?.message_thread_id === 'number' && Number.isFinite(message.message_thread_id)
        ? message.message_thread_id
        : null,
    text: normalizedMessage.text,
    userId: normalizedMessage.userId,
    username: message?.from?.username ?? null,
    messageDateMs:
      typeof message?.date === 'number' && Number.isFinite(message.date) ? message.date * 1000 : null,
  })

  res.status(200).json({
    success: true,
    data: {
      ok: true,
      updateId: update.update_id ?? null,
      ingest:
        ingestResult.status === 'stored'
          ? { status: ingestResult.status, signalKind: ingestResult.signalKind }
          : 'reason' in ingestResult
            ? { status: ingestResult.status, reason: ingestResult.reason }
            : { status: ingestResult.status },
    } satisfies ProliquidWebhookOk,
  } satisfies ApiEnvelope<ProliquidWebhookOk>)
}
