import { getDb } from '../db/postgres.js'

const inMemoryClaimedReplyKeys = new Set<string>()

function commandReplyClaimKey(roomId: string, messageId: string): string {
  return `${roomId.trim()}:${messageId.trim()}`
}

export async function filterUnrepliedCommandMessageIds(params: {
  roomId: string
  messageIds: string[]
}): Promise<Set<string>> {
  const roomId = params.roomId.trim()
  const messageIds = [...new Set(params.messageIds.map((id) => id.trim()).filter(Boolean))]
  if (!roomId || messageIds.length === 0) return new Set(messageIds)

  const db = await getDb()
  if (!db) return new Set(messageIds)

  try {
    const result = await db.sql`
      SELECT message_id
      FROM alfaclub.command_reply_ledger
      WHERE room_id = ${roomId}
        AND message_id = ANY(${messageIds}::text[]);
    `
    const replied = new Set(
      ((result.rows ?? []) as Array<{ message_id: string | null }>)
        .map((row) => row.message_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    )
    return new Set(messageIds.filter((id) => !replied.has(id)))
  } catch {
    // Fail-open: if ledger is unavailable, preserve prior behavior.
    return new Set(messageIds)
  }
}

/**
 * Atomically claim a command message before executing/sending a reply.
 * Returns false when another bridge tick already claimed the same message.
 */
export async function tryClaimCommandReply(params: {
  roomId: string
  messageId: string
  commandHead?: string
}): Promise<boolean> {
  const roomId = params.roomId.trim()
  const messageId = params.messageId.trim()
  if (!roomId || !messageId) return false

  const claimKey = commandReplyClaimKey(roomId, messageId)
  if (inMemoryClaimedReplyKeys.has(claimKey)) return false

  const db = await getDb()
  if (!db) {
    inMemoryClaimedReplyKeys.add(claimKey)
    return true
  }

  const commandHead = (params.commandHead ?? '').trim().slice(0, 64)
  try {
    const result = await db.sql`
      INSERT INTO alfaclub.command_reply_ledger (
        room_id,
        message_id,
        command_head,
        replied_at
      ) VALUES (
        ${roomId},
        ${messageId},
        ${commandHead},
        NOW()
      )
      ON CONFLICT (room_id, message_id) DO NOTHING
      RETURNING message_id;
    `
    const claimed = ((result.rows ?? []) as Array<{ message_id: string | null }>).length > 0
    if (claimed) inMemoryClaimedReplyKeys.add(claimKey)
    return claimed
  } catch {
    if (inMemoryClaimedReplyKeys.has(claimKey)) return false
    inMemoryClaimedReplyKeys.add(claimKey)
    return true
  }
}

export async function recordCommandReply(params: {
  roomId: string
  messageId: string
  commandHead?: string
}): Promise<void> {
  await tryClaimCommandReply(params)
}

/** For unit tests only. */
export function __resetCommandReplyClaimCacheForTests(): void {
  inMemoryClaimedReplyKeys.clear()
}
