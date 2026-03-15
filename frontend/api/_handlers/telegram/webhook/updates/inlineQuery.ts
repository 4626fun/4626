import type { VercelRequest, VercelResponse } from '@vercel/node'

import runtimeHandler from '../../_webhook.runtime.js'
import type { TelegramWebhookConfig } from '../config.js'
import type { TelegramUpdate } from '../types.js'
import type { TelegramInlineQuery, TelegramWebhookOk } from '../types.js'
import { asTrimmed } from '../utils.js'

export async function handle(
  req: VercelRequest,
  res: VercelResponse,
  update: TelegramUpdate,
  _config: TelegramWebhookConfig,
) {
  ;(req as any).body = update
  return runtimeHandler(req, res)
}

export async function handleInlineQueryUpdate(params: {
  updateId?: number
  inlineQuery: TelegramInlineQuery | null | undefined
  botToken: string
  targetChatId: string
  answerInlineQuery: (args: {
    botToken: string
    inlineQueryId: string
    query: string
    queryOffset: string
    chatType: string
    userId: string
    chatId: string
  }) => Promise<void>
  onError?: (error: unknown, meta: { updateId: number | null; inlineQueryId: string }) => void
}): Promise<TelegramWebhookOk | null> {
  const inlineQuery = params.inlineQuery
  if (!inlineQuery || typeof inlineQuery !== 'object') return null

  const inlineQueryId = String(inlineQuery.id ?? '').trim()
  if (!inlineQueryId) {
    return { ok: true, ignored: true, updateId: params.updateId ?? null }
  }

  try {
    await params.answerInlineQuery({
      botToken: params.botToken,
      inlineQueryId,
      query: asTrimmed(inlineQuery.query ?? ''),
      queryOffset: asTrimmed(inlineQuery.offset ?? ''),
      chatType: asTrimmed(inlineQuery.chat_type ?? ''),
      userId: String(inlineQuery.from?.id ?? '').trim(),
      chatId: params.targetChatId,
    })
  } catch (error) {
    params.onError?.(error, { updateId: params.updateId ?? null, inlineQueryId })
  }

  return { ok: true, updateId: params.updateId ?? null }
}
