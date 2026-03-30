import type { TelegramMessage, TelegramUpdate } from '../types.js'
import { asTrimmed, readTelegramChatId, readTelegramUserId } from '../utils.js'

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

export function extractSharedSelection(message: TelegramMessage | null):
  | {
      kind: 'users'
      requestId: number | null
      users: Array<{
        userId: string
        firstName: string
        lastName: string
        username: string
      }>
    }
  | {
      kind: 'chat'
      requestId: number | null
      chatId: string
      title: string
      username: string
    }
  | null {
  if (!message) return null

  const usersShared = message.users_shared
  if (usersShared && Array.isArray(usersShared.users)) {
    const users = usersShared.users
      .map((entry) => {
        const userId = readTelegramUserId(entry?.user_id)
        if (!userId) return null
        return {
          userId,
          firstName: asTrimmed(entry?.first_name ?? ''),
          lastName: asTrimmed(entry?.last_name ?? ''),
          username: asTrimmed(entry?.username ?? ''),
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    if (users.length > 0) {
      return {
        kind: 'users',
        requestId: typeof usersShared.request_id === 'number' ? usersShared.request_id : null,
        users,
      }
    }
  }

  const chatShared = message.chat_shared
  if (chatShared) {
    const chatId = readTelegramChatId(chatShared.chat_id)
    if (!chatId) return null
    return {
      kind: 'chat',
      requestId: typeof chatShared.request_id === 'number' ? chatShared.request_id : null,
      chatId,
      title: asTrimmed(chatShared.title ?? ''),
      username: asTrimmed(chatShared.username ?? ''),
    }
  }

  return null
}
