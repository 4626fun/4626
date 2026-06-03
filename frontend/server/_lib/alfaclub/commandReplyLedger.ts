import { getDb } from '../db/postgres.js'

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

export async function recordCommandReply(params: {
  roomId: string
  messageId: string
  commandHead?: string
}): Promise<void> {
  const roomId = params.roomId.trim()
  const messageId = params.messageId.trim()
  if (!roomId || !messageId) return

  const db = await getDb()
  if (!db) return

  const commandHead = (params.commandHead ?? '').trim().slice(0, 64)
  try {
    await db.sql`
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
      ON CONFLICT (room_id, message_id) DO NOTHING;
    `
  } catch {
    // Best-effort — a missed write may allow one duplicate, not a hard failure.
  }
}
