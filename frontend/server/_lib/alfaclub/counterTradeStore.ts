import { getDb } from '../db/postgres.js'
import { ensureAlfaclubCounterTradeSchema } from '../db/schemaBootstrap.js'
import { logger } from '../infra/logger.js'
import type { CounterTradeBias, CounterTradePreset } from './counterTradeConfig.js'

export type CounterTradeUserState = 'not_opted_in' | 'active' | 'paused'
export type CounterTradeActionStatus = 'executed' | 'skipped' | 'blocked' | 'failed'

/**
 * Ledger `reason` for mirrored exit executions (bot closed its position after
 * the countered user closed / was liquidated out of theirs). Exit rows reuse
 * status 'executed' (DB CHECK constraint) but are excluded from the entry
 * cooldown clock and the hourly/daily usage windows.
 */
export const COUNTER_TRADE_EXIT_EXECUTED_REASON = 'exit_executed'

/**
 * Ledger `reason` for liquidation-defense partial reduces (losing leg shaved
 * to push its liquidation price away). Risk-reducing — excluded from entry
 * cooldown and usage windows, same as mirrored exits.
 */
export const COUNTER_TRADE_DEFENSE_EXECUTED_REASON = 'defense_reduce_executed'

/**
 * Ledger `reason` for profit-harvest partial closes (winning leg partially
 * realized to refill the silo's USDC buffer). Risk-reducing — excluded from
 * entry cooldown and usage windows.
 */
export const COUNTER_TRADE_HARVEST_EXECUTED_REASON = 'harvest_tp_executed'

/**
 * Executed-row reasons that are risk-reducing rather than new entries. These
 * never advance the cooldown clock and never count toward hourly/daily entry
 * caps.
 */
const NON_ENTRY_EXECUTED_REASONS = [
  COUNTER_TRADE_EXIT_EXECUTED_REASON,
  COUNTER_TRADE_DEFENSE_EXECUTED_REASON,
  COUNTER_TRADE_HARVEST_EXECUTED_REASON,
] as const

export type CounterTradeRoomStrategy = {
  roomId: string
  enabled: boolean
  killSwitch: boolean
  globalBias: CounterTradeBias
  updatedAt: string
}

export type CounterTradeUserOptIn = {
  roomId: string
  senderAddress: string
  state: CounterTradeUserState
  preset: CounterTradePreset
  pauseReason: string | null
  pausedAt: string | null
  lastActionAt: string | null
  updatedAt: string
}

export type CounterTradeUsageWindow = {
  actionCount: number
  executedCount: number
  notionalUsd: number
}

export type CounterTradeActionRow = {
  id: number
  roomId: string
  senderAddress: string
  eventKey: string
  status: CounterTradeActionStatus
  reason: string
  counterSide: 'long' | 'short' | null
  counterNotionalUsd: number | null
  counterLeverage: number | null
  createdAt: string
}

type RoomStrategyRow = {
  room_id: string
  enabled: boolean
  kill_switch: boolean
  global_bias: CounterTradeBias
  updated_at: string
}

type UserOptInRow = {
  room_id: string
  sender_address: string
  state: CounterTradeUserState
  preset: CounterTradePreset
  pause_reason: string | null
  paused_at: string | null
  last_action_at: string | null
  updated_at: string
}

function normalizeRoomId(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || trimmed.length > 128) return null
  return trimmed
}

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null
}

function mapRoomStrategyRow(row: RoomStrategyRow): CounterTradeRoomStrategy {
  return {
    roomId: row.room_id,
    enabled: row.enabled,
    killSwitch: row.kill_switch,
    globalBias: row.global_bias,
    updatedAt: row.updated_at,
  }
}

function mapUserOptInRow(row: UserOptInRow): CounterTradeUserOptIn {
  return {
    roomId: row.room_id,
    senderAddress: row.sender_address,
    state: row.state,
    preset: row.preset,
    pauseReason: row.pause_reason,
    pausedAt: row.paused_at,
    lastActionAt: row.last_action_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureCounterTradeStorageReady(): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  await ensureAlfaclubCounterTradeSchema(db)
  return true
}

export async function readOrCreateCounterTradeRoomStrategy(
  roomIdInput: string,
): Promise<CounterTradeRoomStrategy | null> {
  const roomId = normalizeRoomId(roomIdInput)
  if (!roomId) return null

  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.counter_trade_room_strategy (
        room_id, enabled, kill_switch, global_bias, updated_at
      ) VALUES (
        ${roomId}, TRUE, FALSE, 'neutral', NOW()
      )
      ON CONFLICT (room_id) DO UPDATE
      SET room_id = EXCLUDED.room_id
      RETURNING room_id, enabled, kill_switch, global_bias, updated_at::text AS updated_at;
    `
    const row = result.rows?.[0] as RoomStrategyRow | undefined
    return row ? mapRoomStrategyRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.room_strategy_read_failed', {
      roomId,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function setCounterTradeGlobalBias(params: {
  roomId: string
  globalBias: CounterTradeBias
}): Promise<CounterTradeRoomStrategy | null> {
  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) return null
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.counter_trade_room_strategy (
        room_id, enabled, kill_switch, global_bias, updated_at
      ) VALUES (
        ${roomId}, TRUE, FALSE, ${params.globalBias}, NOW()
      )
      ON CONFLICT (room_id) DO UPDATE
      SET global_bias = EXCLUDED.global_bias,
          updated_at = NOW()
      RETURNING room_id, enabled, kill_switch, global_bias, updated_at::text AS updated_at;
    `
    const row = result.rows?.[0] as RoomStrategyRow | undefined
    return row ? mapRoomStrategyRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.room_strategy_set_bias_failed', {
      roomId,
      bias: params.globalBias,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function upsertCounterTradeOptIn(params: {
  roomId: string
  senderAddress: string
  preset: CounterTradePreset
}): Promise<CounterTradeUserOptIn | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null

  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.counter_trade_user_opt_in (
        room_id, sender_address, state, preset, pause_reason, paused_at, last_action_at, updated_at
      ) VALUES (
        ${roomId}, ${senderAddress}, 'active', ${params.preset}, NULL, NULL, NULL, NOW()
      )
      ON CONFLICT (room_id, sender_address) DO UPDATE
      SET state = 'active',
          preset = EXCLUDED.preset,
          pause_reason = NULL,
          paused_at = NULL,
          updated_at = NOW()
      RETURNING room_id, sender_address, state, preset, pause_reason, paused_at,
                last_action_at::text AS last_action_at,
                updated_at::text AS updated_at;
    `
    const row = result.rows?.[0] as UserOptInRow | undefined
    return row ? mapUserOptInRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.optin_upsert_failed', {
      roomId,
      senderAddress,
      preset: params.preset,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function pauseCounterTradeOptIn(params: {
  roomId: string
  senderAddress: string
  reason?: string | null
}): Promise<CounterTradeUserOptIn | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      UPDATE alfaclub.counter_trade_user_opt_in
      SET state = 'paused',
          pause_reason = ${String(params.reason ?? 'user_paused')},
          paused_at = NOW(),
          updated_at = NOW()
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
      RETURNING room_id, sender_address, state, preset, pause_reason, paused_at,
                last_action_at::text AS last_action_at,
                updated_at::text AS updated_at;
    `
    const row = result.rows?.[0] as UserOptInRow | undefined
    return row ? mapUserOptInRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.optin_pause_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function resumeCounterTradeOptIn(params: {
  roomId: string
  senderAddress: string
}): Promise<CounterTradeUserOptIn | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      UPDATE alfaclub.counter_trade_user_opt_in
      SET state = 'active',
          pause_reason = NULL,
          paused_at = NULL,
          updated_at = NOW()
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
      RETURNING room_id, sender_address, state, preset, pause_reason, paused_at,
                last_action_at::text AS last_action_at,
                updated_at::text AS updated_at;
    `
    const row = result.rows?.[0] as UserOptInRow | undefined
    return row ? mapUserOptInRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.optin_resume_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function readCounterTradeUserOptIn(params: {
  roomId: string
  senderAddress: string
}): Promise<CounterTradeUserOptIn | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)
  try {
    const result = await db.sql`
      SELECT room_id, sender_address, state, preset, pause_reason, paused_at,
             last_action_at::text AS last_action_at,
             updated_at::text AS updated_at
      FROM alfaclub.counter_trade_user_opt_in
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
      LIMIT 1;
    `
    const row = result.rows?.[0] as UserOptInRow | undefined
    return row ? mapUserOptInRow(row) : null
  } catch (error) {
    logger.warn('counter_trade.optin_read_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function listActiveCounterTradeOptIns(params: {
  roomId: string
  limit?: number
}): Promise<CounterTradeUserOptIn[]> {
  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) return []
  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubCounterTradeSchema(db)

  const limit = Math.min(Math.max(1, params.limit ?? 200), 1000)
  try {
    const result = await db.sql`
      SELECT room_id, sender_address, state, preset, pause_reason, paused_at,
             last_action_at::text AS last_action_at,
             updated_at::text AS updated_at
      FROM alfaclub.counter_trade_user_opt_in
      WHERE room_id = ${roomId}
        AND state = 'active'
      ORDER BY updated_at DESC
      LIMIT ${limit};
    `
    return (result.rows as UserOptInRow[]).map(mapUserOptInRow)
  } catch (error) {
    logger.warn('counter_trade.optin_list_failed', {
      roomId,
      message: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function enforceSingleActiveCounterTradeActor(params: {
  roomId: string
  survivorSenderAddress: string
  pauseReason?: string
}): Promise<{ roomId: string; survivorSenderAddress: string; pausedSenderAddresses: string[] } | null> {
  const roomId = normalizeRoomId(params.roomId)
  const survivorSenderAddress = normalizeAddress(params.survivorSenderAddress)
  if (!roomId || !survivorSenderAddress) return null
  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      UPDATE alfaclub.counter_trade_user_opt_in
      SET state = 'paused',
          pause_reason = ${String(params.pauseReason ?? 'room_single_actor_enforced')},
          paused_at = NOW(),
          updated_at = NOW()
      WHERE room_id = ${roomId}
        AND state = 'active'
        AND sender_address <> ${survivorSenderAddress}
      RETURNING sender_address;
    `
    const rows = (result.rows ?? []) as Array<{ sender_address: string }>
    return {
      roomId,
      survivorSenderAddress,
      pausedSenderAddresses: rows.map((row) => row.sender_address),
    }
  } catch (error) {
    logger.warn('counter_trade.single_actor_enforce_failed', {
      roomId,
      survivorSenderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function registerCounterTradeEventIfNew(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  coin: string | null
  userSide: 'long' | 'short' | null
  userNotionalUsd: number | null
  eventTimeMs: number
  rawEvent: Record<string, unknown>
}): Promise<boolean> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  const eventKey = String(params.eventKey ?? '').trim()
  if (!roomId || !senderAddress || !eventKey) return false
  const db = await getDb()
  if (!db) return false
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.counter_trade_event_ledger (
        room_id, sender_address, event_key, coin, user_side, user_notional_usd, event_time_ms, raw_event, created_at
      ) VALUES (
        ${roomId},
        ${senderAddress},
        ${eventKey},
        ${params.coin},
        ${params.userSide},
        ${params.userNotionalUsd},
        ${Math.floor(params.eventTimeMs)},
        ${JSON.stringify(params.rawEvent)},
        NOW()
      )
      ON CONFLICT (room_id, sender_address, event_key) DO NOTHING
      RETURNING event_key;
    `
    return Boolean(result.rows?.length)
  } catch (error) {
    logger.warn('counter_trade.event_register_failed', {
      roomId,
      senderAddress,
      eventKey,
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function recordCounterTradeAction(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  status: CounterTradeActionStatus
  reason: string
  counterSide: 'long' | 'short' | null
  counterNotionalUsd: number | null
  counterLeverage: number | null
}): Promise<void> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return
  const db = await getDb()
  if (!db) return
  await ensureAlfaclubCounterTradeSchema(db)
  try {
    await db.sql`
      INSERT INTO alfaclub.counter_trade_action_ledger (
        room_id, sender_address, event_key, status, reason,
        counter_side, counter_notional_usd, counter_leverage, created_at
      ) VALUES (
        ${roomId}, ${senderAddress}, ${params.eventKey}, ${params.status}, ${params.reason},
        ${params.counterSide}, ${params.counterNotionalUsd}, ${params.counterLeverage}, NOW()
      );
    `
    // Only entry executions advance the cooldown clock; mirrored exits,
    // defense reduces, and profit harvests are risk-reducing and must not
    // delay the next counter-entry.
    if (
      params.status === 'executed' &&
      !(NON_ENTRY_EXECUTED_REASONS as readonly string[]).includes(params.reason)
    ) {
      await db.sql`
        UPDATE alfaclub.counter_trade_user_opt_in
        SET last_action_at = NOW(), updated_at = NOW()
        WHERE room_id = ${roomId}
          AND sender_address = ${senderAddress};
      `
    }
  } catch (error) {
    logger.warn('counter_trade.action_record_failed', {
      roomId,
      senderAddress,
      eventKey: params.eventKey,
      status: params.status,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function readCounterTradeUsageWindow(params: {
  roomId: string
  senderAddress: string
  sinceMs: number
}): Promise<CounterTradeUsageWindow> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) {
    return { actionCount: 0, executedCount: 0, notionalUsd: 0 }
  }

  const db = await getDb()
  if (!db) return { actionCount: 0, executedCount: 0, notionalUsd: 0 }
  await ensureAlfaclubCounterTradeSchema(db)

  try {
    const sinceIso = new Date(params.sinceMs).toISOString()
    const [exitReason, defenseReason, harvestReason] = NON_ENTRY_EXECUTED_REASONS
    const result = await db.sql`
      SELECT
        COUNT(*)::int AS action_count,
        COUNT(*) FILTER (
          WHERE status = 'executed'
            AND reason NOT IN (${exitReason}, ${defenseReason}, ${harvestReason})
        )::int AS executed_count,
        COALESCE(SUM(counter_notional_usd) FILTER (
          WHERE status = 'executed'
            AND reason NOT IN (${exitReason}, ${defenseReason}, ${harvestReason})
        ), 0)::text AS notional_usd
      FROM alfaclub.counter_trade_action_ledger
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
        AND created_at >= ${sinceIso}::timestamptz;
    `
    const row = result.rows?.[0] as
      | { action_count?: number; executed_count?: number; notional_usd?: string }
      | undefined
    return {
      actionCount: Number(row?.action_count ?? 0),
      executedCount: Number(row?.executed_count ?? 0),
      notionalUsd: Number(row?.notional_usd ?? '0'),
    }
  } catch (error) {
    logger.warn('counter_trade.usage_window_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return { actionCount: 0, executedCount: 0, notionalUsd: 0 }
  }
}

export async function listRecentCounterTradeActions(params: {
  roomId: string
  senderAddress: string
  limit?: number
}): Promise<CounterTradeActionRow[]> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return []
  const db = await getDb()
  if (!db) return []
  await ensureAlfaclubCounterTradeSchema(db)
  const limit = Math.min(Math.max(1, params.limit ?? 20), 200)
  try {
    const result = await db.sql`
      SELECT id,
             room_id,
             sender_address,
             event_key,
             status,
             reason,
             counter_side,
             counter_notional_usd::text AS counter_notional_usd,
             counter_leverage::text AS counter_leverage,
             created_at::text AS created_at
      FROM alfaclub.counter_trade_action_ledger
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id ?? 0),
      roomId: String(row.room_id ?? roomId),
      senderAddress: String(row.sender_address ?? senderAddress),
      eventKey: String(row.event_key ?? ''),
      status: String(row.status ?? 'skipped') as CounterTradeActionStatus,
      reason: String(row.reason ?? ''),
      counterSide:
        row.counter_side === 'long' || row.counter_side === 'short'
          ? (row.counter_side as 'long' | 'short')
          : null,
      counterNotionalUsd:
        row.counter_notional_usd == null ? null : Number(row.counter_notional_usd),
      counterLeverage: row.counter_leverage == null ? null : Number(row.counter_leverage),
      createdAt: String(row.created_at ?? ''),
    }))
  } catch (error) {
    logger.warn('counter_trade.action_list_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

