import { asTrimmed } from '../utils.js'

/**
 * Logical Telegram chat-member role used for authorization of setup commands.
 * Intentionally narrower than the raw Telegram status strings:
 *   - 'admin'   = Telegram 'creator' or 'administrator'
 *   - 'member'  = any other known non-admin status ('member', 'restricted', 'left', 'kicked')
 *   - 'unknown' = getChatMember failed or returned a status we did not recognize
 *
 * Callers MUST fail closed on 'unknown' (refuse the action, do not allow).
 */
export type TelegramChatMemberRole = 'admin' | 'member' | 'unknown'

/**
 * Telegram's well-known ID for the GroupAnonymousBot. When a group admin posts
 * anonymously, `from.id` is this constant instead of a real user id. We treat
 * any message attributed to this id as coming from an admin.
 * https://core.telegram.org/bots/api#message
 */
export const TELEGRAM_GROUP_ANONYMOUS_BOT_ID = '1087968824'

export async function createTelegramHolderRoomInviteLink(params: {
  botToken: string
  roomChatId: string
  ttlSeconds?: number
}): Promise<string | null> {
  const endpoint = `https://api.telegram.org/bot${params.botToken}/createChatInviteLink`
  const ttl = Math.max(60, Math.min(3600, Math.floor(Number(params.ttlSeconds ?? 60 * 10))))
  const payload: Record<string, unknown> = {
    chat_id: params.roomChatId,
    member_limit: 1,
    creates_join_request: false,
    expire_date: Math.floor(Date.now() / 1000) + ttl,
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`telegram_create_invite_failed_${response.status}:${details.slice(0, 180)}`)
  }
  const body = (await response.json().catch(() => null)) as any
  const inviteLink = asTrimmed(body?.result?.invite_link ?? '')
  return inviteLink || null
}

export async function readTelegramChatMemberStatus(params: {
  botToken: string
  chatId: string
  userId: string
}): Promise<string | null> {
  if (!params.botToken) return null
  const endpoint = `https://api.telegram.org/bot${params.botToken}/getChatMember`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      user_id: params.userId,
    }),
  })
  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as any
  const status = asTrimmed(payload?.result?.status ?? '').toLowerCase()
  return status || null
}

type CachedRole = { role: TelegramChatMemberRole; expiresAt: number }
const ROLE_CACHE_TTL_MS = 60 * 1000
const roleCache = new Map<string, CachedRole>()

function roleCacheKey(chatId: string, userId: string): string {
  return `${chatId}::${userId}`
}

/** Test-only: clears the in-memory role cache. */
export function __resetTelegramChatMemberRoleCache(): void {
  roleCache.clear()
}

/**
 * Read the logical admin/member role of a user in a chat, with a 60s TTL cache.
 *
 * Returns:
 *   - 'admin' for Telegram status 'creator' or 'administrator'
 *   - 'admin' if userId === TELEGRAM_GROUP_ANONYMOUS_BOT_ID (anonymous admin)
 *   - 'member' for any other known status
 *   - 'unknown' if botToken is missing, inputs are empty, or getChatMember failed
 *
 * Callers must fail closed on 'unknown'.
 */
export async function readTelegramChatMemberRole(params: {
  botToken: string
  chatId: string
  userId: string
  now?: () => number
  fetchStatus?: (args: { botToken: string; chatId: string; userId: string }) => Promise<string | null>
}): Promise<TelegramChatMemberRole> {
  const chatId = asTrimmed(params.chatId)
  const userId = asTrimmed(params.userId)
  if (!params.botToken || !chatId || !userId) return 'unknown'

  // Anonymous admin short-circuit — no network call needed.
  if (userId === TELEGRAM_GROUP_ANONYMOUS_BOT_ID) return 'admin'

  const now = params.now ?? Date.now
  const key = roleCacheKey(chatId, userId)
  const cached = roleCache.get(key)
  if (cached && cached.expiresAt > now()) return cached.role

  const fetchStatus = params.fetchStatus ?? readTelegramChatMemberStatus
  const status = await fetchStatus({ botToken: params.botToken, chatId, userId })

  let role: TelegramChatMemberRole
  if (status === 'creator' || status === 'administrator') {
    role = 'admin'
  } else if (status === null) {
    role = 'unknown'
  } else {
    role = 'member'
  }

  // Only cache deterministic outcomes. 'unknown' reflects a transient failure
  // (bad token, network, 429) — do NOT cache, so the next call retries.
  if (role !== 'unknown') {
    roleCache.set(key, { role, expiresAt: now() + ROLE_CACHE_TTL_MS })
  }
  return role
}
