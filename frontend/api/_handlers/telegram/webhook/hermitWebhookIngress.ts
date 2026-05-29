/**
 * Hermit bot (ALFACLUB_TELEGRAM_BOT_TOKEN) ingress at hermit.4626.fun.
 * Relay-only: posts configured group/topic messages into AlfaClub, no akitai_bot command stack.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, readJsonBody } from '@4626/server-core'

import type { TelegramUpdate } from './types.js'
import { extractUpdateMessage, normalizeMessageContext } from './updates/message.js'
import { readHermitTelegramBotToken, readHermitTelegramWebhookSecret } from './ingress.js'
import { asTrimmed } from './utils.js'

type HermitWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
  alfaclubRelay?: { roomId: string; lane: string }
}

export async function handleHermitTelegramWebhookIngress(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const configuredSecret = readHermitTelegramWebhookSecret()
  if (!configuredSecret) {
    res.status(503).json({
      success: false,
      error: 'Hermit Telegram webhook secret is not configured (ALFACLUB_TELEGRAM_WEBHOOK_SECRET)',
    } satisfies ApiEnvelope<never>)
    return
  }

  const providedSecret = asTrimmed(req.headers?.['x-telegram-bot-api-secret-token'])
  if (providedSecret !== configuredSecret) {
    res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' } satisfies ApiEnvelope<never>)
    return
  }

  if (!readHermitTelegramBotToken()) {
    res.status(503).json({
      success: false,
      error: 'Hermit Telegram bot is not configured (ALFACLUB_TELEGRAM_BOT_TOKEN)',
    } satisfies ApiEnvelope<never>)
    return
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
    return
  }

  const message = extractUpdateMessage(update)
  const normalizedMessage = normalizeMessageContext(message)
  if (!normalizedMessage) {
    res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies HermitWebhookOk,
    } satisfies ApiEnvelope<HermitWebhookOk>)
    return
  }

  const { chatId, userId, fromBot, messageId } = normalizedMessage
  if (fromBot) {
    res.status(200).json({
      success: true,
      data: { ok: true, ignored: true, updateId: update.update_id ?? null } satisfies HermitWebhookOk,
    } satisfies ApiEnvelope<HermitWebhookOk>)
    return
  }

  const relayText = asTrimmed(message?.text ?? message?.caption ?? '')
  const relayThreadId =
    typeof message?.message_thread_id === 'number' && Number.isFinite(message.message_thread_id)
      ? message.message_thread_id
      : null

  try {
    const { relayTelegramMessageToAlfaClub } = await import(
      '../../../../server/_lib/alfaclub/telegramToAlfaclubRelay.js'
    )
    const relayResult = await relayTelegramMessageToAlfaClub({
      chatId,
      messageId,
      messageThreadId: relayThreadId,
      text: relayText,
      username: message?.from?.username ?? null,
      userId,
    })
    if (relayResult.status === 'relayed') {
      res.status(200).json({
        success: true,
        data: {
          ok: true,
          updateId: update.update_id ?? null,
          alfaclubRelay: { roomId: relayResult.roomId, lane: relayResult.lane },
        } satisfies HermitWebhookOk,
      } satisfies ApiEnvelope<HermitWebhookOk>)
      return
    }
    res.status(200).json({
      success: true,
      data: {
        ok: true,
        ignored: true,
        updateId: update.update_id ?? null,
      } satisfies HermitWebhookOk,
    } satisfies ApiEnvelope<HermitWebhookOk>)
  } catch (relayError) {
    console.warn('[telegram/webhook/hermit] alfaclub relay failed', {
      updateId: update.update_id ?? null,
      chatId,
      err: relayError instanceof Error ? relayError.message : String(relayError),
    })
    res.status(500).json({
      success: false,
      error: 'Hermit relay failed',
    } satisfies ApiEnvelope<never>)
  }
}
