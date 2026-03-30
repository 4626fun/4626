import type { TelegramCallbackQuery } from '../types.js'
import { asTrimmed } from '../utils.js'

export function normalizeCallbackQuery(callbackQuery: TelegramCallbackQuery | null | undefined): {
  callbackQueryId: string
  callbackData: string
  chatId?: string
  callbackMessageId?: number
  inlineMessageId?: string
  userId: string
} | null {
  if (!callbackQuery || typeof callbackQuery !== 'object') return null
  const callbackQueryId = String(callbackQuery.id ?? '').trim()
  const callbackData = asTrimmed(callbackQuery.data ?? '')
  const callbackMessage = callbackQuery.message && typeof callbackQuery.message === 'object' ? callbackQuery.message : null
  const chatId = String(callbackMessage?.chat?.id ?? '').trim()
  const callbackMessageId = typeof callbackMessage?.message_id === 'number' ? callbackMessage.message_id : undefined
  const inlineMessageId = asTrimmed(callbackQuery.inline_message_id ?? '')
  const userId = String(callbackQuery.from?.id ?? '').trim()
  if (!callbackQueryId || (!chatId && !inlineMessageId)) return null
  return {
    callbackQueryId,
    callbackData,
    ...(chatId ? { chatId } : {}),
    ...(typeof callbackMessageId === 'number' ? { callbackMessageId } : {}),
    ...(inlineMessageId ? { inlineMessageId } : {}),
    userId,
  }
}
