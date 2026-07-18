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

export type AlfaClubRoomChatOrigin = 'telegram' | 'xmtp' | 'web4626'

export type AlfaClubRoomChatMessage = {
  roomId: string
  messageId: string
  senderAddress: string
  text: string
  dateMs: number | null
  dateIso: string | null
  username: string | null
  avatarUrl: string | null
  isBot: boolean | null
  replyId: string | null
  replyText: string | null
  replySender: string | null
  replyUsername: string | null
  origin: AlfaClubRoomChatOrigin | null
}

export type ListAlfaClubRoomChatMessagesParams = {
  roomId: string
  /** Page size (clamped 1..100). Default 50. */
  limit?: number
  /** Cursor: load messages older than this message id (paired with beforeDateMs when possible). */
  beforeMessageId?: string | null
  /** Cursor: load messages older than this epoch ms. */
  beforeDateMs?: number | null
}

type ChatIngestListRow = {
  room_id: string
  message_id: string
  sender_address: string
  message_text: string
  message_date: string | null
  username: string | null
  avatar_url: string | null
  is_bot: boolean | null
  reply_id: string | null
  reply_text: string | null
  reply_sender: string | null
  reply_username: string | null
  origin: string | null
}

function parseOrigin(value: string | null | undefined): AlfaClubRoomChatOrigin | null {
  if (value === 'telegram' || value === 'xmtp' || value === 'web4626') return value
  return null
}

function rowToRoomChatMessage(row: ChatIngestListRow): AlfaClubRoomChatMessage {
  const dateIso = cleanString(row.message_date)
  let dateMs: number | null = null
  if (dateIso) {
    const parsed = Date.parse(dateIso)
    dateMs = Number.isFinite(parsed) ? parsed : null
  }
  return {
    roomId: String(row.room_id ?? ''),
    messageId: String(row.message_id ?? ''),
    senderAddress: String(row.sender_address ?? '').toLowerCase(),
    text: String(row.message_text ?? ''),
    dateMs,
    dateIso,
    username: cleanString(row.username),
    avatarUrl: cleanString(row.avatar_url),
    isBot: cleanBool(row.is_bot),
    replyId: cleanString(row.reply_id),
    replyText: cleanString(row.reply_text),
    replySender: cleanString(row.reply_sender),
    replyUsername: cleanString(row.reply_username),
    origin: parseOrigin(row.origin),
  }
}

/**
 * Paginated room chat transcript from `alfaclub.chat_ingest`, with optional
 * origin from `alfaclub.chat_bridge_message_origin`.
 *
 * Returns newest-first pages. Use `beforeDateMs` / `beforeMessageId` to load older
 * messages. Callers that want chronological UI order should reverse the page.
 *
 * Fail-closed: throws when the DB is unavailable or the query fails.
 * Does not create schema.
 */
export async function listAlfaClubRoomChatMessages(
  params: ListAlfaClubRoomChatMessagesParams,
): Promise<AlfaClubRoomChatMessage[]> {
  const roomId = String(params.roomId ?? '').trim()
  if (!roomId) throw new Error('room_id_required')

  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  const limit = Math.max(1, Math.min(100, Math.floor(params.limit ?? 50)))
  const beforeMessageId = cleanString(params.beforeMessageId)
  const beforeDateMs =
    typeof params.beforeDateMs === 'number' && Number.isFinite(params.beforeDateMs)
      ? Math.floor(params.beforeDateMs)
      : null
  const beforeDateIso =
    beforeDateMs != null && beforeDateMs > 0 ? toIsoOrNull(beforeDateMs) : null

  try {
    // Cursor semantics: "before" means strictly older than the cursor (load-more-older).
    const result =
      beforeDateIso && beforeMessageId
        ? await db.sql`
            SELECT
              ci.room_id,
              ci.message_id,
              ci.sender_address,
              ci.message_text,
              ci.message_date,
              ci.username,
              ci.avatar_url,
              ci.is_bot,
              ci.reply_id,
              ci.reply_text,
              ci.reply_sender,
              ci.reply_username,
              o.origin
            FROM alfaclub.chat_ingest ci
            LEFT JOIN alfaclub.chat_bridge_message_origin o
              ON o.room_id = ci.room_id
             AND o.message_id = ci.message_id
            WHERE ci.room_id = ${roomId}
              AND ci.deleted_at IS NULL
              AND (
                COALESCE(ci.message_date, ci.ingested_at) < ${beforeDateIso}::timestamptz
                OR (
                  COALESCE(ci.message_date, ci.ingested_at) = ${beforeDateIso}::timestamptz
                  AND ci.message_id < ${beforeMessageId}
                )
              )
            ORDER BY COALESCE(ci.message_date, ci.ingested_at) DESC, ci.message_id DESC
            LIMIT ${limit};
          `
        : beforeDateIso
          ? await db.sql`
              SELECT
                ci.room_id,
                ci.message_id,
                ci.sender_address,
                ci.message_text,
                ci.message_date,
                ci.username,
                ci.avatar_url,
                ci.is_bot,
                ci.reply_id,
                ci.reply_text,
                ci.reply_sender,
                ci.reply_username,
                o.origin
              FROM alfaclub.chat_ingest ci
              LEFT JOIN alfaclub.chat_bridge_message_origin o
                ON o.room_id = ci.room_id
               AND o.message_id = ci.message_id
              WHERE ci.room_id = ${roomId}
                AND ci.deleted_at IS NULL
                AND COALESCE(ci.message_date, ci.ingested_at) < ${beforeDateIso}::timestamptz
              ORDER BY COALESCE(ci.message_date, ci.ingested_at) DESC, ci.message_id DESC
              LIMIT ${limit};
            `
          : await db.sql`
              SELECT
                ci.room_id,
                ci.message_id,
                ci.sender_address,
                ci.message_text,
                ci.message_date,
                ci.username,
                ci.avatar_url,
                ci.is_bot,
                ci.reply_id,
                ci.reply_text,
                ci.reply_sender,
                ci.reply_username,
                o.origin
              FROM alfaclub.chat_ingest ci
              LEFT JOIN alfaclub.chat_bridge_message_origin o
                ON o.room_id = ci.room_id
               AND o.message_id = ci.message_id
              WHERE ci.room_id = ${roomId}
                AND ci.deleted_at IS NULL
              ORDER BY COALESCE(ci.message_date, ci.ingested_at) DESC, ci.message_id DESC
              LIMIT ${limit};
            `

    return ((result.rows ?? []) as ChatIngestListRow[])
      .map(rowToRoomChatMessage)
      .filter((row) => Boolean(row.roomId && row.messageId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`room_chat_list_failed:${message.slice(0, 180)}`)
  }
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

export type RecentHexChatSpeaker = {
  sender: string
  dateMs: number
}

/** Max age of a chat_ingest speaker relative to the Chip card timestamp. */
export const CHIP_ATTRIBUTION_SPEAKER_LOOKBACK_MS = 2 * 60 * 60 * 1000

/**
 * Recent human wallet speakers for Chip trade attribution when the live/seed
 * message batch is too narrow (WS single-card batches, first-tick 60s window).
 * Newest-first, bounded to {@link CHIP_ATTRIBUTION_SPEAKER_LOOKBACK_MS} before
 * the card timestamp so quiet rooms do not attribute to stale members.
 * Fail-open: returns [] when DB is unavailable.
 */
export async function listRecentHexChatSpeakersForRoom(params: {
  roomId: string
  /** Only speakers at/before this epoch ms (defaults to now). */
  atOrBeforeDateMs?: number | null
  /** Lookback window ending at atOrBeforeDateMs. Defaults to 2h. */
  lookbackMs?: number
  limit?: number
}): Promise<RecentHexChatSpeaker[]> {
  const roomId = String(params.roomId ?? '').trim()
  if (!/^\d+$/.test(roomId)) return []

  const db = await getDb()
  if (!db) return []

  const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 40)))
  const lookbackMs = Math.max(
    60_000,
    Math.floor(
      typeof params.lookbackMs === 'number' && Number.isFinite(params.lookbackMs)
        ? params.lookbackMs
        : CHIP_ATTRIBUTION_SPEAKER_LOOKBACK_MS,
    ),
  )
  const atOrBeforeMs =
    typeof params.atOrBeforeDateMs === 'number' && Number.isFinite(params.atOrBeforeDateMs)
      ? Math.floor(params.atOrBeforeDateMs)
      : Date.now()
  const atOrAfterMs = atOrBeforeMs - lookbackMs
  const atOrBeforeIso = toIsoOrNull(atOrBeforeMs)
  const atOrAfterIso = toIsoOrNull(atOrAfterMs)
  if (!atOrBeforeIso || !atOrAfterIso) return []

  try {
    const result = await db.sql`
      SELECT
        LOWER(ci.sender_address) AS sender_address,
        (EXTRACT(EPOCH FROM COALESCE(ci.message_date, ci.ingested_at)) * 1000)::bigint AS date_ms
      FROM alfaclub.chat_ingest ci
      WHERE ci.room_id = ${roomId}
        AND ci.deleted_at IS NULL
        AND ci.sender_address ~ '^0x[a-fA-F0-9]{40}$'
        AND COALESCE(ci.message_date, ci.ingested_at) <= ${atOrBeforeIso}::timestamptz
        AND COALESCE(ci.message_date, ci.ingested_at) >= ${atOrAfterIso}::timestamptz
      ORDER BY COALESCE(ci.message_date, ci.ingested_at) DESC, ci.message_id DESC
      LIMIT ${limit};
    `
    const rows = (result.rows ?? []) as Array<{ sender_address?: string; date_ms?: number | string }>
    const out: RecentHexChatSpeaker[] = []
    for (const row of rows) {
      const sender = String(row.sender_address ?? '').trim().toLowerCase()
      const dateMs = Number(row.date_ms)
      if (!/^0x[a-f0-9]{40}$/.test(sender)) continue
      if (!Number.isFinite(dateMs) || dateMs <= 0) continue
      if (dateMs < atOrAfterMs || dateMs > atOrBeforeMs) continue
      out.push({ sender, dateMs: Math.floor(dateMs) })
    }
    return out
  } catch {
    return []
  }
}
