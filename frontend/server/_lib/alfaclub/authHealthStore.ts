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
const HEALTH_KEY_BRIDGE = 'chat_auth_health:bridge' as const
const BRIDGE_WRITER = 'alfaclub-chat-bridge'

export type AlfaClubBridgeAuthHealthSnapshot = {
  lastAuthFailAt: string | null
  consecutiveAuthFailures: number
  suppressedSocketAttempts: number
  socketBackoffMs: number
}

/**
 * In-memory fast-path cache. The source of truth for the bridge counters
 * lives in the shared `chat_auth_health:bridge` row in
 * `alfaclub_runtime_secret` so the API handler can read them when it runs
 * in a different process/runtime than the bridge tick (the common
 * production setup on Vercel — see Codex review on PR #504). Writes go to
 * the durable row first; this cache is updated locally too so subsequent
 * in-process reads reflect the latest state without an extra round-trip.
 */
const bridgeAuthHealth: AlfaClubBridgeAuthHealthSnapshot = {
  lastAuthFailAt: null,
  consecutiveAuthFailures: 0,
  suppressedSocketAttempts: 0,
  socketBackoffMs: 0,
}

let bridgeStorageWarnLogged = false

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
  /**
   * ISO timestamp when the Privy ACCESS token (the bearer the refresher
   * sends to `https://auth.privy.io/api/v1/sessions`) expires. The
   * access token has its own ~1h TTL and can age out independently of
   * the identity token when Privy returns `privy_access_token: null`
   * for one or more refresh cycles. Surfacing this lets monitors alert
   * before a Privy 400 `missing_or_invalid_token` cliff (see incident
   * 2026-05-01).
   *
   * `null` when the bundle's access token has no decodable `exp`
   * claim (defensive — Privy access tokens are JWTs in practice).
   */
  accessTokenExp: string | null
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
  accessTokenExpIso?: string | null
  writer: string
  rotatedRefresh: boolean
}): RefreshSuccessPayload {
  return {
    at: params.at,
    identityTokenExp: params.identityTokenExpIso,
    accessTokenExp: params.accessTokenExpIso ?? null,
    writer: params.writer,
    rotatedRefresh: params.rotatedRefresh,
  }
}

/**
 * Privy 4xx response codes the refresher is willing to fold into its
 * error code. Keep this list short and explicit — anything else is
 * dropped to avoid surfacing untrusted upstream strings on what is
 * effectively a public-ish error code field.
 */
const PRIVY_RECOGNISED_SUBCODES: ReadonlySet<string> = new Set([
  // Bearer (access token) rejected. The 2026-05-01 incident.
  'missing_or_invalid_token',
  // Refresh token revoked / rotated out / never seen.
  'invalid_refresh_token',
  // Documented-but-rare for completeness.
  'invalid_credentials',
])

function extractPrivyResponseSubcode(tail: string): string | null {
  if (!tail) return null
  // The tail is typically the raw JSON body Privy returned, possibly
  // truncated. We don't `JSON.parse` because the body has been
  // through `slice(0, 200)` and may be a fragment; a regex is
  // sufficient and avoids the parse-failure branch.
  const match = /"code"\s*:\s*"([a-z0-9_]+)"/i.exec(tail)
  if (!match) return null
  const candidate = match[1].toLowerCase()
  return PRIVY_RECOGNISED_SUBCODES.has(candidate) ? candidate : null
}

/**
 * Reduce a free-form refresher error message to a stable short code that
 * is safe to persist and surface from the health endpoint. Preserves the
 * fingerprintable `privy_refresh_failed:<status>` prefix when present and
 * truncates everything else through `redactTokenMaterial`.
 *
 * When the Privy response body includes a recognised `code` (e.g.
 * `missing_or_invalid_token`, `invalid_refresh_token`), it is appended
 * to the error code as a third segment so monitors can distinguish
 * bearer-vs-refresh rejection without parsing the detail string.
 */
export function classifyRefreshError(
  rawError: string,
): { errorCode: string; detail: string } {
  const message = String(rawError ?? '').trim()
  if (!message) return { errorCode: 'unknown', detail: '' }

  const privyMatch = /^privy_refresh_failed:([^:]+)/.exec(message)
  if (privyMatch) {
    const status = privyMatch[1]
    const tail = message.split(':').slice(2).join(':')
    // Privy 4xx bodies often carry a structured `code` in the JSON
    // payload (`{"error":"…","code":"missing_or_invalid_token"}`).
    // Surfacing it on the errorCode lets monitors and operators
    // distinguish bearer rejection (`missing_or_invalid_token` =
    // expired/invalid access token) from refresh-token rejection
    // (`invalid_refresh_token` = revoked/rotated-out refresh token)
    // without parsing `detail` by hand. We only honor a small allow-
    // list of codes Privy is documented to emit; anything else falls
    // back to the bare `privy_refresh_failed:<status>` shape so we
    // never expose untrusted strings on the public-ish error code.
    const subcode = extractPrivyResponseSubcode(tail)
    if (subcode) {
      return {
        errorCode: `privy_refresh_failed:${status}:${subcode}`,
        detail: redactTokenMaterial(tail).slice(0, 200),
      }
    }
    return {
      errorCode: `privy_refresh_failed:${status}`,
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

type HealthRowKey =
  | typeof HEALTH_KEY_LAST_SUCCESS
  | typeof HEALTH_KEY_LAST_FAILURE
  | typeof HEALTH_KEY_BRIDGE

async function readHealthRow(
  key: HealthRowKey,
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
  key: HealthRowKey,
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

function persistBridgeSnapshot(): Promise<boolean> {
  // Snapshot the current cache and write it to the shared row. Writers
  // call this fire-and-forget; the bridge must keep ticking even when
  // shared storage is unreachable. Errors are swallowed by writeHealthRow
  // (warn-logged) and surface as a `false` return.
  const json = JSON.stringify(bridgeAuthHealth)
  return writeHealthRow(HEALTH_KEY_BRIDGE, json, BRIDGE_WRITER).catch(() => false)
}

export function recordBridgeAuthFailure(at = new Date().toISOString()): void {
  bridgeAuthHealth.lastAuthFailAt = at
  bridgeAuthHealth.consecutiveAuthFailures += 1
  void persistBridgeSnapshot()
}

export function recordBridgeHistorySuccess(): void {
  bridgeAuthHealth.consecutiveAuthFailures = 0
  void persistBridgeSnapshot()
}

export function recordBridgeSuppressedSocketAttempt(): void {
  bridgeAuthHealth.suppressedSocketAttempts += 1
  void persistBridgeSnapshot()
}

export function recordBridgeSocketBackoff(socketBackoffMs: number): void {
  bridgeAuthHealth.socketBackoffMs = Math.max(0, Math.floor(socketBackoffMs))
  void persistBridgeSnapshot()
}

/**
 * Synchronous, in-memory snapshot. Used by the bridge itself (same
 * process as the writes) and by tests. Cross-process readers should use
 * `readBridgeAuthHealthSnapshotFromStorage`.
 */
export function readBridgeAuthHealthSnapshot(): AlfaClubBridgeAuthHealthSnapshot {
  return { ...bridgeAuthHealth }
}

function isAlfaClubBridgeAuthHealthSnapshot(
  value: unknown,
): value is AlfaClubBridgeAuthHealthSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    (v.lastAuthFailAt === null || typeof v.lastAuthFailAt === 'string') &&
    typeof v.consecutiveAuthFailures === 'number' &&
    typeof v.suppressedSocketAttempts === 'number' &&
    typeof v.socketBackoffMs === 'number'
  )
}

/**
 * Cross-process read path. Loads the bridge counters from the shared
 * `chat_auth_health:bridge` row. When shared storage is not reachable
 * (no DB binding, transient outage), falls back to the in-memory cache
 * and warn-logs once per process so the failure is observable without
 * spamming the log.
 */
export async function readBridgeAuthHealthSnapshotFromStorage(): Promise<AlfaClubBridgeAuthHealthSnapshot> {
  const row = await readHealthRow(HEALTH_KEY_BRIDGE)
  const parsed = safeParse<unknown>(row?.secret_value)
  if (isAlfaClubBridgeAuthHealthSnapshot(parsed)) {
    return {
      lastAuthFailAt: parsed.lastAuthFailAt,
      consecutiveAuthFailures: Math.max(0, Math.floor(parsed.consecutiveAuthFailures)),
      suppressedSocketAttempts: Math.max(0, Math.floor(parsed.suppressedSocketAttempts)),
      socketBackoffMs: Math.max(0, Math.floor(parsed.socketBackoffMs)),
    }
  }
  if (!bridgeStorageWarnLogged) {
    bridgeStorageWarnLogged = true
    logger.warn(
      '[alfaclub-auth-health] bridge health row unavailable; falling back to in-memory snapshot',
      { key: HEALTH_KEY_BRIDGE },
    )
  }
  return { ...bridgeAuthHealth }
}

export type AlfaClubAuthHealthSnapshot = {
  lastSuccess:
    | (RefreshSuccessPayload & {
        writerAnomaly: WriterAnomaly
        /**
         * Convenience: minutes from "now" until the access token's
         * exp. Null when accessTokenExp is unknown. Negative when the
         * access token has already expired. Monitors should treat
         * `minutesUntilAccessExpiry < 20` the same as
         * `minutesUntilExpiry < 20` on the live identity token.
         */
        minutesUntilAccessExpiry: number | null
      })
    | null
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
  bridge: AlfaClubBridgeAuthHealthSnapshot
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
  const [successRow, failureRow, bridgeSnapshot] = await Promise.all([
    readHealthRow(HEALTH_KEY_LAST_SUCCESS),
    readHealthRow(HEALTH_KEY_LAST_FAILURE),
    readBridgeAuthHealthSnapshotFromStorage(),
  ])

  const lastSuccessPayload = safeParse<RefreshSuccessPayload>(successRow?.secret_value)
  const lastFailurePayload = safeParse<RefreshFailurePayload>(failureRow?.secret_value)

  const lastSuccess = lastSuccessPayload
    ? {
        ...lastSuccessPayload,
        writerAnomaly: evaluateWriterAnomaly(lastSuccessPayload.writer),
        minutesUntilAccessExpiry: (() => {
          const iso = lastSuccessPayload.accessTokenExp ?? null
          if (!iso) return null
          const ms = Date.parse(iso)
          return Number.isFinite(ms) ? Math.floor((ms - now()) / 60_000) : null
        })(),
      }
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
    bridge: bridgeSnapshot,
  }
}

export function _resetBridgeAuthHealthForTests(): void {
  bridgeAuthHealth.lastAuthFailAt = null
  bridgeAuthHealth.consecutiveAuthFailures = 0
  bridgeAuthHealth.suppressedSocketAttempts = 0
  bridgeAuthHealth.socketBackoffMs = 0
  bridgeStorageWarnLogged = false
}

/** For tests only — health row keys. */
export const _HEALTH_KEYS_FOR_TESTS = {
  LAST_SUCCESS: HEALTH_KEY_LAST_SUCCESS,
  LAST_FAILURE: HEALTH_KEY_LAST_FAILURE,
  BRIDGE: HEALTH_KEY_BRIDGE,
}
