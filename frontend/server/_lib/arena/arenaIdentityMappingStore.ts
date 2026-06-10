import { getDb } from '../db/postgres.js'
import { ensureAlfaclubArenaIdentityMappingSchema } from '../db/schemaBootstrap.js'
import { logger } from '../infra/logger.js'
import type { ArenaConfig } from './arenaConfig.js'

const ROOM_ID_MAX_LENGTH = 128
const DEFAULT_ROOM_SENDER_KEY = '*'

type ArenaIdentityRow = {
  room_id: string
  sender_address: string
  enabled: boolean
  arena_agent_id: string
  arena_wallet_address: string
  hl_api_wallet_address: string | null
  updated_at: string
}

const inMemoryArenaIdentityMappings = new Map<string, ArenaIdentityRow>()

/**
 * Test helper to ensure deterministic fallback state across cases.
 * Not used in production flows.
 */
export function __resetArenaIdentityMappingsForTests(): void {
  inMemoryArenaIdentityMappings.clear()
}

export type ArenaIdentitySource = 'user' | 'room_default' | 'env_default'

export type ResolvedArenaIdentity = {
  source: ArenaIdentitySource
  roomId: string | null
  senderAddress: string
  agentId: string | null
  agentWalletAddress: string | null
  hlApiWalletAddress: string | null
}

function normalizeRoomId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > ROOM_ID_MAX_LENGTH) return null
  return trimmed
}

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null
}

function normalizeAgentId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  // Stricter: agent ids from ACP are typically UUID-like or long hex/dash strings.
  if (trimmed.length < 8) return null
  if (!/^[0-9a-fA-F-]+$/.test(trimmed)) return null
  return trimmed
}

function mapRowToIdentity(row: ArenaIdentityRow): ResolvedArenaIdentity {
  return {
    source: row.sender_address === DEFAULT_ROOM_SENDER_KEY ? 'room_default' : 'user',
    roomId: row.room_id,
    senderAddress: row.sender_address,
    agentId: row.arena_agent_id,
    agentWalletAddress: row.arena_wallet_address,
    hlApiWalletAddress: row.hl_api_wallet_address,
  }
}

function toMemoryKey(roomId: string, senderAddress: string): string {
  return `${roomId}:${senderAddress}`
}

function resolveInMemoryIdentity(roomId: string, senderAddress: string): ResolvedArenaIdentity | null {
  const senderRow = inMemoryArenaIdentityMappings.get(toMemoryKey(roomId, senderAddress))
  if (senderRow) return mapRowToIdentity(senderRow)
  const defaultRow = inMemoryArenaIdentityMappings.get(toMemoryKey(roomId, DEFAULT_ROOM_SENDER_KEY))
  if (defaultRow) return mapRowToIdentity(defaultRow)
  return null
}

function upsertInMemoryIdentity(params: {
  roomId: string
  senderAddress: string
  arenaAgentId: string
  arenaWalletAddress: string
  hlApiWalletAddress: string | null
}): void {
  inMemoryArenaIdentityMappings.set(toMemoryKey(params.roomId, params.senderAddress), {
    room_id: params.roomId,
    sender_address: params.senderAddress,
    enabled: true,
    arena_agent_id: params.arenaAgentId,
    arena_wallet_address: params.arenaWalletAddress,
    hl_api_wallet_address: params.hlApiWalletAddress,
    updated_at: new Date().toISOString(),
  })
}

function clearInMemoryIdentity(roomId: string, senderAddress: string): void {
  inMemoryArenaIdentityMappings.delete(toMemoryKey(roomId, senderAddress))
}

function envFallback(baseConfig: ArenaConfig, senderAddress: string, roomId: string | null): ResolvedArenaIdentity {
  return {
    source: 'env_default',
    roomId,
    senderAddress,
    agentId: baseConfig.agentId,
    agentWalletAddress: baseConfig.agentWalletAddress,
    hlApiWalletAddress: baseConfig.hlApiWalletAddress,
  }
}

export async function resolveArenaIdentityForContext(params: {
  roomId: string | null | undefined
  senderAddress: string
  baseConfig: ArenaConfig
}): Promise<ResolvedArenaIdentity> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress) ?? '0x0000000000000000000000000000000000000000'
  if (!roomId) return envFallback(params.baseConfig, senderAddress, null)
  const memoryResolved = resolveInMemoryIdentity(roomId, senderAddress)

  const db = await getDb()
  if (!db) return memoryResolved ?? envFallback(params.baseConfig, senderAddress, roomId)
  try {
    await ensureAlfaclubArenaIdentityMappingSchema(db)
    const result = await db.sql`
      SELECT room_id,
             sender_address,
             enabled,
             arena_agent_id,
             arena_wallet_address,
             hl_api_wallet_address,
             updated_at::text AS updated_at
      FROM alfaclub.arena_identity_mapping
      WHERE room_id = ${roomId}
        AND enabled = TRUE
        AND sender_address IN (${senderAddress}, ${DEFAULT_ROOM_SENDER_KEY})
      ORDER BY CASE WHEN sender_address = ${senderAddress} THEN 0 ELSE 1 END
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as ArenaIdentityRow | null
    if (!row) return memoryResolved ?? envFallback(params.baseConfig, senderAddress, roomId)
    upsertInMemoryIdentity({
      roomId: row.room_id,
      senderAddress: row.sender_address,
      arenaAgentId: row.arena_agent_id,
      arenaWalletAddress: row.arena_wallet_address,
      hlApiWalletAddress: row.hl_api_wallet_address,
    })
    return mapRowToIdentity(row)
  } catch (error) {
    logger.warn('[arena.identity] resolve failed; using env defaults', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return memoryResolved ?? envFallback(params.baseConfig, senderAddress, roomId)
  }
}

export async function upsertArenaIdentityMapping(params: {
  roomId: string
  senderAddress: string | '*'
  arenaAgentId: string
  arenaWalletAddress: string
  hlApiWalletAddress?: string | null
  updatedBy?: string | null
}): Promise<boolean> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress =
    params.senderAddress === DEFAULT_ROOM_SENDER_KEY
      ? DEFAULT_ROOM_SENDER_KEY
      : normalizeAddress(params.senderAddress)
  const arenaAgentId = normalizeAgentId(params.arenaAgentId)
  const arenaWalletAddress = normalizeAddress(params.arenaWalletAddress)
  const hlApiWalletAddress = normalizeAddress(params.hlApiWalletAddress ?? null)
  const updatedBy = normalizeAgentId(params.updatedBy ?? null)

  if (!roomId || !senderAddress || !arenaAgentId || !arenaWalletAddress) return false
  const db = await getDb()
  if (!db) {
    logger.warn('[arena.identity] db unavailable; using in-memory fallback for upsert', {
      roomId,
      senderAddress,
    })
    upsertInMemoryIdentity({
      roomId,
      senderAddress,
      arenaAgentId,
      arenaWalletAddress,
      hlApiWalletAddress,
    })
    return true
  }

  try {
    await ensureAlfaclubArenaIdentityMappingSchema(db)
    await db.sql`
      INSERT INTO alfaclub.arena_identity_mapping (
        room_id,
        sender_address,
        enabled,
        arena_agent_id,
        arena_wallet_address,
        hl_api_wallet_address,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        ${roomId},
        ${senderAddress},
        TRUE,
        ${arenaAgentId},
        ${arenaWalletAddress},
        ${hlApiWalletAddress},
        ${updatedBy},
        NOW(),
        NOW()
      )
      ON CONFLICT (room_id, sender_address) DO UPDATE
      SET enabled = TRUE,
          arena_agent_id = EXCLUDED.arena_agent_id,
          arena_wallet_address = EXCLUDED.arena_wallet_address,
          hl_api_wallet_address = EXCLUDED.hl_api_wallet_address,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW();
    `
    upsertInMemoryIdentity({
      roomId,
      senderAddress,
      arenaAgentId,
      arenaWalletAddress,
      hlApiWalletAddress,
    })
    return true
  } catch (error) {
    logger.warn('[arena.identity] upsert failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    upsertInMemoryIdentity({
      roomId,
      senderAddress,
      arenaAgentId,
      arenaWalletAddress,
      hlApiWalletAddress,
    })
    return true
  }
}

export async function clearArenaIdentityMapping(params: {
  roomId: string
  senderAddress: string | '*'
}): Promise<boolean> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress =
    params.senderAddress === DEFAULT_ROOM_SENDER_KEY
      ? DEFAULT_ROOM_SENDER_KEY
      : normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return false

  const db = await getDb()
  if (!db) {
    logger.warn('[arena.identity] db unavailable; using in-memory fallback for clear', {
      roomId,
      senderAddress,
    })
    clearInMemoryIdentity(roomId, senderAddress)
    return true
  }
  try {
    await ensureAlfaclubArenaIdentityMappingSchema(db)
    await db.sql`
      DELETE FROM alfaclub.arena_identity_mapping
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress};
    `
    clearInMemoryIdentity(roomId, senderAddress)
    return true
  } catch (error) {
    logger.warn('[arena.identity] clear failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    clearInMemoryIdentity(roomId, senderAddress)
    return true
  }
}
