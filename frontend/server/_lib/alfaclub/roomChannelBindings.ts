import { getDb } from '../db/postgres.js'

export type AlfaClubRoomRolloutStatus = 'disabled' | 'canary' | 'enabled'

export type AlfaClubRoomChannelBinding = {
  roomId: string
  enabled: boolean
  rolloutStatus: AlfaClubRoomRolloutStatus
  telegram: {
    enabled: boolean
    chatId: string | null
    threadId: string | null
  }
  xmtp: {
    enabled: boolean
    groupId: string | null
    syntheticKeeprVaultAddress: `0x${string}` | null
  }
  createdAt: string
  updatedAt: string
}

export type UpsertAlfaClubRoomChannelBindingParams = {
  roomId: string
  enabled: boolean
  rolloutStatus: AlfaClubRoomRolloutStatus
  telegramEnabled: boolean
  telegramChatId?: string | null
  telegramThreadId?: string | null
  xmtpEnabled: boolean
  xmtpGroupId?: string | null
  syntheticKeeprVaultAddress?: string | null
}

type RoomChannelBindingRow = {
  room_id: string
  enabled: boolean
  rollout_status: string
  telegram_enabled: boolean
  telegram_chat_id: string | null
  telegram_thread_id: string | null
  xmtp_enabled: boolean
  xmtp_group_id: string | null
  synthetic_keepr_vault_address: string | null
  created_at: string
  updated_at: string
}

export type AlfaClubRoomChannelBindingLookup = {
  available: boolean
  binding: AlfaClubRoomChannelBinding | null
}

const ROLLOUT_STATUSES = new Set<AlfaClubRoomRolloutStatus>(['disabled', 'canary', 'enabled'])

function normalizeRequiredText(value: string, maxLength: number): string | null {
  const normalized = String(value ?? '').trim()
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null
  return normalizeRequiredText(value, maxLength)
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  const normalized = normalizeOptionalText(value, 42)?.toLowerCase() ?? null
  return normalized && /^0x[a-f0-9]{40}$/.test(normalized)
    ? normalized as `0x${string}`
    : null
}

function isRolloutStatus(value: string): value is AlfaClubRoomRolloutStatus {
  return ROLLOUT_STATUSES.has(value as AlfaClubRoomRolloutStatus)
}

function rowToBinding(row: RoomChannelBindingRow): AlfaClubRoomChannelBinding | null {
  if (!isRolloutStatus(row.rollout_status)) return null
  const roomId = normalizeRequiredText(row.room_id, 128)
  const telegramChatId = normalizeOptionalText(row.telegram_chat_id, 256)
  const telegramThreadId = normalizeOptionalText(row.telegram_thread_id, 256)
  const xmtpGroupId = normalizeOptionalText(row.xmtp_group_id, 512)
  const syntheticKeeprVaultAddress = normalizeAddress(row.synthetic_keepr_vault_address)
  if (
    !roomId
    || (row.telegram_enabled && !telegramChatId)
    || (row.xmtp_enabled && !syntheticKeeprVaultAddress)
  ) {
    return null
  }
  return {
    roomId,
    enabled: row.enabled,
    rolloutStatus: row.rollout_status,
    telegram: {
      enabled: row.telegram_enabled,
      chatId: telegramChatId,
      threadId: telegramThreadId,
    },
    xmtp: {
      enabled: row.xmtp_enabled,
      groupId: xmtpGroupId,
      syntheticKeeprVaultAddress,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isEnabledBinding(binding: AlfaClubRoomChannelBinding | null): binding is AlfaClubRoomChannelBinding {
  return Boolean(binding?.enabled && binding.rolloutStatus !== 'disabled')
}

export async function listEnabledAlfaClubRoomChannelBindings(): Promise<AlfaClubRoomChannelBinding[]> {
  try {
    const db = await getDb()
    if (!db) return []
    const result = await db.sql`
      SELECT
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at
      FROM alfaclub.room_channel_bindings
      WHERE enabled = TRUE
        AND rollout_status <> 'disabled'
      ORDER BY room_id ASC;
    `
    return (result.rows ?? [])
      .map((row) => rowToBinding(row as RoomChannelBindingRow))
      .filter(isEnabledBinding)
  } catch {
    return []
  }
}

export async function lookupEnabledAlfaClubRoomChannelBindingByRoom(
  roomIdInput: string,
): Promise<AlfaClubRoomChannelBindingLookup> {
  const roomId = normalizeRequiredText(roomIdInput, 128)
  if (!roomId) return { available: true, binding: null }
  try {
    const db = await getDb()
    if (!db) return { available: false, binding: null }
    const result = await db.sql`
      SELECT
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at
      FROM alfaclub.room_channel_bindings
      WHERE room_id = ${roomId}
        AND enabled = TRUE
        AND rollout_status <> 'disabled'
      LIMIT 1;
    `
    const row = result.rows?.[0] as RoomChannelBindingRow | undefined
    const binding = row ? rowToBinding(row) : null
    return { available: true, binding: isEnabledBinding(binding) ? binding : null }
  } catch {
    return { available: false, binding: null }
  }
}

export async function lookupEnabledAlfaClubRoomChannelBindingByTelegram(params: {
  chatId: string
  threadId?: string | number | null
}): Promise<AlfaClubRoomChannelBindingLookup> {
  const chatId = normalizeRequiredText(params.chatId, 256)
  const threadId = normalizeOptionalText(
    params.threadId == null ? null : String(params.threadId),
    256,
  )
  if (!chatId) return { available: true, binding: null }
  try {
    const db = await getDb()
    if (!db) return { available: false, binding: null }
    const result = await db.sql`
      SELECT
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at
      FROM alfaclub.room_channel_bindings
      WHERE enabled = TRUE
        AND rollout_status <> 'disabled'
        AND telegram_enabled = TRUE
        AND telegram_chat_id = ${chatId}
        AND (telegram_thread_id = ${threadId} OR telegram_thread_id IS NULL)
      ORDER BY (telegram_thread_id = ${threadId}) DESC, room_id ASC
      LIMIT 1;
    `
    const row = result.rows?.[0] as RoomChannelBindingRow | undefined
    const binding = row ? rowToBinding(row) : null
    return { available: true, binding: isEnabledBinding(binding) ? binding : null }
  } catch {
    return { available: false, binding: null }
  }
}

export async function lookupEnabledAlfaClubRoomChannelBindingByXmtpGroup(
  groupIdInput: string,
): Promise<AlfaClubRoomChannelBindingLookup> {
  const groupId = normalizeRequiredText(groupIdInput, 512)
  if (!groupId) return { available: true, binding: null }
  try {
    const db = await getDb()
    if (!db) return { available: false, binding: null }
    const result = await db.sql`
      SELECT
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at
      FROM alfaclub.room_channel_bindings
      WHERE enabled = TRUE
        AND rollout_status <> 'disabled'
        AND xmtp_enabled = TRUE
        AND xmtp_group_id = ${groupId}
      LIMIT 1;
    `
    const row = result.rows?.[0] as RoomChannelBindingRow | undefined
    const binding = row ? rowToBinding(row) : null
    return { available: true, binding: isEnabledBinding(binding) ? binding : null }
  } catch {
    return { available: false, binding: null }
  }
}

export async function readAlfaClubRoomChannelBinding(
  roomIdInput: string,
): Promise<AlfaClubRoomChannelBinding | null> {
  const roomId = normalizeRequiredText(roomIdInput, 128)
  if (!roomId) return null

  try {
    const db = await getDb()
    if (!db) return null
    const result = await db.sql`
      SELECT
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at
      FROM alfaclub.room_channel_bindings
      WHERE room_id = ${roomId}
      LIMIT 1;
    `
    const row = result.rows?.[0] as RoomChannelBindingRow | undefined
    return row ? rowToBinding(row) : null
  } catch {
    return null
  }
}

export async function upsertAlfaClubRoomChannelBinding(
  params: UpsertAlfaClubRoomChannelBindingParams,
): Promise<AlfaClubRoomChannelBinding | null> {
  const roomId = normalizeRequiredText(params.roomId, 128)
  const telegramChatId = normalizeOptionalText(params.telegramChatId, 256)
  const telegramThreadId = normalizeOptionalText(params.telegramThreadId, 256)
  const xmtpGroupId = normalizeOptionalText(params.xmtpGroupId, 512)
  const syntheticKeeprVaultAddress = normalizeAddress(params.syntheticKeeprVaultAddress)

  if (
    !roomId
    || !isRolloutStatus(params.rolloutStatus)
    || (params.telegramEnabled && !telegramChatId)
    || (params.xmtpEnabled && !syntheticKeeprVaultAddress)
    || (params.syntheticKeeprVaultAddress != null && !syntheticKeeprVaultAddress)
  ) {
    return null
  }

  try {
    const db = await getDb()
    if (!db) return null
    const result = await db.sql`
      INSERT INTO alfaclub.room_channel_bindings (
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        updated_at
      ) VALUES (
        ${roomId},
        ${params.enabled},
        ${params.rolloutStatus},
        ${params.telegramEnabled},
        ${telegramChatId},
        ${telegramThreadId},
        ${params.xmtpEnabled},
        ${xmtpGroupId},
        ${syntheticKeeprVaultAddress},
        NOW()
      )
      ON CONFLICT (room_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        rollout_status = EXCLUDED.rollout_status,
        telegram_enabled = EXCLUDED.telegram_enabled,
        telegram_chat_id = EXCLUDED.telegram_chat_id,
        telegram_thread_id = EXCLUDED.telegram_thread_id,
        xmtp_enabled = EXCLUDED.xmtp_enabled,
        xmtp_group_id = EXCLUDED.xmtp_group_id,
        synthetic_keepr_vault_address = EXCLUDED.synthetic_keepr_vault_address,
        updated_at = NOW()
      RETURNING
        room_id,
        enabled,
        rollout_status,
        telegram_enabled,
        telegram_chat_id,
        telegram_thread_id,
        xmtp_enabled,
        xmtp_group_id,
        synthetic_keepr_vault_address,
        created_at,
        updated_at;
    `
    const row = result.rows?.[0] as RoomChannelBindingRow | undefined
    return row ? rowToBinding(row) : null
  } catch {
    return null
  }
}
