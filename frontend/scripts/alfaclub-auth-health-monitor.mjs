#!/usr/bin/env node
/**
 * AlfaClub auth-health external monitor.
 *
 * Calls `GET /api/v1/alfaclub/chat-auth-health` (the cron-secret-gated
 * endpoint added in PR #471) and exits non-zero on any of the alert
 * conditions documented in `docs/operations/alfaclub-auth-hardening.md`.
 *
 * It runs in two surfaces:
 *
 *   - GitHub Actions (`.github/workflows/alfaclub-auth-health-monitor.yml`)
 *     on a 5-minute cron + `workflow_dispatch`. The Actions secret
 *     `ALFACLUB_HEALTH_CRON_SECRET` is the only required input; the URL
 *     defaults to https://app.4626.fun/api/v1/alfaclub/chat-auth-health.
 *
 *   - An operator's terminal:
 *       ALFACLUB_HEALTH_CRON_SECRET=… node frontend/scripts/alfaclub-auth-health-monitor.mjs
 *     With optional ALFACLUB_HEALTH_URL override.
 *
 * Exit codes
 * ----------
 *   0 — healthy. minutesUntilExpiry >= 20, no anomalous writer, lastSuccess
 *       newer than lastFailure (or no failure at all), HTTP 200 + success.
 *   1 — unhealthy. One of the alert conditions in
 *       `evaluateHealthSnapshot` returned a failure reason. Process
 *       exits 1 and prints a sanitized one-line diagnostic.
 *   2 — usage / configuration error (missing secret, bad URL, etc.).
 *
 * Redaction
 * ---------
 * The endpoint by design does not return the chat_jwt itself, only
 * metadata. As a defense-in-depth backstop the script:
 *   - Never logs the raw response body.
 *   - Logs only the fields enumerated in `summarizeSnapshot()` —
 *     status, minutesUntilExpiry, writer, anomaly reason, lastSuccess.at,
 *     lastFailure.at. Anything else is dropped.
 *   - Wraps unrelated errors through a redactor identical to
 *     `redactTokenMaterial()` in the server-side health store, so a
 *     stray Bearer or JWT-shaped string in a network error message
 *     can't reach Actions logs.
 *
 * No deps; only Node builtins (`process`, `fetch`).
 */

/* eslint-disable no-console */
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const DEFAULT_URL =
  process.env.ALFACLUB_HEALTH_URL?.trim() ||
  'https://app.4626.fun/api/v1/alfaclub/chat-auth-health'

// CLI threshold knobs — only used by tests / local invocations. The
// production workflow accepts the defaults (matching the runbook).
const MIN_EXPIRY_MINUTES = readNumberEnv('ALFACLUB_HEALTH_MIN_EXPIRY_MINUTES', 20)
const REFRESH_FAILED_LOW_EXPIRY_MINUTES = readNumberEnv(
  'ALFACLUB_HEALTH_REFRESH_FAILED_LOW_EXPIRY_MINUTES',
  30,
)

// fetch timeout: we want the workflow to fail fast on a hung handler
// rather than hold the runner for >5 min until the next scheduled tick.
const FETCH_TIMEOUT_MS = readNumberEnv('ALFACLUB_HEALTH_FETCH_TIMEOUT_MS', 15000)

const isEntrypoint = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
  } catch {
    return false
  }
})()

if (isEntrypoint) {
  runCli().catch((err) => {
    // Should never reach here — runCli catches its own errors — but
    // belt-and-suspenders so a bug doesn't escape with exit=0.
    process.stderr.write(`alfaclub-auth-health: FAIL unexpected_error ${redact(String(err?.message ?? err))}\n`)
    process.exitCode = 1
  })
}

async function runCli() {
  const result = await runMonitor({
    url: DEFAULT_URL,
    secret: (process.env.ALFACLUB_HEALTH_CRON_SECRET ?? '').trim(),
    minExpiryMinutes: MIN_EXPIRY_MINUTES,
    refreshFailedLowExpiryMinutes: REFRESH_FAILED_LOW_EXPIRY_MINUTES,
    timeoutMs: FETCH_TIMEOUT_MS,
  })
  if (result.stdout) process.stdout.write(`${result.stdout}\n`)
  if (result.stderr) process.stderr.write(`${result.stderr}\n`)
  // Set exitCode and let Node exit naturally so buffered stdout/stderr
  // is fully flushed. process.exit() can truncate output on some
  // platforms (notably when piped through tee or to a file).
  process.exitCode = result.exitCode
}

/**
 * Pure async runner: takes config, returns `{ exitCode, stdout, stderr }`
 * without ever calling `process.exit` or `console.*`. The CLI wrapper
 * above is the only thing that touches process state, which keeps the
 * monitor in-process testable.
 *
 * Exit-code contract:
 *   0 — healthy.
 *   1 — alert (one of the documented FAIL reasons).
 *   2 — misconfig (missing secret, bad URL).
 */
export async function runMonitor(params) {
  const secret = String(params?.secret ?? '').trim()
  const url = String(params?.url ?? '').trim()
  const minExpiryMinutes =
    typeof params?.minExpiryMinutes === 'number' && Number.isFinite(params.minExpiryMinutes)
      ? params.minExpiryMinutes
      : 20
  const refreshFailedLowExpiryMinutes =
    typeof params?.refreshFailedLowExpiryMinutes === 'number' &&
    Number.isFinite(params.refreshFailedLowExpiryMinutes)
      ? params.refreshFailedLowExpiryMinutes
      : 30
  const timeoutMs =
    typeof params?.timeoutMs === 'number' && Number.isFinite(params.timeoutMs) && params.timeoutMs > 0
      ? params.timeoutMs
      : FETCH_TIMEOUT_MS
  const fetchImpl = typeof params?.fetchImpl === 'function' ? params.fetchImpl : null

  if (!secret) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: 'error: ALFACLUB_HEALTH_CRON_SECRET env var is required (set as a GitHub Actions secret in CI).',
    }
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `error: ALFACLUB_HEALTH_URL must be http(s) URL; got: ${redact(url)}`,
    }
  }

  let probe
  try {
    probe = await fetchHealth({ url, secret, timeoutMs, fetchImpl })
  } catch (err) {
    const reason = redact(err instanceof Error ? err.message : String(err))
    return {
      exitCode: 1,
      stdout: '',
      stderr: `alfaclub-auth-health: FAIL fetch_error ${reason}`,
    }
  }

  const evaluation = evaluateHealthSnapshot(probe, {
    minExpiryMinutes,
    refreshFailedLowExpiryMinutes,
  })
  const summary = summarizeSnapshot(probe.snapshot)

  if (evaluation.ok) {
    return {
      exitCode: 0,
      stdout: `alfaclub-auth-health: OK ${summary}`,
      stderr: '',
    }
  }
  return {
    exitCode: 1,
    stdout: '',
    stderr: `alfaclub-auth-health: FAIL ${evaluation.reason} ${summary}`,
  }
}

/**
 * Performs the GET, returns `{ httpStatus, successFlag, snapshot }`.
 * Throws on network / timeout / non-JSON. Never logs the raw body.
 *
 * `fetchImpl` is optional and only used by tests to inject a stub fetch
 * that records the call args and returns a deterministic Response.
 * Production callers do not pass it; the global `fetch` is used.
 */
export async function fetchHealth(params) {
  const { url, secret, timeoutMs } = params
  const fetchImpl = typeof params?.fetchImpl === 'function' ? params.fetchImpl : fetch
  const controller = new AbortController()
  // The timer must remain armed until the body is fully consumed.
  // `response.text()` can hang if headers arrive but the body stalls,
  // so we only clear the timer in `finally` after the body read
  // resolves (or aborts). Clearing it right after `fetch()` resolves
  // would leak a hung body read past the documented timeout budget.
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  let httpStatus = null
  let body = ''
  try {
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'x-cron-secret': secret,
          accept: 'application/json',
        },
        signal: controller.signal,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`network ${redact(message)}`)
    }

    httpStatus = response.status
    try {
      body = await response.text()
    } catch {
      body = ''
    }
  } finally {
    clearTimeout(timer)
  }

  let parsed = null
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = null
  }

  // Snapshot is the `data` field per the documented endpoint shape, or
  // null if the body is not parseable. We do NOT pass `body` upward —
  // that's the only stage that has access to the raw text, and it's
  // discarded here.
  const snapshot =
    parsed && typeof parsed === 'object' && parsed.success === true
      ? (parsed.data ?? null)
      : null

  return {
    httpStatus,
    successFlag:
      parsed && typeof parsed === 'object' ? Boolean(parsed.success) : false,
    snapshot,
  }
}

/**
 * Pure evaluator. Inputs are { httpStatus, successFlag, snapshot } —
 * caller must already have read and discarded the raw body.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason: <short_code> }`.
 * Reason codes:
 *   - http_status_<code>            HTTP non-200.
 *   - response_not_success          JSON did not include success:true.
 *   - missing_live_chat_jwt         data.liveChatJwt is missing/null.
 *   - expiring_soon                 minutesUntilExpiry < threshold.
 *   - access_token_expiring_soon    lastSuccess.minutesUntilAccessExpiry < threshold.
 *                                   The Privy access token (bearer the refresher
 *                                   sends) has its own ~1h TTL that ages
 *                                   independently when Privy returns
 *                                   `privy_access_token: null` across cycles.
 *                                   Hardening PR after incident 2026-05-01.
 *   - refresh_failed_low_expiry     lastFailure.errorCode starts with
 *                                   'privy_refresh_failed:400' AND
 *                                   minutesUntilExpiry < 30. The runbook's
 *                                   "wake oncall" condition: a 400 from Privy means
 *                                   the refresh tokens may be revoked and a fresh
 *                                   triplet is needed before expiry. Fires even when
 *                                   a later success has bumped lastSuccess.at past
 *                                   lastFailure.at — the failure_after_success rule
 *                                   alone misses the case where one good refresh
 *                                   landed after the 400 but the underlying
 *                                   credential rot will recur on the next attempt.
 *                                   Matches subcoded variants too (e.g.
 *                                   ':missing_or_invalid_token', ':invalid_refresh_token').
 *   - writer_anomaly                liveChatJwt.writerAnomaly.isAnomalous.
 *   - missing_last_success          data.lastSuccess missing/null.
 *   - failure_after_success         lastFailure.at newer than lastSuccess.at.
 */
export function evaluateHealthSnapshot(probe, opts = {}) {
  const minExpiryMinutes =
    typeof opts.minExpiryMinutes === 'number' && Number.isFinite(opts.minExpiryMinutes)
      ? opts.minExpiryMinutes
      : 20
  const refreshFailedLowExpiryMinutes =
    typeof opts.refreshFailedLowExpiryMinutes === 'number' &&
    Number.isFinite(opts.refreshFailedLowExpiryMinutes)
      ? opts.refreshFailedLowExpiryMinutes
      : 30

  if (typeof probe?.httpStatus !== 'number' || probe.httpStatus !== 200) {
    return { ok: false, reason: `http_status_${probe?.httpStatus ?? 'unknown'}` }
  }
  if (probe.successFlag !== true) {
    return { ok: false, reason: 'response_not_success' }
  }

  const snapshot = probe.snapshot
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, reason: 'missing_data' }
  }

  const live = snapshot.liveChatJwt
  if (!live || typeof live !== 'object') {
    return { ok: false, reason: 'missing_live_chat_jwt' }
  }

  // minutesUntilExpiry is allowed to be null (when expiresAt is unknown);
  // treat null as "we cannot prove the JWT is fresh" — fail closed.
  const mins = typeof live.minutesUntilExpiry === 'number' ? live.minutesUntilExpiry : null
  if (mins === null) {
    return { ok: false, reason: 'expiring_soon' }
  }

  // Wake-oncall condition from the runbook: a Privy 400 plus an expiry
  // window that's narrower than a single refresh cadence (~30m). The
  // last refresh may have papered over the 400 and bumped lastSuccess.at,
  // but the underlying credential is still bad and the next attempt
  // will fail again — so we must page before mins falls below the
  // generic <20m threshold. Checked before `expiring_soon` so the more
  // specific reason wins when both apply.
  //
  // The errorCode shape was tightened in the access-token-cliff
  // hardening PR: when Privy's response body carries a recognised
  // `code`, the classifier appends it as a third segment
  // (e.g. `privy_refresh_failed:400:missing_or_invalid_token`). Match
  // by `startsWith('privy_refresh_failed:400')` so both the legacy
  // (no subcode) and new (subcode) shapes trigger the alert.
  const lastFailure = snapshot.lastFailure
  if (
    lastFailure &&
    typeof lastFailure === 'object' &&
    typeof lastFailure.errorCode === 'string' &&
    lastFailure.errorCode.startsWith('privy_refresh_failed:400') &&
    mins < refreshFailedLowExpiryMinutes
  ) {
    return { ok: false, reason: 'refresh_failed_low_expiry' }
  }

  if (mins < minExpiryMinutes) {
    return { ok: false, reason: 'expiring_soon' }
  }

  // Access-token cliff guard. Privy may keep `privy_access_token: null`
  // across multiple refresh cycles, in which case the bearer the
  // refresher sends to Privy ages independently of the identity token
  // and eventually crosses its own ~1h TTL. We surface that risk via
  // `lastSuccess.minutesUntilAccessExpiry`. Page on the same
  // `<minExpiryMinutes>` threshold as the identity-token case.
  // Null is acceptable here (older lastSuccess rows pre-date the field
  // and we can't fail closed without false-positiving against
  // historical data); a real cliff produces a finite negative number.
  const lastSuccess = snapshot.lastSuccess
  if (lastSuccess && typeof lastSuccess === 'object') {
    const accMins = lastSuccess.minutesUntilAccessExpiry
    if (typeof accMins === 'number' && accMins < minExpiryMinutes) {
      return { ok: false, reason: 'access_token_expiring_soon' }
    }
  }

  if (live.writerAnomaly && live.writerAnomaly.isAnomalous === true) {
    return { ok: false, reason: 'writer_anomaly' }
  }

  if (!lastSuccess || typeof lastSuccess !== 'object' || !lastSuccess.at) {
    return { ok: false, reason: 'missing_last_success' }
  }

  if (lastFailure && typeof lastFailure === 'object' && lastFailure.at) {
    const successMs = Date.parse(String(lastSuccess.at))
    const failureMs = Date.parse(String(lastFailure.at))
    if (
      Number.isFinite(successMs) &&
      Number.isFinite(failureMs) &&
      failureMs > successMs
    ) {
      return { ok: false, reason: 'failure_after_success' }
    }
  }

  return { ok: true }
}

/**
 * Renders the few sanitized fields we are willing to log. Everything
 * else from the response is dropped on the floor. Output is a single
 * line so it's friendly to GitHub Actions log filtering.
 *
 * Format:
 *   status=200 minutesUntilExpiry=42 writer=privy-token-refresher anomaly=ok lastSuccess.at=… lastFailure.at=…
 */
export function summarizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'snapshot=missing'
  }
  const live = snapshot.liveChatJwt ?? null
  const lastSuccess = snapshot.lastSuccess ?? null
  const lastFailure = snapshot.lastFailure ?? null

  const writer = String(live?.writer ?? 'unknown')
  const anomaly = live?.writerAnomaly?.isAnomalous
    ? `anomalous(${String(live.writerAnomaly.reason ?? 'unknown')})`
    : 'ok'
  const minutes =
    typeof live?.minutesUntilExpiry === 'number' ? String(live.minutesUntilExpiry) : 'null'
  const accessMinutes =
    typeof lastSuccess?.minutesUntilAccessExpiry === 'number'
      ? String(lastSuccess.minutesUntilAccessExpiry)
      : 'null'
  const successAt = String(lastSuccess?.at ?? 'null')
  const failureAt = String(lastFailure?.at ?? 'null')
  const dbStaleness =
    snapshot.dbEnvStaleness?.kind === 'db_lags_env' ? 'db_lags_env' : 'ok'

  return [
    `dbEnvStaleness=${dbStaleness}`,
    `minutesUntilExpiry=${minutes}`,
    `minutesUntilAccessExpiry=${accessMinutes}`,
    `writer=${redact(writer).slice(0, 60)}`,
    `anomaly=${redact(anomaly).slice(0, 60)}`,
    `lastSuccess.at=${successAt}`,
    `lastFailure.at=${failureAt}`,
  ].join(' ')
}

/**
 * Defensive redactor — same shape as the server-side
 * `redactTokenMaterial`. The endpoint does not return tokens, but a
 * network error message could still carry a Bearer header or JWT
 * shape; we strip those before they reach Actions logs.
 */
export function redact(input) {
  if (!input) return ''
  let out = String(input)
  out = out.replace(
    /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g,
    '<redacted-jwt>',
  )
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<redacted-opaque>')
  return out.slice(0, 300)
}

function readNumberEnv(name, fallback) {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Exported for unit tests. The CLI guard above means importing this
// module is side-effect-free.
export const _testables = {
  fetchHealth,
  evaluateHealthSnapshot,
  summarizeSnapshot,
  redact,
  runMonitor,
}
