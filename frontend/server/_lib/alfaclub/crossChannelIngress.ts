import { getDb, type DbPool } from '../db/postgres.js'

export type AlfaClubIngressSourceChannel = 'telegram' | 'xmtp' | 'web4626'

export type AlfaClubCrossChannelIngress = {
  id: string
  sourceChannel: AlfaClubIngressSourceChannel
  sourceMessageId: string
  sourceConversationId: string | null
  targetRoomId: string
  originalText: string
  alfaclubRoomId: string | null
  alfaclubMessageId: string | null
  validatedProfileId: string | null
  validatedIssuer: string | null
  claimedAt: string
  linkedAt: string | null
  updatedAt: string
}

export type ClaimAlfaClubCrossChannelIngressParams = {
  sourceChannel: AlfaClubIngressSourceChannel
  sourceMessageId: string
  sourceConversationId?: string | null
  targetRoomId: string
  originalText: string
}

export type LinkAlfaClubCrossChannelIngressParams = {
  sourceChannel: AlfaClubIngressSourceChannel
  sourceMessageId: string
  alfaclubRoomId: string
  alfaclubMessageId: string
  validatedProfileId: string | number
  validatedIssuer: string
}

type CrossChannelIngressRow = {
  id: string | number
  source_channel: string
  source_message_id: string
  source_conversation_id: string | null
  target_room_id: string
  original_text: string
  alfaclub_room_id: string | null
  alfaclub_message_id: string | null
  validated_profile_id: string | number | null
  validated_issuer: string | null
  claimed_at: string
  linked_at: string | null
  updated_at: string
}

const SOURCE_CHANNELS = new Set<AlfaClubIngressSourceChannel>(['telegram', 'xmtp', 'web4626'])
const MAX_ORIGINAL_TEXT_LENGTH = 20_000

function normalizeRequiredText(value: string, maxLength: number): string | null {
  const normalized = String(value ?? '').trim()
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null
  return normalizeRequiredText(value, maxLength)
}

function boundOriginalText(value: string): string {
  return String(value ?? '').slice(0, MAX_ORIGINAL_TEXT_LENGTH)
}

function normalizeProfileId(value: string | number): string | null {
  const normalized = String(value ?? '').trim()
  if (!/^[1-9][0-9]*$/.test(normalized)) return null
  return normalized
}

function isSourceChannel(value: string): value is AlfaClubIngressSourceChannel {
  return SOURCE_CHANNELS.has(value as AlfaClubIngressSourceChannel)
}

function rowToIngress(row: CrossChannelIngressRow): AlfaClubCrossChannelIngress | null {
  if (!isSourceChannel(row.source_channel)) return null
  return {
    id: String(row.id),
    sourceChannel: row.source_channel,
    sourceMessageId: row.source_message_id,
    sourceConversationId: row.source_conversation_id,
    targetRoomId: row.target_room_id,
    originalText: row.original_text,
    alfaclubRoomId: row.alfaclub_room_id,
    alfaclubMessageId: row.alfaclub_message_id,
    validatedProfileId:
      row.validated_profile_id == null ? null : String(row.validated_profile_id),
    validatedIssuer: row.validated_issuer,
    claimedAt: row.claimed_at,
    linkedAt: row.linked_at,
    updatedAt: row.updated_at,
  }
}

async function selectIngress(
  db: DbPool,
  sourceChannel: AlfaClubIngressSourceChannel,
  sourceMessageId: string,
): Promise<AlfaClubCrossChannelIngress | null> {
  const result = await db.sql`
    SELECT
      id,
      source_channel,
      source_message_id,
      source_conversation_id,
      target_room_id,
      original_text,
      alfaclub_room_id,
      alfaclub_message_id,
      validated_profile_id,
      validated_issuer,
      claimed_at,
      linked_at,
      updated_at
    FROM alfaclub.cross_channel_ingress
    WHERE source_channel = ${sourceChannel}
      AND source_message_id = ${sourceMessageId}
    LIMIT 1;
  `
  const row = result.rows?.[0] as CrossChannelIngressRow | undefined
  return row ? rowToIngress(row) : null
}

export async function claimAlfaClubCrossChannelIngress(
  params: ClaimAlfaClubCrossChannelIngressParams,
): Promise<{ ingress: AlfaClubCrossChannelIngress; claimed: boolean } | null> {
  const sourceMessageId = normalizeRequiredText(params.sourceMessageId, 512)
  const sourceConversationId = normalizeOptionalText(params.sourceConversationId, 512)
  const targetRoomId = normalizeRequiredText(params.targetRoomId, 128)
  const originalText = boundOriginalText(params.originalText)
  if (!isSourceChannel(params.sourceChannel) || !sourceMessageId || !targetRoomId) return null

  try {
    const db = await getDb()
    if (!db) return null
    const result = await db.sql`
      INSERT INTO alfaclub.cross_channel_ingress (
        source_channel,
        source_message_id,
        source_conversation_id,
        target_room_id,
        original_text
      ) VALUES (
        ${params.sourceChannel},
        ${sourceMessageId},
        ${sourceConversationId},
        ${targetRoomId},
        ${originalText}
      )
      ON CONFLICT (source_channel, source_message_id) DO NOTHING
      RETURNING
        id,
        source_channel,
        source_message_id,
        source_conversation_id,
        target_room_id,
        original_text,
        alfaclub_room_id,
        alfaclub_message_id,
        validated_profile_id,
        validated_issuer,
        claimed_at,
        linked_at,
        updated_at;
    `
    const insertedRow = result.rows?.[0] as CrossChannelIngressRow | undefined
    if (insertedRow) {
      const ingress = rowToIngress(insertedRow)
      return ingress ? { ingress, claimed: true } : null
    }

    const ingress = await selectIngress(db, params.sourceChannel, sourceMessageId)
    return ingress ? { ingress, claimed: false } : null
  } catch {
    return null
  }
}

export async function linkAlfaClubCrossChannelIngress(
  params: LinkAlfaClubCrossChannelIngressParams,
): Promise<AlfaClubCrossChannelIngress | null> {
  const sourceMessageId = normalizeRequiredText(params.sourceMessageId, 512)
  const alfaclubRoomId = normalizeRequiredText(params.alfaclubRoomId, 128)
  const alfaclubMessageId = normalizeRequiredText(params.alfaclubMessageId, 512)
  const validatedProfileId = normalizeProfileId(params.validatedProfileId)
  const validatedIssuer = normalizeRequiredText(params.validatedIssuer, 256)
  if (
    !isSourceChannel(params.sourceChannel)
    || !sourceMessageId
    || !alfaclubRoomId
    || !alfaclubMessageId
    || !validatedProfileId
    || !validatedIssuer
  ) {
    return null
  }

  try {
    const db = await getDb()
    if (!db) return null
    const result = await db.sql`
      UPDATE alfaclub.cross_channel_ingress
      SET
        alfaclub_room_id = ${alfaclubRoomId},
        alfaclub_message_id = ${alfaclubMessageId},
        validated_profile_id = ${validatedProfileId},
        validated_issuer = ${validatedIssuer},
        linked_at = COALESCE(linked_at, NOW()),
        updated_at = NOW()
      WHERE source_channel = ${params.sourceChannel}
        AND source_message_id = ${sourceMessageId}
        AND (
          alfaclub_message_id IS NULL
          OR (
            alfaclub_room_id = ${alfaclubRoomId}
            AND alfaclub_message_id = ${alfaclubMessageId}
            AND validated_profile_id = ${validatedProfileId}
            AND validated_issuer = ${validatedIssuer}
          )
        )
      RETURNING
        id,
        source_channel,
        source_message_id,
        source_conversation_id,
        target_room_id,
        original_text,
        alfaclub_room_id,
        alfaclub_message_id,
        validated_profile_id,
        validated_issuer,
        claimed_at,
        linked_at,
        updated_at;
    `
    const row = result.rows?.[0] as CrossChannelIngressRow | undefined
    return row ? rowToIngress(row) : null
  } catch {
    return null
  }
}

export async function readAlfaClubCrossChannelIngress(params: {
  sourceChannel: AlfaClubIngressSourceChannel
  sourceMessageId: string
}): Promise<AlfaClubCrossChannelIngress | null> {
  const sourceMessageId = normalizeRequiredText(params.sourceMessageId, 512)
  if (!isSourceChannel(params.sourceChannel) || !sourceMessageId) return null

  try {
    const db = await getDb()
    if (!db) return null
    return await selectIngress(db, params.sourceChannel, sourceMessageId)
  } catch {
    return null
  }
}

export async function readTrustedAlfaClubCrossChannelIngress(params: {
  alfaclubRoomId: string
  alfaclubMessageId: string
}): Promise<AlfaClubCrossChannelIngress | null> {
  const alfaclubRoomId = normalizeRequiredText(params.alfaclubRoomId, 128)
  const alfaclubMessageId = normalizeRequiredText(params.alfaclubMessageId, 512)
  if (!alfaclubRoomId || !alfaclubMessageId) return null

  try {
    const db = await getDb()
    if (!db) return null
    const result = await db.sql`
      SELECT
        id,
        source_channel,
        source_message_id,
        source_conversation_id,
        target_room_id,
        original_text,
        alfaclub_room_id,
        alfaclub_message_id,
        validated_profile_id,
        validated_issuer,
        claimed_at,
        linked_at,
        updated_at
      FROM alfaclub.cross_channel_ingress
      WHERE alfaclub_room_id = ${alfaclubRoomId}
        AND alfaclub_message_id = ${alfaclubMessageId}
        AND validated_profile_id IS NOT NULL
        AND validated_issuer IS NOT NULL
        AND linked_at IS NOT NULL
      LIMIT 1;
    `
    const row = result.rows?.[0] as CrossChannelIngressRow | undefined
    return row ? rowToIngress(row) : null
  } catch {
    return null
  }
}
