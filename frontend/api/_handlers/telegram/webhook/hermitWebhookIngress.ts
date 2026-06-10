/**
 * Hermit bot (HERMIT_TELEGRAM_BOT_TOKEN) ingress at hermit.4626.fun.
 *
 * - Group/topic messages: relayed into the configured AlfaClub room.
 * - Private DMs: answered directly through the deterministic command stack
 *   (room-scoped Hermit context, e.g. room 1659 market awareness) — see hermitDm.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, readJsonBody } from '@4626/server-core'

import type { TelegramUpdate } from './types.js'
import { extractUpdateMessage, normalizeMessageContext } from './updates/message.js'
import { readHermitTelegramBotToken, readHermitTelegramWebhookSecret } from './ingress.js'
import { isPrivateChatId } from './env.js'
import { handleHermitTelegramDm } from './hermitDm.js'
import { asTrimmed } from './utils.js'

type HermitWebhookOk = {
  ok: true
  ignored?: boolean
  updateId?: number | null
  alfaclubRelay?: { roomId: string; lane: string }
  dm?: { status: string; roomId?: string | null }
}

export async function handleHermitTelegramWebhookIngress(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const configuredSecret = readHermitTelegramWebhookSecret()
  if (!configuredSecret) {
    res.status(503).json({
      success: false,
      error: 'Hermit Telegram webhook secret is not configured (HERMIT_TELEGRAM_WEBHOOK_SECRET)',
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
      error: 'Hermit Telegram bot is not configured (HERMIT_TELEGRAM_BOT_TOKEN)',
    } satisfies ApiEnvelope<never>)
    return
  }

  const update = await readJsonBody<TelegramUpdate>(req, { maxBytes: 512_000 })
  if (!update) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
    return
  }

  // DM replies append a 🗑 dismiss button; honor it on this lane too.
  const callbackQuery = update.callback_query
  if (callbackQuery && typeof callbackQuery === 'object') {
    const callbackData = asTrimmed(callbackQuery.data ?? '').toLowerCase()
    const callbackQueryId = asTrimmed(String(callbackQuery.id ?? ''))
    const callbackChatId = String(callbackQuery.message?.chat?.id ?? '').trim()
    const callbackMessageId =
      typeof callbackQuery.message?.message_id === 'number' ? callbackQuery.message.message_id : null
    if (
      callbackQueryId &&
      callbackChatId &&
      (callbackData === 'message:delete' || callbackData.startsWith('message:delete:'))
    ) {
      const botToken = readHermitTelegramBotToken()
      const [{ answerTelegramCallbackQuery }, { deleteTelegramMessage }] = await Promise.all([
        import('./telegramApi/interactions.js'),
        import('./telegramApi/messaging.js'),
      ])
      await answerTelegramCallbackQuery({ botToken, callbackQueryId, text: 'Deleted' }).catch(() => {})
      if (typeof callbackMessageId === 'number') {
        await deleteTelegramMessage({ botToken, chatId: callbackChatId, messageId: callbackMessageId }).catch(
          () => {},
        )
      }
    }
    res.status(200).json({
      success: true,
      data: { ok: true, updateId: update.update_id ?? null } satisfies HermitWebhookOk,
    } satisfies ApiEnvelope<HermitWebhookOk>)
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

  if (isPrivateChatId(chatId)) {
    try {
      const dmResult = await handleHermitTelegramDm({
        botToken: readHermitTelegramBotToken(),
        chatId,
        userId,
        ...(typeof messageId === 'number' ? { messageId } : {}),
        text: asTrimmed(message?.text ?? message?.caption ?? ''),
      })
      if (dmResult.status === 'failed') {
        console.warn('[telegram/webhook/hermit] dm reply failed', {
          updateId: update.update_id ?? null,
          chatId,
          err: dmResult.error,
        })
      }
      res.status(200).json({
        success: true,
        data: {
          ok: true,
          ...(dmResult.status === 'replied' ? {} : { ignored: true }),
          updateId: update.update_id ?? null,
          dm: {
            status: dmResult.status,
            ...(dmResult.status === 'replied' ? { roomId: dmResult.roomId } : {}),
          },
        } satisfies HermitWebhookOk,
      } satisfies ApiEnvelope<HermitWebhookOk>)
    } catch (dmError) {
      console.warn('[telegram/webhook/hermit] dm handling crashed', {
        updateId: update.update_id ?? null,
        chatId,
        err: dmError instanceof Error ? dmError.message : String(dmError),
      })
      res.status(200).json({
        success: true,
        data: {
          ok: true,
          ignored: true,
          updateId: update.update_id ?? null,
          dm: { status: 'failed' },
        } satisfies HermitWebhookOk,
      } satisfies ApiEnvelope<HermitWebhookOk>)
    }
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
