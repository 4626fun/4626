import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

export type AlfaClubIngestMessage = {
  roomId: string
  messageId: string
  senderAddress: string
  text: string
  dateMs: number | null
  source: 'ws-live' | 'history'
  rawPayloadText?: string | null
}

function toIsoOrNull(dateMs: number | null): string | null {
  if (dateMs === null || !Number.isFinite(dateMs) || dateMs <= 0) return null
  try {
    return new Date(dateMs).toISOString()
  } catch {
    return null
  }
}

export async function upsertAlfaClubIngestMessages(
  messages: AlfaClubIngestMessage[],
): Promise<number> {
  if (!Array.isArray(messages) || messages.length === 0) return 0
  const db = await getDb()
  if (!db) return 0
  await ensureAlfaClubVigilanteSchema()

  let written = 0
  for (const message of messages) {
    const roomId = String(message.roomId ?? '').trim()
    const messageId = String(message.messageId ?? '').trim()
    const senderAddress = String(message.senderAddress ?? '').trim().toLowerCase()
    if (!roomId || !messageId || !senderAddress) continue
    const messageText = String(message.text ?? '')
    const messageDate = toIsoOrNull(message.dateMs)

    try {
      await db.sql`
        INSERT INTO alfaclub.chat_ingest (
          room_id,
          message_id,
          sender_address,
          message_text,
          message_date,
          source,
          raw_payload_text,
          ingested_at,
          updated_at
        ) VALUES (
          ${roomId},
          ${messageId},
          ${senderAddress},
          ${messageText},
          ${messageDate},
          ${message.source},
          ${message.rawPayloadText ?? null},
          NOW(),
          NOW()
        )
        ON CONFLICT (room_id, message_id) DO UPDATE
        SET sender_address = EXCLUDED.sender_address,
            message_text = EXCLUDED.message_text,
            message_date = EXCLUDED.message_date,
            source = EXCLUDED.source,
            raw_payload_text = EXCLUDED.raw_payload_text,
            updated_at = NOW();
      `
      written += 1
    } catch {
      // Fail-open for ingest durability: one bad row should not block bridge ticks.
    }
  }

  return written
}

