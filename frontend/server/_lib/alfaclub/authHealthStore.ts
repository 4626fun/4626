/**
 * AlfaClub auth health store.
 *
 * Persists redacted refresh-status metadata so operators (and a public-but-
 * cron-secret-gated `/chat-auth-health` endpoint) can answer "when did the
 * refresher last succeed?", "what was the last failure?", and "who wrote the
 * `chat_jwt` slot?" without ever reading or returning the token material
 * itself.
 *
 * Storage convention
 * ------------------
 * Health rows live alongside the tokens in `alfaclub_runtime_secret` under
 * the `chat_auth_health:*` key prefix. `secret_value` holds a small JSON
 * blob (timestamps, status code, writer name, rotation flag, JWT exp) —
 * NEVER a token.
 *
 * Putting the rows in the same table avoids a schema migration in this
 * patch (the table already has RLS deny-all) and keeps health/auth
 * lifecycle in one place. Future work can split this out into a dedicated
 * `alfaclub_auth_health` table without changing the read API.
 *
 * Single-writer invariant
 * -----------------------
 * The Privy token refresher (`privy-token-refresher`) and the admin
 * bootstrap endpoint (`<admin wallet>` / `admin.api`) are the only
 * legitimate writers of the auth rows. Any other writer name (notably
 * `cursor-hermit-rotate` from the legacy long-lived in-process refresher)
 * is logged as an anomaly via `evaluateWriterAnomaly`. The check is a
 * warning, not a hard block — recovery still has to be possible if the
 * naming convention drifts.
 *
 * Redaction
 * ---------
 * Values in `secret_value` are emitted by `buildRefreshSuccessPayload` /
 * `buildRefreshFailurePayload` only. Both helpers strip token-shaped
 * substrings defensively before write so an accidental error string like
 * `Bearer eyJhbGciOi...` never lands in the log. The redactor is also
 * exported for the health endpoint.
 */

import { logger } from '../infra/logger.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { extractJwtExpiryIso } from './chatTokenStore.js'

const HEALTH_KEY_LAST_SUCCESS = 'chat_auth_health:last_success' as const
const HEALTH_KEY_LAST_FAILURE = 'chat_auth_health:last_failure' as const

/**
 * Writer names that the auth path is allowed to produce. Anything else is
 * an anomaly and gets warn-logged. The set is intentionally short — any
 * production writer not in this set should be added explicitly via PR
 * review, not silently accepted.
 *
 * - `privy-token-refresher`: the Vercel cron path (canonical writer).
 * - `admin.api`: documented operator restore via /api/v1/alfaclub/chat-token
 *   (used when an admin posts a fresh triplet by hand).
 * - `computer-token-restore`: documented operator restore via the local
 *   `alfaclub-restore-tokens.mjs` script (--apply mode).
 *
 * Plus: any lowercase `0x[0-9a-f]{40}` admin wallet, since the admin
 * endpoint stamps the writer with the admin's own wallet (see
 * `_chat-token.ts:185`). That is treated as an expected writer pattern.
 */
const KNOWN_WRITERS: ReadonlySet<string> = new Set([
  'privy-token-refresher',
  'admin.api',
  'computer-token-restore',
])

const EVM_ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/

export type WriterAnomaly = {
  isAnomalous: boolean
  reason:
    | 'unknown_writer'
    | 'legacy_in_process_refresher'
    | 'empty_writer'
    | null
  writer: string | null
}

/**
 * Classifies an `updated_by` string against the single-writer invariant.
 * Pure function — no IO, safe to call from anywhere including tests.
 */
export function evaluateWriterAnomaly(updatedBy: string | null | undefined): WriterAnomaly {
  const raw = String(updatedBy ?? '').trim()
  if (!raw) {
    return { isAnomalous: true, reason: 'empty_writer', writer: null }
  }
  const lower = raw.toLowerCase()
  if (KNOWN_WRITERS.has(lower)) {
    return { isAnomalous: false, reason: null, writer: lower }
  }
  if (EVM_ADDRESS_PATTERN.test(lower)) {
    // Address-shaped writer: admin endpoint stamps with the admin's own
    // wallet. Treated as an expected pattern.
    return { isAnomalous: false, reason: null, writer: lower }
  }
  if (lower === 'cursor-hermit-rotate') {
    // Fingerprint of the legacy long-lived in-process refresher that PR
    // #458 disabled by default. Surfacing it explicitly so the operator
    // recognizes the regression on sight.
    return {
      isAnomalous: true,
      reason: 'legacy_in_process_refresher',
      writer: lower,
    }
  }
  return { isAnomalous: true, reason: 'unknown_writer', writer: lower }
}

/**
 * Defensive redactor. Strips JWT-shaped substrings (`xxx.yyy.zzz`),
 * `Bearer ...` headers, and obvious base64url runs. The error strings
 * surfaced by the refresher already trim Privy's response body to 200
 * chars and never include the token material we sent — this is a second
 * line of defense in case a future change accidentally widens the
 * passthrough.
 */
export function redactTokenMaterial(input: string): string {
  if (!input) return input
  let out = input
  // JWT shape: 3 base64url segments separated by '.'. Match conservatively;
  // the JWT must be at least 24 chars long across the three parts to count.
  out = out.replace(
    /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g,
    '<redacted-jwt>',
  )
  // `Bearer <token>` headers.
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
  // Long unbroken base64url runs (refresh tokens are opaque ~40+ chars).
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<redacted-opaque>')
  return out.slice(0, 500)
}

export type RefreshSuccessPayload = {
  at: string
  identityTokenExp: string | null
  writer: string
  rotatedRefresh: boolean
}

export type RefreshFailurePayload = {
  at: string
  status: 'error' | 'missing_tokens'
  errorCode: string
  /** Already-redacted short label, never the raw error. */
  detail: string
}

export function buildRefreshSuccessPayload(params: {
  at: string
  identityTokenExpIso: string | null
  writer: string
  rotatedRefresh: boolean
}): RefreshSuccessPayload {
  return {
    at: params.at,
    identityTokenExp: params.identityTokenExpIso,
    writer: params.writer,
    rotatedRefresh: params.rotatedRefresh,
  }
}

/**
 * Reduce a free-form refresher error message to a stable short code that
 * is safe to persist and surface from the health endpoint. Preserves the
 * fingerprintable `privy_refresh_failed:<status>` prefix when present and
 * truncates everything else through `redactTokenMaterial`.
 */
export function classifyRefreshError(
  rawError: string,
): { errorCode: string; detail: string } {
  const message = String(rawError ?? '').trim()
  if (!message) return { errorCode: 'unknown', detail: '' }

  const privyMatch = /^privy_refresh_failed:([^:]+)/.exec(message)
  if (privyMatch) {
    const tail = message.split(':').slice(2).join(':')
    return {
      errorCode: `privy_refresh_failed:${privyMatch[1]}`,
      detail: redactTokenMaterial(tail).slice(0, 200),
    }
  }

  if (/token_persistence_failed/.test(message)) {
    return {
      errorCode: 'token_persistence_failed',
      detail: redactTokenMaterial(message).slice(0, 200),
    }
  }

  if (/refresher_disabled/.test(message)) {
    return { errorCode: 'refresher_disabled', detail: '' }
  }

  return {
    errorCode: 'unknown',
    detail: redactTokenMaterial(message).slice(0, 200),
  }
}

export function buildRefreshFailurePayload(params: {
  at: string
  status: 'error' | 'missing_tokens'
  rawError: string
}): RefreshFailurePayload {
  const classified = classifyRefreshError(params.rawError)
  return {
    at: params.at,
    status: params.status,
    errorCode: classified.errorCode,
    detail: classified.detail,
  }
}

type HealthRow = {
  secret_value: string
  updated_at: string
  updated_by: string | null
}

async function readHealthRow(
  key: typeof HEALTH_KEY_LAST_SUCCESS | typeof HEALTH_KEY_LAST_FAILURE,
): Promise<HealthRow | null> {
  const db = await getDb()
  if (!db) return null
  try {
    await ensureAlfaClubVigilanteSchema()
    const result = await db.sql`
      SELECT secret_value,
             updated_at::text AS updated_at,
             updated_by
      FROM alfaclub_runtime_secret
      WHERE secret_key = ${key}
      LIMIT 1;
    `
    const row = ((result.rows ?? [])[0] ?? null) as HealthRow | null
    return row
  } catch {
    return null
  }
}

async function writeHealthRow(
  key: typeof HEALTH_KEY_LAST_SUCCESS | typeof HEALTH_KEY_LAST_FAILURE,
  payloadJson: string,
  writer: string,
): Promise<boolean> {
  const db = await getDb()
  if (!db) {
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
        ${key},
        ${payloadJson},
        ${null},
        ${writer},
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
    // Failure to persist health is non-fatal: refresher must keep running
    // even if the health row write is rejected (e.g. RLS quirk on the
    // runtime role). Log code only, not the value.
    const code = (err as { code?: string } | null)?.code
    logger.warn('[alfaclub-auth-health] health row write failed; continuing', {
      key,
      code: typeof code === 'string' ? code : null,
    })
    return false
  }
}

export async function recordRefreshSuccess(
  payload: RefreshSuccessPayload,
): Promise<boolean> {
  const json = JSON.stringify(payload)
  return writeHealthRow(HEALTH_KEY_LAST_SUCCESS, json, payload.writer)
}

export async function recordRefreshFailure(
  payload: RefreshFailurePayload,
  writer: string,
): Promise<boolean> {
  const json = JSON.stringify(payload)
  return writeHealthRow(HEALTH_KEY_LAST_FAILURE, json, writer)
}

export type AlfaClubAuthHealthSnapshot = {
  lastSuccess: (RefreshSuccessPayload & { writerAnomaly: WriterAnomaly }) | null
  lastFailure: (RefreshFailurePayload & { writer: string | null }) | null
  /**
   * Snapshot of the chat_jwt row's writer + expiry, so the health endpoint
   * can surface anomalies on the live token row even when the most recent
   * refresh succeeded (e.g. a downstream writer overwrote the slot).
   */
  liveChatJwt: {
    writer: string | null
    writerAnomaly: WriterAnomaly
    expiresAt: string | null
    minutesUntilExpiry: number | null
    updatedAt: string | null
  } | null
}

function safeParse<T>(json: string | null | undefined): T | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as T
    return parsed
  } catch {
    return null
  }
}

export async function readAuthHealthSnapshot(params?: {
  /**
   * Live `chat_jwt` row metadata, looked up by the caller (we read it
   * here so the endpoint and the bridge tick share one query path).
   */
  liveChatJwt?: {
    jwt: string | null
    updatedAt: string | null
    updatedBy: string | null
    expiresAtIso: string | null
  } | null
  now?: () => number
}): Promise<AlfaClubAuthHealthSnapshot> {
  const now = params?.now ?? Date.now
  const [successRow, failureRow] = await Promise.all([
    readHealthRow(HEALTH_KEY_LAST_SUCCESS),
    readHealthRow(HEALTH_KEY_LAST_FAILURE),
  ])

  const lastSuccessPayload = safeParse<RefreshSuccessPayload>(successRow?.secret_value)
  const lastFailurePayload = safeParse<RefreshFailurePayload>(failureRow?.secret_value)

  const lastSuccess = lastSuccessPayload
    ? { ...lastSuccessPayload, writerAnomaly: evaluateWriterAnomaly(lastSuccessPayload.writer) }
    : null

  const lastFailure = lastFailurePayload
    ? { ...lastFailurePayload, writer: failureRow?.updated_by ?? null }
    : null

  const live = params?.liveChatJwt ?? null
  let liveSnapshot: AlfaClubAuthHealthSnapshot['liveChatJwt'] = null
  if (live) {
    const expIso = live.expiresAtIso
      ?? (live.jwt ? extractJwtExpiryIso(live.jwt) : null)
    const expMs = expIso ? Date.parse(expIso) : NaN
    const minutesUntilExpiry =
      Number.isFinite(expMs) ? Math.floor((expMs - now()) / 60_000) : null
    liveSnapshot = {
      writer: live.updatedBy,
      writerAnomaly: evaluateWriterAnomaly(live.updatedBy),
      expiresAt: expIso ?? null,
      minutesUntilExpiry,
      updatedAt: live.updatedAt,
    }
  }

  return {
    lastSuccess,
    lastFailure,
    liveChatJwt: liveSnapshot,
  }
}

/** For tests only — health row keys. */
export const _HEALTH_KEYS_FOR_TESTS = {
  LAST_SUCCESS: HEALTH_KEY_LAST_SUCCESS,
  LAST_FAILURE: HEALTH_KEY_LAST_FAILURE,
}
