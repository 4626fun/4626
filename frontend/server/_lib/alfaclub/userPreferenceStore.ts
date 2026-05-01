/**
 * AlfaClub per-(room, sender) chat personalization store.
 *
 * Boundary contract
 * -----------------
 * - Owned by the Vercel control plane (AlfaClub chat-bridge / Hermit lane).
 * - Reads and writes are best-effort: a DB outage MUST NOT break a chat
 *   reply. All callers receive `null` / `false` and continue with whatever
 *   default the feature would have used pre-personalization.
 * - This module **never** stores auth/session material (no Privy tokens,
 *   no JWTs, no refresh tokens). Schema-level RLS deny-all + a non-secret
 *   value column keep it that way; architecture-boundary tests forbid
 *   creative-lane code from importing this file.
 *
 * Data model
 * ----------
 * Generic key/value, scoped by (room_id, sender_address). The first key
 * in production is `hermit.spanish_dialect`; future keys (tone, meme
 * style, emoji density, …) ride the same table without another
 * migration.
 *
 * Keys are namespaced by feature (`hermit.*`, `keepr.*`) so reads can
 * filter by prefix and the table stays self-documenting.
 */

import { logger } from '../infra/logger.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

const ROOM_ID_MAX_LENGTH = 128
const PREFERENCE_KEY_MAX_LENGTH = 128
const PREFERENCE_VALUE_MAX_LENGTH = 256
const UPDATED_BY_MAX_LENGTH = 128

export type AlfaClubUserPreferenceRecord = {
  roomId: string
  senderAddress: string
  preferenceKey: string
  preferenceValue: string | null
  updatedBy: string | null
  updatedAt: string
}

type PreferenceRow = {
  room_id: string
  sender_address: string
  preference_key: string
  preference_value: string | null
  updated_by: string | null
  updated_at: string
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeRoomId(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > ROOM_ID_MAX_LENGTH) return null
  return trimmed
}

function normalizeSenderAddress(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(trimmed) ? trimmed : null
}

function normalizePreferenceKey(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > PREFERENCE_KEY_MAX_LENGTH) return null
  // Allow alnum, dot, underscore, dash. Forbids spaces and quoting.
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

function normalizePreferenceValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > PREFERENCE_VALUE_MAX_LENGTH ? trimmed.slice(0, PREFERENCE_VALUE_MAX_LENGTH) : trimmed
}

function normalizeUpdatedBy(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > UPDATED_BY_MAX_LENGTH ? trimmed.slice(0, UPDATED_BY_MAX_LENGTH) : trimmed
}

function describeDbError(err: unknown): Record<string, unknown> {
  const anyErr = err as Record<string, unknown> | null | undefined
  return {
    code: anyErr && typeof anyErr.code === 'string' ? anyErr.code : undefined,
    message: (err instanceof Error ? err.message : String(err ?? '')).slice(0, 200),
    constraint: anyErr && typeof anyErr.constraint === 'string' ? anyErr.constraint : undefined,
    routine: anyErr && typeof anyErr.routine === 'string' ? anyErr.routine : undefined,
  }
}

function rowToRecord(row: PreferenceRow): AlfaClubUserPreferenceRecord {
  return {
    roomId: row.room_id,
    senderAddress: row.sender_address,
    preferenceKey: row.preference_key,
    preferenceValue: row.preference_value,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

function isPersistenceDisabled(): boolean {
  const v = (process.env.ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Read a single preference. Returns `null` on any failure mode (DB
 * unavailable, query error, value missing) so callers can fall back
 * to their default behavior.
 */
export async function readUserPreference(params: {
  roomId: string
  senderAddress: string
  preferenceKey: string
}): Promise<AlfaClubUserPreferenceRecord | null> {
  if (isPersistenceDisabled()) return null
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeSenderAddress(params.senderAddress)
  const preferenceKey = normalizePreferenceKey(params.preferenceKey)
  if (!roomId || !senderAddress || !preferenceKey) return null

  const db = await getDb()
  if (!db) return null
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      SELECT room_id,
             sender_address,
             preference_key,
             preference_value,
             updated_by,
             updated_at::text AS updated_at
      FROM alfaclub.user_preference
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
        AND preference_key = ${preferenceKey}
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as PreferenceRow | null
    return row ? rowToRecord(row) : null
  } catch (err) {
    logger.warn('[alfaclub-user-preference] read failed', {
      preferenceKey,
      ...describeDbError(err),
    })
    return null
  }
}

/**
 * Upsert a preference. Returns `true` if the row landed, `false`
 * otherwise (DB unavailable, validation failure, query error). Callers
 * should not throw on a `false` — the chat reply must still go out.
 */
export async function upsertUserPreference(params: {
  roomId: string
  senderAddress: string
  preferenceKey: string
  preferenceValue: string | null
  updatedBy?: string | null
}): Promise<boolean> {
  if (isPersistenceDisabled()) return false
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeSenderAddress(params.senderAddress)
  const preferenceKey = normalizePreferenceKey(params.preferenceKey)
  if (!roomId || !senderAddress || !preferenceKey) return false
  const value = normalizePreferenceValue(params.preferenceValue)
  const updatedBy = normalizeUpdatedBy(params.updatedBy ?? null)

  const db = await getDb()
  if (!db) return false
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      INSERT INTO alfaclub.user_preference (
        room_id,
        sender_address,
        preference_key,
        preference_value,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        ${roomId},
        ${senderAddress},
        ${preferenceKey},
        ${value},
        ${updatedBy},
        NOW(),
        NOW()
      )
      ON CONFLICT (room_id, sender_address, preference_key) DO UPDATE
      SET preference_value = EXCLUDED.preference_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW();
    `
    return true
  } catch (err) {
    logger.warn('[alfaclub-user-preference] upsert failed', {
      preferenceKey,
      ...describeDbError(err),
    })
    return false
  }
}

/**
 * Delete a preference. Idempotent. Returns `true` on success
 * (regardless of whether a row existed) and `false` on DB error.
 */
export async function deleteUserPreference(params: {
  roomId: string
  senderAddress: string
  preferenceKey: string
}): Promise<boolean> {
  if (isPersistenceDisabled()) return false
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeSenderAddress(params.senderAddress)
  const preferenceKey = normalizePreferenceKey(params.preferenceKey)
  if (!roomId || !senderAddress || !preferenceKey) return false

  const db = await getDb()
  if (!db) return false
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      DELETE FROM alfaclub.user_preference
      WHERE room_id = ${roomId}
        AND sender_address = ${senderAddress}
        AND preference_key = ${preferenceKey};
    `
    return true
  } catch (err) {
    logger.warn('[alfaclub-user-preference] delete failed', {
      preferenceKey,
      ...describeDbError(err),
    })
    return false
  }
}

export const _userPreferenceInternals = {
  normalizeRoomId,
  normalizeSenderAddress,
  normalizePreferenceKey,
  normalizePreferenceValue,
  normalizeUpdatedBy,
}
