/**
 * AlfaClub chat-bridge JWT persistence.
 *
 * Stores the short-lived AlfaClub bearer token in Postgres so operators can
 * rotate it at runtime without restarting the Railway XMTP process.
 *
 * Security model:
 * - Table is private (RLS deny-all in [schema.ts](./schema.ts)).
 * - This module never returns the raw token from metadata helpers.
 */

import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

const CHAT_TOKEN_KEY = 'chat_jwt' as const

export type AlfaClubChatTokenRecord = {
  jwt: string
  updatedAt: string
  expiresAt: string | null
  updatedBy: string | null
}

export type AlfaClubChatTokenMeta = {
  hasToken: boolean
  updatedAt: string | null
  expiresAt: string | null
  updatedBy: string | null
  isExpired: boolean | null
}

type TokenRow = {
  secret_value: string
  updated_at: string
  expires_at: string | null
  updated_by: string | null
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  const payloadSegment = parts[1] ?? ''
  if (!payloadSegment) return null
  try {
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Returns an ISO timestamp for JWT exp when present/valid, otherwise null.
 */
export function extractJwtExpiryIso(jwt: string): string | null {
  const payload = decodeJwtPayload(jwt)
  if (!payload) return null
  const expRaw = payload.exp
  const exp = typeof expRaw === 'number' ? expRaw : Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) return null
  return new Date(exp * 1000).toISOString()
}

function toMeta(row: TokenRow | null): AlfaClubChatTokenMeta {
  if (!row) {
    return {
      hasToken: false,
      updatedAt: null,
      expiresAt: null,
      updatedBy: null,
      isExpired: null,
    }
  }
  const expiresAt = row.expires_at
  const expired =
    typeof expiresAt === 'string' && expiresAt.trim()
      ? Date.parse(expiresAt) <= Date.now()
      : null
  return {
    hasToken: true,
    updatedAt: row.updated_at ?? null,
    expiresAt,
    updatedBy: row.updated_by ?? null,
    isExpired: expired,
  }
}

export async function readAlfaClubChatToken(): Promise<AlfaClubChatTokenRecord | null> {
  const db = await getDb()
  if (!db) return null
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      SELECT secret_value,
             updated_at::text AS updated_at,
             expires_at::text AS expires_at,
             updated_by
      FROM alfaclub_runtime_secret
      WHERE secret_key = ${CHAT_TOKEN_KEY}
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as TokenRow | null
    if (!row?.secret_value) return null
    return {
      jwt: row.secret_value,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at ?? null,
      updatedBy: row.updated_by ?? null,
    }
  } catch {
    return null
  }
}

export async function readAlfaClubChatTokenMeta(): Promise<AlfaClubChatTokenMeta> {
  const db = await getDb()
  if (!db) {
    return {
      hasToken: false,
      updatedAt: null,
      expiresAt: null,
      updatedBy: null,
      isExpired: null,
    }
  }
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      SELECT secret_value,
             updated_at::text AS updated_at,
             expires_at::text AS expires_at,
             updated_by
      FROM alfaclub_runtime_secret
      WHERE secret_key = ${CHAT_TOKEN_KEY}
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as TokenRow | null
    return toMeta(row)
  } catch {
    return {
      hasToken: false,
      updatedAt: null,
      expiresAt: null,
      updatedBy: null,
      isExpired: null,
    }
  }
}

export async function upsertAlfaClubChatToken(params: {
  jwt: string
  updatedBy?: string | null
}): Promise<AlfaClubChatTokenMeta | null> {
  const db = await getDb()
  if (!db) return null
  const jwt = String(params.jwt ?? '').trim()
  if (!jwt) return null
  const expiresAt = extractJwtExpiryIso(jwt)
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      INSERT INTO alfaclub_runtime_secret (
        secret_key,
        secret_value,
        expires_at,
        updated_by,
        updated_at
      ) VALUES (
        ${CHAT_TOKEN_KEY},
        ${jwt},
        ${expiresAt},
        ${params.updatedBy ?? null},
        NOW()
      )
      ON CONFLICT (secret_key) DO UPDATE
      SET secret_value = EXCLUDED.secret_value,
          expires_at = EXCLUDED.expires_at,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      RETURNING secret_value,
                updated_at::text AS updated_at,
                expires_at::text AS expires_at,
                updated_by;
    `
    const row = ((result.rows ?? [])[0] ?? null) as TokenRow | null
    return toMeta(row)
  } catch {
    return null
  }
}

export async function clearAlfaClubChatToken(params?: {
  clearedBy?: string | null
}): Promise<AlfaClubChatTokenMeta | null> {
  const db = await getDb()
  if (!db) return null
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      DELETE FROM alfaclub_runtime_secret
      WHERE secret_key = ${CHAT_TOKEN_KEY};
    `
    return {
      hasToken: false,
      updatedAt: new Date().toISOString(),
      expiresAt: null,
      updatedBy: params?.clearedBy ?? null,
      isExpired: null,
    }
  } catch {
    return null
  }
}

