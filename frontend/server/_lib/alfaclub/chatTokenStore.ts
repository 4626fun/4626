/**
 * AlfaClub chat-bridge JWT persistence.
 *
 * Stores the short-lived AlfaClub bearer token in Postgres so operators can
 * rotate it at runtime without restarting the Railway XMTP process or
 * waiting for the next Vercel cron deploy.
 *
 * Security model:
 * - Table is private (RLS deny-all in [schema.ts](./schema.ts)).
 * - This module never returns the raw token from metadata helpers.
 */

import { logger } from '../infra/logger.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

/**
 * Extract a redacted error fingerprint suitable for logs.
 * Never includes any value from `params.value`/`params.jwt` — only
 * pg error code, message, and constraint metadata. Production logs
 * for the token store must remain free of token material so they
 * can ship to general observability backends.
 */
function describeDbError(err: unknown): Record<string, unknown> {
  const anyErr = err as Record<string, unknown> | null | undefined
  const code = anyErr && typeof anyErr.code === 'string' ? anyErr.code : undefined
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? '')
  return {
    code,
    message: message.slice(0, 200),
    constraint: anyErr && typeof anyErr.constraint === 'string' ? anyErr.constraint : undefined,
    detail: anyErr && typeof anyErr.detail === 'string' ? anyErr.detail.slice(0, 200) : undefined,
    routine: anyErr && typeof anyErr.routine === 'string' ? anyErr.routine : undefined,
  }
}

const CHAT_TOKEN_KEY = 'chat_jwt' as const
// Privy session tokens needed to refresh `chat_jwt` (identity token) without
// an operator re-login. Stored separately from the identity token because
// only the identity token is used by alfaclub's API; the others are only
// consumed by the Privy refresh flow.
const CHAT_ACCESS_TOKEN_KEY = 'chat_privy_access_token' as const
const CHAT_REFRESH_TOKEN_KEY = 'chat_privy_refresh_token' as const

export type AlfaClubChatTokenRecord = {
  jwt: string
  updatedAt: string
  expiresAt: string | null
  updatedBy: string | null
}

export type AlfaClubPrivySecretRecord = {
  value: string
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
  if (!db) {
    logger.error('[alfaclub-chat-token-store] chat token upsert skipped: db unavailable', {
      secretKey: CHAT_TOKEN_KEY,
    })
    return null
  }
  const jwt = String(params.jwt ?? '').trim()
  if (!jwt) {
    logger.error('[alfaclub-chat-token-store] chat token upsert skipped: empty jwt', {
      secretKey: CHAT_TOKEN_KEY,
    })
    return null
  }
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
    if (row) return toMeta(row)

    // RETURNING came back empty even though the SQL did not throw. The
    // observed production failure mode here is an RLS / role permission
    // quirk where the underlying UPDATE is silently filtered (USING
    // returns false for the runtime role) — the row is left untouched and
    // RETURNING is empty, but no Postgres error surfaces. Read the row back
    // via a separate SELECT and treat the upsert as successful only if the
    // persisted secret_value matches what we just tried to write. Reads
    // against this table are known to work for the runtime role (the chat
    // bridge polls it on every tick), so a value mismatch unambiguously
    // means the write did not land.
    const verify = await db.sql`
      SELECT secret_value,
             updated_at::text AS updated_at,
             expires_at::text AS expires_at,
             updated_by
      FROM alfaclub_runtime_secret
      WHERE secret_key = ${CHAT_TOKEN_KEY}
      LIMIT 1;
    `
    const verifyRow = ((verify.rows ?? [])[0] ?? null) as TokenRow | null
    if (verifyRow && verifyRow.secret_value === jwt) {
      logger.warn(
        '[alfaclub-chat-token-store] chat token upsert RETURNING was empty but SELECT confirms persisted value matches; treating as success',
        { secretKey: CHAT_TOKEN_KEY },
      )
      return toMeta(verifyRow)
    }
    logger.error(
      '[alfaclub-chat-token-store] chat token upsert produced no RETURNING row and SELECT-back does not match — write was silently rejected (likely RLS USING(false) / missing UPDATE grant for runtime role)',
      {
        secretKey: CHAT_TOKEN_KEY,
        verifyRowPresent: Boolean(verifyRow),
        verifyValueMatches: verifyRow ? verifyRow.secret_value === jwt : null,
      },
    )
    return null
  } catch (err) {
    logger.error('[alfaclub-chat-token-store] chat token upsert failed', {
      secretKey: CHAT_TOKEN_KEY,
      ...describeDbError(err),
    })
    return null
  }
}

async function readPrivySecret(
  secretKey: typeof CHAT_ACCESS_TOKEN_KEY | typeof CHAT_REFRESH_TOKEN_KEY,
): Promise<AlfaClubPrivySecretRecord | null> {
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
      WHERE secret_key = ${secretKey}
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as TokenRow | null
    if (!row?.secret_value) return null
    return {
      value: row.secret_value,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at ?? null,
      updatedBy: row.updated_by ?? null,
    }
  } catch {
    return null
  }
}

async function upsertPrivySecret(
  secretKey: typeof CHAT_ACCESS_TOKEN_KEY | typeof CHAT_REFRESH_TOKEN_KEY,
  params: { value: string; updatedBy?: string | null; expiresAt?: string | null },
): Promise<boolean> {
  const db = await getDb()
  if (!db) {
    logger.error('[alfaclub-chat-token-store] privy secret upsert skipped: db unavailable', {
      secretKey,
    })
    return false
  }
  const trimmed = String(params.value ?? '').trim()
  if (!trimmed) {
    logger.error('[alfaclub-chat-token-store] privy secret upsert skipped: empty value', {
      secretKey,
    })
    return false
  }
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      INSERT INTO alfaclub_runtime_secret (
        secret_key,
        secret_value,
        expires_at,
        updated_by,
        updated_at
      ) VALUES (
        ${secretKey},
        ${trimmed},
        ${params.expiresAt ?? null},
        ${params.updatedBy ?? null},
        NOW()
      )
      ON CONFLICT (secret_key) DO UPDATE
      SET secret_value = EXCLUDED.secret_value,
          expires_at = EXCLUDED.expires_at,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW();
    `
    return true
  } catch (err) {
    logger.error('[alfaclub-chat-token-store] privy secret upsert failed', {
      secretKey,
      ...describeDbError(err),
    })
    return false
  }
}

export async function readAlfaClubPrivyAccessToken(): Promise<AlfaClubPrivySecretRecord | null> {
  return readPrivySecret(CHAT_ACCESS_TOKEN_KEY)
}

export async function readAlfaClubPrivyRefreshToken(): Promise<AlfaClubPrivySecretRecord | null> {
  return readPrivySecret(CHAT_REFRESH_TOKEN_KEY)
}

export async function upsertAlfaClubPrivyAccessToken(params: {
  accessToken: string
  updatedBy?: string | null
}): Promise<boolean> {
  const expiresAt = extractJwtExpiryIso(params.accessToken)
  return upsertPrivySecret(CHAT_ACCESS_TOKEN_KEY, {
    value: params.accessToken,
    updatedBy: params.updatedBy,
    expiresAt,
  })
}

export async function upsertAlfaClubPrivyRefreshToken(params: {
  refreshToken: string
  updatedBy?: string | null
}): Promise<boolean> {
  // Refresh tokens are opaque strings, not JWTs — no meaningful expiresAt.
  // Privy documents a 30-day default lifetime but doesn't encode it in the
  // token itself. Leave expires_at null and rely on Privy returning an
  // error if the refresh token has expired.
  return upsertPrivySecret(CHAT_REFRESH_TOKEN_KEY, {
    value: params.refreshToken,
    updatedBy: params.updatedBy,
    expiresAt: null,
  })
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

