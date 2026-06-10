/**
 * Tracks fingerprints of recently rotated-away Privy refresh tokens so
 * operator seed paths cannot accidentally paste a stale refresh token
 * back into `alfaclub_runtime_secret` (postmortem action #17).
 */

import { createHash } from 'node:crypto'

import { logger } from '../infra/logger.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { readAlfaClubPrivyRefreshToken } from './chatTokenStore.js'

const RETIRED_FP_KEY = 'chat_privy_refresh_retired_fingerprints' as const
const MAX_RETIRED_FINGERPRINTS = 5

export type RefreshTokenSeedRejectReason = 'stale_refresh_token'

export function fingerprintRefreshToken(token: string): string {
  const trimmed = String(token ?? '').trim()
  return createHash('sha256').update(trimmed, 'utf8').digest('hex').slice(0, 32)
}

type RetiredPayload = {
  fingerprints: string[]
  updatedAt: string
}

function parseRetiredPayload(raw: string | null | undefined): RetiredPayload {
  if (!raw) return { fingerprints: [], updatedAt: new Date(0).toISOString() }
  try {
    const parsed = JSON.parse(raw) as Partial<RetiredPayload>
    const fingerprints = Array.isArray(parsed.fingerprints)
      ? parsed.fingerprints.filter((value): value is string => typeof value === 'string')
      : []
    return {
      fingerprints: fingerprints.slice(-MAX_RETIRED_FINGERPRINTS),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return { fingerprints: [], updatedAt: new Date(0).toISOString() }
  }
}

async function readRetiredPayload(): Promise<RetiredPayload> {
  const db = await getDb()
  if (!db) return { fingerprints: [], updatedAt: new Date(0).toISOString() }
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      SELECT secret_value
      FROM alfaclub_runtime_secret
      WHERE secret_key = ${RETIRED_FP_KEY}
      LIMIT 1;
    `
    const row = (result.rows ?? [])[0] as { secret_value?: string } | undefined
    return parseRetiredPayload(row?.secret_value)
  } catch {
    return { fingerprints: [], updatedAt: new Date(0).toISOString() }
  }
}

async function writeRetiredPayload(payload: RetiredPayload): Promise<void> {
  const db = await getDb()
  if (!db) return
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
        ${RETIRED_FP_KEY},
        ${JSON.stringify(payload)},
        NULL,
        'privy-token-refresher',
        NOW()
      )
      ON CONFLICT (secret_key) DO UPDATE
      SET secret_value = EXCLUDED.secret_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW();
    `
  } catch (err) {
    logger.warn('[alfaclub-refresh-retirement] failed to persist retired fingerprints', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Record a refresh token that Privy rotated away from. Best-effort — never
 * blocks the refresher write path.
 */
export async function recordRetiredRefreshToken(refreshToken: string): Promise<void> {
  const fp = fingerprintRefreshToken(refreshToken)
  if (!fp) return
  const current = await readRetiredPayload()
  const next = [...current.fingerprints.filter((value) => value !== fp), fp].slice(
    -MAX_RETIRED_FINGERPRINTS,
  )
  await writeRetiredPayload({ fingerprints: next, updatedAt: new Date().toISOString() })
}

const STALE_REFRESH_MESSAGE =
  'This refresh token was recently rotated away. Log in again at alfaclub.app, export a fresh triplet, and re-seed — do not reuse an old clipboard paste.'

/**
 * Pure seed guard — unit-tested without DB.
 */
export function evaluateRefreshTokenSeed(params: {
  candidateFingerprint: string
  liveRefreshFingerprint: string | null
  retiredFingerprints: string[]
}): { ok: true } | { ok: false; reason: RefreshTokenSeedRejectReason; message: string } {
  const candidateFp = params.candidateFingerprint
  if (params.liveRefreshFingerprint && params.liveRefreshFingerprint === candidateFp) {
    return { ok: true }
  }
  if (params.retiredFingerprints.includes(candidateFp)) {
    return {
      ok: false,
      reason: 'stale_refresh_token',
      message: STALE_REFRESH_MESSAGE,
    }
  }
  return { ok: true }
}

export async function assertRefreshTokenSeedAllowed(
  candidateRefreshToken: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: RefreshTokenSeedRejectReason; message: string }
> {
  const trimmed = String(candidateRefreshToken ?? '').trim()
  if (!trimmed) {
    return {
      ok: false,
      reason: 'stale_refresh_token',
      message: 'privyRefreshToken is required when bootstrapping the refresher.',
    }
  }

  const candidateFp = fingerprintRefreshToken(trimmed)
  const live = await readAlfaClubPrivyRefreshToken()
  const liveFp = live?.value ? fingerprintRefreshToken(live.value) : null
  const retired = await readRetiredPayload()
  return evaluateRefreshTokenSeed({
    candidateFingerprint: candidateFp,
    liveRefreshFingerprint: liveFp,
    retiredFingerprints: retired.fingerprints,
  })
}

/** Test-only reset. */
export async function _clearRetiredRefreshFingerprintsForTests(): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      DELETE FROM alfaclub_runtime_secret
      WHERE secret_key = ${RETIRED_FP_KEY};
    `
  } catch {
    // ignore
  }
}
