/**
 * AlfaClub Privy token auto-refresher.
 *
 * ## Problem
 *
 * AlfaClub's chat API authenticates the keepr agent via a Privy identity
 * token (the JWT we store in `alfaclub_runtime_secret.chat_jwt`). Privy
 * identity tokens expire after 1 hour. Without automation, every 401 in
 * `[alfaclub-chat] tick error` would require an operator to manually log
 * in to alfaclub, grab a fresh JWT from their browser devtools, and run
 * `railway variables --set ALFACLUB_CHAT_JWT=...` — not a sustainable chore.
 *
 * ## Solution
 *
 * Privy exposes a `POST https://auth.privy.io/api/v1/sessions` endpoint
 * that accepts a (possibly near-expiry but not-yet-expired) access token
 * and a refresh token, and mints a fresh triplet: new access token, new
 * identity token, and — when it rotates — a new refresh token. We run
 * this on a ~30 minute interval (access tokens live 1h, so we have a
 * 30 min safety margin) and write the new identity token into the DB-
 * backed `alfaclub_runtime_secret.chat_jwt` slot. The chatBridge reads
 * that slot on every tick (see `resolveBridgeJwtWithSource`) so the new
 * token is picked up on the next 6s poll without a bridge restart.
 *
 * ## Bootstrap
 *
 * First-time setup: operator pastes a freshly-logged-in triplet into the
 * three env vars on Railway:
 *   - `ALFACLUB_CHAT_JWT`                   (identity token; alfaclub API)
 *   - `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN`    (access token; Privy refresh)
 *   - `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN`   (refresh token; 30-day lifetime)
 *
 * On first tick, the refresher copies all three from env into the DB.
 * After that, env values become a stale fallback and the DB copies are
 * the source of truth.
 *
 * ## Security
 *
 * Refresh tokens are long-lived credentials. They live in the
 * `alfaclub_runtime_secret` table which has RLS deny-all (see
 * `schema.ts`). They are never logged or returned by public handlers.
 * The refresh endpoint's `Origin` header is pinned to `https://alfaclub.app`
 * to match alfaclub's Privy app allowlist.
 *
 * ## Failure modes
 *
 * 1. Access token expired before first refresh (e.g., agent was down for
 *    >1 hour). Privy rejects the request with 400 "Invalid auth token".
 *    Recovery: operator re-logs in and rotates the triplet via env or
 *    `/api/v1/alfaclub/chat-token`.
 *
 * 2. Refresh token revoked (operator logged out of alfaclub). Same
 *    recovery as above.
 *
 * 3. Transient network error. Refresher logs and retries next tick.
 *    Meanwhile the chatBridge continues on the last-known-good identity
 *    token until IT expires, at which point ticks start 401-ing and we
 *    fall into case (1) on the next refresh attempt.
 *
 * Never throws out of the exported `runOnce`/`startAlfaClubPrivyTokenRefresher`
 * surface so a broken refresher can't crash the keepr runtime.
 */

import { logger } from '../infra/logger.js'
import {
  extractJwtExpiryIso,
  readAlfaClubChatToken,
  readAlfaClubPrivyAccessToken,
  readAlfaClubPrivyRefreshToken,
  upsertAlfaClubChatToken,
  upsertAlfaClubPrivyAccessToken,
  upsertAlfaClubPrivyRefreshToken,
} from './chatTokenStore.js'

declare const process: { env: Record<string, string | undefined> }

// AlfaClub's Privy app id. Surfaces in our JWTs as the `aud` claim
// (see e.g. `aud: "cmk2k53f101jkl70cw44uib7x"` in the identity token
// payload). Hardcoded because it's a constant of the alfaclub service
// we're integrating with, not a secret and not configurable.
const ALFACLUB_PRIVY_APP_ID =
  (process.env.ALFACLUB_PRIVY_APP_ID ?? '').trim() ||
  'cmk2k53f101jkl70cw44uib7x'

const ALFACLUB_PRIVY_ORIGIN =
  (process.env.ALFACLUB_PRIVY_ORIGIN ?? '').trim() || 'https://alfaclub.app'

const PRIVY_SESSIONS_ENDPOINT = 'https://auth.privy.io/api/v1/sessions'

// Refresh at half the access-token lifetime (1h) minus a safety margin.
// With a 30-minute cadence + a 20-minute "near-expiry" guard we always
// refresh at least 30 minutes before the current access token expires,
// giving ~20 minutes of clock slack for transient RPC failures before
// the bridge sees any tick errors.
const DEFAULT_REFRESH_INTERVAL_MS = 30 * 60 * 1000
const NEAR_EXPIRY_WINDOW_MS = 20 * 60 * 1000

export interface PrivyRefreshBundle {
  accessToken: string
  identityToken: string
  refreshToken: string
}

/**
 * Shape of `POST https://auth.privy.io/api/v1/sessions` 2xx response, as
 * documented by Privy's own `@privy-io/react-auth` SDK type
 * `ValidSessionResponse`. Notable nullability:
 *
 *  - `privy_access_token` and `refresh_token` may be `string | null` —
 *    Privy treats null here as "we did not rotate this credential, keep
 *    using the previous one." Production has been observed to return
 *    `privy_access_token: null` while still rotating the identity token.
 *  - `identity_token` is OPTIONAL (often omitted) — when absent the same
 *    identity-token JWT is carried by the top-level `token` field.
 *
 * The refresher accepts either `identity_token` or `token` for the JWT,
 * and falls back to the inbound access/refresh tokens when Privy returns
 * null/missing values for them, so it does not misclassify a valid Privy
 * response as `malformed_response`.
 */
export interface PrivyRefreshResponse {
  privy_access_token?: string | null
  identity_token?: string | null
  refresh_token?: string | null
  token?: string | null
}

function decodeTokenExpMs(jwt: string | null | undefined): number | null {
  if (!jwt) return null
  const iso = extractJwtExpiryIso(jwt)
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Hits Privy's session-refresh endpoint and returns the new token bundle.
 * Throws on non-2xx or malformed response. Callers are responsible for
 * persisting the returned bundle.
 */
export async function refreshPrivySession(params: {
  accessToken: string
  refreshToken: string
  appId?: string
  origin?: string
}): Promise<PrivyRefreshBundle> {
  const appId = params.appId ?? ALFACLUB_PRIVY_APP_ID
  const origin = params.origin ?? ALFACLUB_PRIVY_ORIGIN

  const response = await fetch(PRIVY_SESSIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'privy-app-id': appId,
      authorization: `Bearer ${params.accessToken}`,
      origin,
    },
    body: JSON.stringify({ refresh_token: params.refreshToken }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `privy_refresh_failed:${response.status}${body ? `:${body.slice(0, 200)}` : ''}`,
    )
  }

  const payload = (await response.json().catch(() => null)) as PrivyRefreshResponse | null
  // Privy's session response carries the identity JWT in `identity_token`
  // when present and otherwise in the top-level `token` field (see Privy's
  // own `ValidSessionResponse` SDK type). Either is acceptable.
  const identityToken =
    (payload?.identity_token?.trim() ?? '') ||
    (payload?.token?.trim() ?? '')
  // Privy may or may not rotate the access or refresh token on each call. Both
  // are declared `string | null` in Privy's SDK types and have been observed
  // null in production on the alfaclub app. Honor whatever Privy returns; if
  // null/empty, keep the inbound one so we never lose our ability to refresh
  // again. The non-2xx branch above already handled "Privy rejected our
  // credentials", so reaching here means the server kept the existing pair
  // alive and only rotated identity.
  const accessToken =
    (payload?.privy_access_token?.trim() ?? '') || params.accessToken.trim()
  const refreshToken =
    (payload?.refresh_token?.trim() ?? '') || params.refreshToken.trim()

  // The only field we cannot fall back on is the identity token: there is no
  // "previous identity token" to keep alive (the bridge would already be
  // 401-ing at this point) and no other field carries the JWT shape we need.
  // Surface a malformed-response diagnostic with the response key list so ops
  // can tell "Privy changed the response shape" from "Privy returned an empty
  // body" without leaking token material.
  if (!identityToken || !accessToken || !refreshToken) {
    const presentKeys = payload && typeof payload === 'object'
      ? Object.keys(payload).sort().join(',')
      : '<non-object>'
    const missing = [
      identityToken ? null : 'identity_token|token',
      accessToken ? null : 'privy_access_token',
      refreshToken ? null : 'refresh_token',
    ].filter(Boolean).join('+')
    throw new Error(
      `privy_refresh_failed:malformed_response:missing=${missing}:keys=${presentKeys}`,
    )
  }

  return { accessToken, identityToken, refreshToken }
}

export interface AlfaClubRefresherDependencies {
  /** Getter for current access token — DB first, env fallback. */
  readAccessToken?: () => Promise<string | null>
  /** Getter for current refresh token — DB first, env fallback. */
  readRefreshToken?: () => Promise<string | null>
  /** Getter for current identity token — used only to decide "is it near expiry?" */
  readIdentityToken?: () => Promise<string | null>
  /**
   * Persists the fresh triplet once a refresh succeeds. `inbound` carries the
   * pre-refresh access/refresh tokens so the writer can skip rows that did not
   * actually rotate (Privy returns null on those fields when it kept the
   * existing credential alive — see `refreshPrivySession`). Skipping unchanged
   * rows avoids unnecessary writes that can fail on roles with SELECT-only
   * grants on `alfaclub_runtime_secret` while still letting the identity-token
   * write — which always rotates — surface a real persistence failure.
   */
  writeBundle?: (
    bundle: PrivyRefreshBundle,
    updatedBy: string,
    inbound?: { accessToken: string; refreshToken: string },
  ) => Promise<void>
  /** Override the actual Privy call — swapped in tests. */
  refresh?: (params: {
    accessToken: string
    refreshToken: string
  }) => Promise<PrivyRefreshBundle>
  /** Override logger — swapped in tests. */
  log?: Pick<typeof logger, 'info' | 'warn' | 'error'>
  /** `Date.now()` override for tests. */
  now?: () => number
  /** Override the near-expiry window — tests. */
  nearExpiryWindowMs?: number
}

function envFallbackReader(envKey: string): () => Promise<string | null> {
  return async () => {
    const raw = (process.env[envKey] ?? '').trim()
    return raw || null
  }
}

function composeReader(
  persisted: () => Promise<string | null>,
  envKey: string,
): () => Promise<string | null> {
  const envReader = envFallbackReader(envKey)
  return async () => {
    const fromDb = await persisted().catch(() => null)
    if (fromDb && fromDb.trim()) return fromDb.trim()
    return envReader()
  }
}

function resolveDeps(
  deps: AlfaClubRefresherDependencies = {},
): Required<Omit<AlfaClubRefresherDependencies, 'nearExpiryWindowMs'>> & {
  nearExpiryWindowMs: number
} {
  const readAccessToken =
    deps.readAccessToken ??
    composeReader(
      async () => (await readAlfaClubPrivyAccessToken())?.value ?? null,
      'ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN',
    )
  const readRefreshToken =
    deps.readRefreshToken ??
    composeReader(
      async () => (await readAlfaClubPrivyRefreshToken())?.value ?? null,
      'ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN',
    )
  const readIdentityToken =
    deps.readIdentityToken ??
    composeReader(
      async () => (await readAlfaClubChatToken())?.jwt ?? null,
      'ALFACLUB_CHAT_JWT',
    )
  const writeBundle =
    deps.writeBundle ??
    (async (
      bundle: PrivyRefreshBundle,
      updatedBy: string,
      inbound?: { accessToken: string; refreshToken: string },
    ): Promise<void> => {
      // Order matters: write the identity token LAST so a partial failure
      // leaves the bridge running on the PREVIOUS identity token (worst
      // case: ticks eventually 401 and the next refresh attempt self-heals)
      // rather than on a newer identity token with no valid
      // access/refresh pair to rotate it with.
      //
      // Skip rows Privy did not rotate. `refreshPrivySession` returns the
      // INBOUND access/refresh token verbatim when Privy responds with
      // `privy_access_token: null` / `refresh_token: null` — its documented
      // "we kept the existing credential alive" signal. Re-upserting the
      // same value just to refresh `updated_at` is logically a no-op, and
      // production has been observed running with a DB role that has
      // SELECT (RLS bypass) but lacks INSERT/UPDATE grants on
      // `alfaclub_runtime_secret`. In that environment the unnecessary
      // write was throwing `42501 permission denied`, surfacing as a
      // 502 `token_persistence_failed:access_token` even though the
      // identity token — the only credential the bridge actually consumes —
      // could and should still be rotated. Only the identity-token write
      // is treated as fatal: it always rotates on a successful refresh,
      // and it is the credential the bridge reads on every tick.
      if (inbound && bundle.accessToken !== inbound.accessToken) {
        const accessOk = await upsertAlfaClubPrivyAccessToken({
          accessToken: bundle.accessToken,
          updatedBy,
        })
        if (!accessOk) {
          logger.warn(
            '[alfaclub-refresher] access-token persistence failed; continuing with identity-token rotation',
          )
        }
      }
      if (inbound && bundle.refreshToken !== inbound.refreshToken) {
        const refreshOk = await upsertAlfaClubPrivyRefreshToken({
          refreshToken: bundle.refreshToken,
          updatedBy,
        })
        if (!refreshOk) {
          logger.warn(
            '[alfaclub-refresher] refresh-token persistence failed; continuing with identity-token rotation',
          )
        }
      }
      const chatMeta = await upsertAlfaClubChatToken({
        jwt: bundle.identityToken,
        updatedBy,
      })
      if (!chatMeta?.hasToken) {
        throw new Error('token_persistence_failed:identity_token')
      }
    })
  const refresh =
    deps.refresh ??
    (async (params) => refreshPrivySession(params))
  const log = deps.log ?? logger
  const now = deps.now ?? Date.now
  return {
    readAccessToken,
    readRefreshToken,
    readIdentityToken,
    writeBundle,
    refresh,
    log,
    now,
    nearExpiryWindowMs: deps.nearExpiryWindowMs ?? NEAR_EXPIRY_WINDOW_MS,
  }
}

export type AlfaClubRefresherOutcome =
  | { status: 'refreshed'; identityTokenExp: number | null }
  | { status: 'not_due'; msUntilDue: number }
  | { status: 'missing_tokens'; missing: string[] }
  | { status: 'error'; error: string }

export async function runAlfaClubPrivyRefreshOnce(
  deps: AlfaClubRefresherDependencies = {},
  opts: { force?: boolean } = {},
): Promise<AlfaClubRefresherOutcome> {
  const resolved = resolveDeps(deps)
  const { readAccessToken, readRefreshToken, readIdentityToken, writeBundle, refresh, log, now } = resolved

  const [accessToken, refreshToken, identityToken] = await Promise.all([
    readAccessToken(),
    readRefreshToken(),
    readIdentityToken(),
  ])

  const missing: string[] = []
  if (!accessToken) missing.push('ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN')
  if (!refreshToken) missing.push('ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN')
  if (missing.length > 0) {
    log.warn('[alfaclub-refresher] missing bootstrap tokens; skipping', { missing })
    return { status: 'missing_tokens', missing }
  }

  if (!opts.force) {
    // We base "is a refresh due?" on the IDENTITY token's exp, not the access
    // token's. Both are minted simultaneously and share the same 1h TTL in
    // practice, but the identity token is the one that governs our bridge's
    // user-visible 401 cliff.
    const expMs = decodeTokenExpMs(identityToken)
    if (expMs !== null) {
      const msUntilExpiry = expMs - now()
      if (msUntilExpiry > resolved.nearExpiryWindowMs) {
        return { status: 'not_due', msUntilDue: msUntilExpiry - resolved.nearExpiryWindowMs }
      }
    }
  }

  try {
    const bundle = await refresh({
      accessToken: accessToken as string,
      refreshToken: refreshToken as string,
    })
    await writeBundle(bundle, 'privy-token-refresher', {
      accessToken: accessToken as string,
      refreshToken: refreshToken as string,
    })
    const newExp = decodeTokenExpMs(bundle.identityToken)
    log.info('[alfaclub-refresher] identity token refreshed', {
      newIdentityExp: newExp ? new Date(newExp).toISOString() : null,
      rotated: bundle.refreshToken !== refreshToken,
    })
    return { status: 'refreshed', identityTokenExp: newExp }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn('[alfaclub-refresher] refresh failed', { error: message })
    return { status: 'error', error: message }
  }
}

export interface AlfaClubRefresherHandle {
  stop: () => void
  runNow: () => Promise<AlfaClubRefresherOutcome>
}

/**
 * Starts the background refresher. Returns a handle with `stop()` and
 * `runNow()`. Fires once immediately (to bootstrap env → DB on first run
 * and to self-heal if the agent booted near a token expiry) then on a
 * fixed interval.
 */
export function startAlfaClubPrivyTokenRefresher(opts?: {
  intervalMs?: number
  deps?: AlfaClubRefresherDependencies
}): AlfaClubRefresherHandle {
  const intervalMs = opts?.intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS
  const deps = opts?.deps ?? {}
  let firstTick = true
  let stopped = false

  const runNow = async (): Promise<AlfaClubRefresherOutcome> =>
    runAlfaClubPrivyRefreshOnce(deps)

  const tick = async (): Promise<void> => {
    if (stopped) return
    if (firstTick) {
      // Force-refresh on the very first tick after boot. Without this, a
      // restart that lands inside the [near_expiry_window, interval_ms]
      // gap — e.g. boot 25 min before the identity token expires with a
      // 20-min near-expiry window and 30-min interval — would skip the
      // first tick as `not_due`, then hit the next scheduled tick AFTER
      // both access + identity tokens have expired (they share a TTL).
      // At that point Privy rejects the refresh and we're stuck. The
      // force ensures every restart resets the clock to a fresh 1-hour
      // window, making the refresher behavior path-independent of when
      // the process happened to boot relative to a prior token lifetime.
      firstTick = false
      await runAlfaClubPrivyRefreshOnce(deps, { force: true })
      return
    }
    await runNow()
  }

  // Kick off the first run on the next microtask so callers can keep a
  // reference to the handle before the first tick logs.
  queueMicrotask(() => {
    void tick()
  })

  const handle = setInterval(() => {
    void tick()
  }, intervalMs)
  if (typeof (handle as { unref?: () => void }).unref === 'function') {
    ;(handle as { unref: () => void }).unref()
  }

  return {
    stop: () => {
      stopped = true
      clearInterval(handle)
    },
    runNow,
  }
}
