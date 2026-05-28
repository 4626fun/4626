import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

export type AlfaClubIngestMessage = {
  roomId: string
  messageId: string
  senderAddress: string
  text: string
  dateMs: number | null
  username?: string | null
  avatarUrl?: string | null
  isBot?: boolean | null
  isEdited?: boolean | null
  editDeadlineMs?: number | null
  deletedAtMs?: number | null
  deletedBy?: string | null
  deletedByUsername?: string | null
  replyId?: string | null
  replyDateMs?: number | null
  replyText?: string | null
  replySender?: string | null
  replyUsername?: string | null
  keysCount?: number | null
  primaryTag?: string | null
  primaryTagVariant?: string | null
  attachmentsJson?: unknown
  replyAttachmentsJson?: unknown
  reactionsJson?: unknown
  messagePayloadJson?: unknown
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

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanInt(value: unknown): number | null {
  const asNumber = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(asNumber)) return null
  return Math.floor(asNumber)
}

function cleanBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (lowered === 'true') return true
    if (lowered === 'false') return false
  }
  return null
}

function cleanJsonText(value: unknown): string | null {
  if (value == null) return null
  try {
    return JSON.stringify(value)
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
    const editDeadline = toIsoOrNull(message.editDeadlineMs ?? null)
    const deletedAt = toIsoOrNull(message.deletedAtMs ?? null)
    const replyDate = toIsoOrNull(message.replyDateMs ?? null)
    const keysCount = cleanInt(message.keysCount)
    const username = cleanString(message.username)
    const avatarUrl = cleanString(message.avatarUrl)
    const isBot = cleanBool(message.isBot)
    const isEdited = cleanBool(message.isEdited)
    const deletedBy = cleanString(message.deletedBy)
    const deletedByUsername = cleanString(message.deletedByUsername)
    const replyId = cleanString(message.replyId)
    const replyText = cleanString(message.replyText)
    const replySender = cleanString(message.replySender)
    const replyUsername = cleanString(message.replyUsername)
    const primaryTag = cleanString(message.primaryTag)
    const primaryTagVariant = cleanString(message.primaryTagVariant)
    const attachmentsJsonText = cleanJsonText(message.attachmentsJson)
    const replyAttachmentsJsonText = cleanJsonText(message.replyAttachmentsJson)
    const reactionsJsonText = cleanJsonText(message.reactionsJson)
    const messagePayloadJsonText = cleanJsonText(message.messagePayloadJson)

    try {
      const result = await db.sql`
        INSERT INTO alfaclub.chat_ingest (
          room_id,
          message_id,
          sender_address,
          message_text,
          message_date,
          username,
          avatar_url,
          is_bot,
          is_edited,
          edit_deadline,
          deleted_at,
          deleted_by,
          deleted_by_username,
          reply_id,
          reply_date,
          reply_text,
          reply_sender,
          reply_username,
          keys_count,
          primary_tag,
          primary_tag_variant,
          attachments_json,
          reply_attachments_json,
          reactions_json,
          message_payload_json,
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
          ${username},
          ${avatarUrl},
          ${isBot},
          ${isEdited},
          ${editDeadline},
          ${deletedAt},
          ${deletedBy},
          ${deletedByUsername},
          ${replyId},
          ${replyDate},
          ${replyText},
          ${replySender},
          ${replyUsername},
          ${keysCount},
          ${primaryTag},
          ${primaryTagVariant},
          ${attachmentsJsonText}::jsonb,
          ${replyAttachmentsJsonText}::jsonb,
          ${reactionsJsonText}::jsonb,
          ${messagePayloadJsonText}::jsonb,
          ${message.source},
          ${message.rawPayloadText ?? null},
          NOW(),
          NOW()
        )
        ON CONFLICT (room_id, message_id) DO UPDATE
        SET
          message_text = EXCLUDED.message_text,
          message_date = COALESCE(EXCLUDED.message_date, alfaclub.chat_ingest.message_date),
          username = COALESCE(EXCLUDED.username, alfaclub.chat_ingest.username),
          avatar_url = COALESCE(EXCLUDED.avatar_url, alfaclub.chat_ingest.avatar_url),
          is_bot = COALESCE(EXCLUDED.is_bot, alfaclub.chat_ingest.is_bot),
          is_edited = COALESCE(EXCLUDED.is_edited, alfaclub.chat_ingest.is_edited),
          edit_deadline = COALESCE(EXCLUDED.edit_deadline, alfaclub.chat_ingest.edit_deadline),
          deleted_at = COALESCE(EXCLUDED.deleted_at, alfaclub.chat_ingest.deleted_at),
          deleted_by = COALESCE(EXCLUDED.deleted_by, alfaclub.chat_ingest.deleted_by),
          deleted_by_username = COALESCE(EXCLUDED.deleted_by_username, alfaclub.chat_ingest.deleted_by_username),
          reply_id = COALESCE(EXCLUDED.reply_id, alfaclub.chat_ingest.reply_id),
          reply_date = COALESCE(EXCLUDED.reply_date, alfaclub.chat_ingest.reply_date),
          reply_text = COALESCE(EXCLUDED.reply_text, alfaclub.chat_ingest.reply_text),
          reply_sender = COALESCE(EXCLUDED.reply_sender, alfaclub.chat_ingest.reply_sender),
          reply_username = COALESCE(EXCLUDED.reply_username, alfaclub.chat_ingest.reply_username),
          keys_count = COALESCE(EXCLUDED.keys_count, alfaclub.chat_ingest.keys_count),
          primary_tag = COALESCE(EXCLUDED.primary_tag, alfaclub.chat_ingest.primary_tag),
          primary_tag_variant = COALESCE(EXCLUDED.primary_tag_variant, alfaclub.chat_ingest.primary_tag_variant),
          attachments_json = COALESCE(EXCLUDED.attachments_json, alfaclub.chat_ingest.attachments_json),
          reply_attachments_json = COALESCE(EXCLUDED.reply_attachments_json, alfaclub.chat_ingest.reply_attachments_json),
          reactions_json = COALESCE(EXCLUDED.reactions_json, alfaclub.chat_ingest.reactions_json),
          message_payload_json = COALESCE(EXCLUDED.message_payload_json, alfaclub.chat_ingest.message_payload_json),
          source = EXCLUDED.source,
          raw_payload_text = COALESCE(EXCLUDED.raw_payload_text, alfaclub.chat_ingest.raw_payload_text),
          updated_at = NOW()
        RETURNING
          room_id,
          message_id,
          sender_address,
          message_text,
          message_date,
          source,
          raw_payload_text,
          (xmax = 0) AS is_new_insert;
      `
      const row = result.rows?.[0] as
        | (Record<string, unknown> & { is_new_insert?: boolean })
        | undefined
      if (!row) continue
      // ON CONFLICT DO UPDATE still returns a row; only brand-new inserts
      // should drive command execution on serverless cron ticks.
      if (row.is_new_insert !== true) continue
      inserted.push({
        roomId,
        messageId,
        senderAddress,
        text: messageText,
        dateMs: message.dateMs ?? null,
        dateIso: messageDate,
        username,
        avatarUrl,
        isBot,
        isEdited,
        editDeadlineMs: message.editDeadlineMs ?? null,
        deletedAtMs: message.deletedAtMs ?? null,
        deletedBy,
        deletedByUsername,
        replyId,
        replyDateMs: message.replyDateMs ?? null,
        replyText,
        replySender,
        replyUsername,
        keysCount,
        primaryTag,
        primaryTagVariant,
        attachmentsJson: message.attachmentsJson ?? null,
        replyAttachmentsJson: message.replyAttachmentsJson ?? null,
        reactionsJson: message.reactionsJson ?? null,
        messagePayloadJson: message.messagePayloadJson ?? null,
        source: message.source,
        rawPayloadText: message.rawPayloadText ?? null,
      })
    } catch {
      // Fail-open for ingest durability: one bad row should not block bridge ticks.
    }
  }

  return inserted
}

