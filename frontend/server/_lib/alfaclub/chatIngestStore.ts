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

export type AlfaClubInsertedIngestMessage = AlfaClubIngestMessage & {
  dateIso: string | null
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
): Promise<AlfaClubInsertedIngestMessage[]> {
  if (!Array.isArray(messages) || messages.length === 0) return []
  const db = await getDb()
  if (!db) return []
  await ensureAlfaClubVigilanteSchema()

  const inserted: AlfaClubInsertedIngestMessage[] = []
  for (const message of messages) {
    const roomId = String(message.roomId ?? '').trim()
    const messageId = String(message.messageId ?? '').trim()
    const senderAddress = String(message.senderAddress ?? '').trim().toLowerCase()
    if (!roomId || !messageId || !senderAddress) continue
    const messageText = String(message.text ?? '')
    const messageDate = toIsoOrNull(message.dateMs)

    try {
      const result = await db.sql`
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
        ON CONFLICT (room_id, message_id) DO NOTHING
        RETURNING room_id, message_id, sender_address, message_text, message_date, source, raw_payload_text;
      `
      if ((result.rows?.length ?? 0) > 0) {
        inserted.push({
          roomId,
          messageId,
          senderAddress,
          text: messageText,
          dateMs: message.dateMs ?? null,
          dateIso: messageDate,
          source: message.source,
          rawPayloadText: message.rawPayloadText ?? null,
        })
      }
    } catch {
      // Fail-open for ingest durability: one bad row should not block bridge ticks.
    }
  }

  return inserted
}

