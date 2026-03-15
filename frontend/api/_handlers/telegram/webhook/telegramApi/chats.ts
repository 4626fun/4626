import { asTrimmed } from '../utils.js'

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
