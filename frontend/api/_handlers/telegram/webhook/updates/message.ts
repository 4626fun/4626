import type { VercelRequest, VercelResponse } from '@vercel/node'

import runtimeHandler from '../../_webhook.runtime.js'
import type { TelegramWebhookConfig } from '../config.js'
import type { TelegramMessage, TelegramUpdate } from '../types.js'
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

export function extractUpdateMessage(update: TelegramUpdate): TelegramMessage | null {
  const m = update?.message
  if (m && typeof m === 'object') return m
  const em = update?.edited_message
  if (em && typeof em === 'object') return em
  const cp = update?.channel_post
  if (cp && typeof cp === 'object') return cp
  return null
}

export function normalizeMessageContext(message: TelegramMessage | null): {
  text: string
  chatId: string
  userId: string
  messageId?: number
  fromBot: boolean
} | null {
  if (!message) return null
  const text = asTrimmed(message.text ?? message.caption ?? '')
  const chatId = String(message.chat?.id ?? '').trim()
  const userId = String(message.from?.id ?? '').trim()
  const messageId = typeof message.message_id === 'number' ? message.message_id : undefined
  const fromBot = message.from?.is_bot === true
  if (!chatId) return null
  return { text, chatId, userId, messageId, fromBot }
}
