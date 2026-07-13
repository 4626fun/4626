/**
 * Loop-prevention ledger for the AlfaClub room <-> relay bridges (Telegram, XMTP).
 *
 * When a relay posts a message INTO an AlfaClub room (e.g. mirroring a Telegram
 * message or an XMTP group message), it tags the resulting room message with its
 * origin channel here. Outbound fan-out (`ingestLiveMessages` in chatBridge.ts)
 * then skips re-relaying that message back to the channel it came from, while
 * still allowing it to propagate to *other* channels (hub-and-spoke sync).
 */

import { getDb } from '../db/postgres.js'
import { ensureAlfaclubRoomXmtpBridgeSchema } from '../db/schemaBootstrap.js'

export type ChatBridgeMessageOrigin = 'telegram' | 'xmtp' | 'web4626'

function normalizeRoomId(value: string): string {
  return String(value ?? '').trim()
}

function normalizeMessageId(value: string): string {
  return String(value ?? '').trim()
}

/**
 * Record that `messageId` in `roomId` was posted by a relay from `origin`.
 * Fail-open: ledger unavailability must never block the send it's recording.
 */
export async function recordChatBridgeMessageOrigin(params: {
  roomId: string
  messageId: string
  origin: ChatBridgeMessageOrigin
}): Promise<void> {
  const roomId = normalizeRoomId(params.roomId)
  const messageId = normalizeMessageId(params.messageId)
  if (!roomId || !messageId) return

  try {
    const db = await getDb()
    if (!db) return
    await ensureAlfaclubRoomXmtpBridgeSchema(db)
    await db.sql`
      INSERT INTO alfaclub.chat_bridge_message_origin (room_id, message_id, origin)
      VALUES (${roomId}, ${messageId}, ${params.origin})
      ON CONFLICT (room_id, message_id) DO NOTHING;
    `
  } catch {
    // Fail-open: worst case is one extra cross-post if this write is lost.
  }
}

/**
 * Look up recorded origins for a batch of message ids in one room.
 * Fail-open: returns an empty map (treat all as native/untagged) on any error.
 */
export async function getChatBridgeMessageOrigins(params: {
  roomId: string
  messageIds: string[]
}): Promise<Map<string, ChatBridgeMessageOrigin>> {
  const roomId = normalizeRoomId(params.roomId)
  const messageIds = [...new Set(params.messageIds.map(normalizeMessageId).filter(Boolean))]
  const out = new Map<string, ChatBridgeMessageOrigin>()
  if (!roomId || messageIds.length === 0) return out

  try {
    const db = await getDb()
    if (!db) return out
    await ensureAlfaclubRoomXmtpBridgeSchema(db)
    const result = await db.sql`
      SELECT message_id, origin
      FROM alfaclub.chat_bridge_message_origin
      WHERE room_id = ${roomId}
        AND message_id = ANY(${messageIds}::text[]);
    `
    for (const row of (result.rows ?? []) as Array<{ message_id: string; origin: string }>) {
      if (row.origin === 'telegram' || row.origin === 'xmtp' || row.origin === 'web4626') {
        out.set(String(row.message_id), row.origin)
      }
    }
    return out
  } catch {
    return out
  }
}
