/**
 * Unit tests for the external auth-health monitor (`frontend/scripts/
 * alfaclub-auth-health-monitor.mjs`). The script is import-safe — it
 * only runs main() when invoked as the entrypoint — so we exercise
 * the pure helpers via the `_testables` export plus the in-process
 * `runMonitor()` runner, which takes an injected `fetchImpl` so we
 * never need to spin up a real HTTP server in tests (which doesn't
 * work in some sandboxes anyway).
 *
 * Goal: lock in
 *   - the alert decision matrix (PR #471 thresholds in the runbook),
 *   - the redaction guarantees (no JWT / Bearer / opaque tokens reach
 *     stdout/stderr),
 *   - the exit-code contract (0 healthy, 1 alert, 2 misconfig).
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- .mjs script imported only for unit tests
import { _testables } from '../../../scripts/alfaclub-auth-health-monitor.mjs'

type Probe = { httpStatus: number | null; successFlag: boolean; snapshot: unknown }
type Evaluation = { ok: true } | { ok: false; reason: string }
type MonitorResult = { exitCode: number; stdout: string; stderr: string }

const { evaluateHealthSnapshot, summarizeSnapshot, redact, runMonitor, fetchHealth } = _testables as {
  evaluateHealthSnapshot: (
    probe: Probe,
    opts?: { minExpiryMinutes?: number; refreshFailedLowExpiryMinutes?: number },
  ) => Evaluation
  summarizeSnapshot: (snapshot: unknown) => string
  redact: (input: string) => string
  runMonitor: (params: {
    url: string
    secret: string
    minExpiryMinutes?: number
    refreshFailedLowExpiryMinutes?: number
    timeoutMs?: number
    fetchImpl?: (
      input: string,
      init: { method: string; headers: Record<string, string>; signal: AbortSignal },
    ) => Promise<Response>
  }) => Promise<MonitorResult>
  fetchHealth: (params: {
    url: string
    secret: string
    timeoutMs: number
    fetchImpl?: (
      input: string,
      init: { method: string; headers: Record<string, string>; signal: AbortSignal },
    ) => Promise<Response>
  }) => Promise<{ httpStatus: number | null; successFlag: boolean; snapshot: unknown }>
}

function makeFetchImpl(opts: {
  status: number
  body: unknown
  capture?: { headers: Record<string, string> | null; url: string | null }
}) {
  return async (
    input: string,
    init: { method: string; headers: Record<string, string>; signal: AbortSignal },
  ): Promise<Response> => {
    if (opts.capture) {
      opts.capture.url = String(input)
      opts.capture.headers = init.headers ?? null
    }
    const body =
      typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    return new Response(body, {
      status: opts.status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

type WriterAnomaly = { isAnomalous: boolean; reason: string | null; writer: string }
type LastSuccess = {
  at: string
  identityTokenExp: string
  /** New in the access-token-cliff hardening — optional for older rows. */
  accessTokenExp?: string | null
  /** New derived field — minutes from "now" until access-token exp. */
  minutesUntilAccessExpiry?: number | null
  writer: string
  rotatedRefresh: boolean
  writerAnomaly: WriterAnomaly
}
type LastFailure = { at: string; status: string; errorCode: string; detail: string } | null
type LiveChatJwt = {
  writer: string
  writerAnomaly: WriterAnomaly
  expiresAt: string
  minutesUntilExpiry: number | null
  updatedAt: string
}
type Snapshot = {
  lastSuccess: LastSuccess
  lastFailure: LastFailure
  liveChatJwt: LiveChatJwt
}

function healthySnapshot(): Snapshot {
  return {
    lastSuccess: {
      at: '2026-05-01T11:55:00.000Z',
      identityTokenExp: '2026-05-01T13:00:00.000Z',
      writer: 'privy-token-refresher',
      rotatedRefresh: false,
      writerAnomaly: { isAnomalous: false, reason: null, writer: 'privy-token-refresher' },
    },
    lastFailure: null,
    liveChatJwt: {
      writer: 'privy-token-refresher',
      writerAnomaly: { isAnomalous: false, reason: null, writer: 'privy-token-refresher' },
      expiresAt: '2026-05-01T13:00:00.000Z',
      minutesUntilExpiry: 60,
      updatedAt: '2026-05-01T11:55:00.000Z',
    },
  }
}

describe('evaluateHealthSnapshot — alert matrix', () => {
  it('returns ok on a healthy snapshot', () => {
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot: healthySnapshot(),
    })
    expect(result).toEqual({ ok: true })
  })

  it('fails when httpStatus is not 200', () => {
    const result = evaluateHealthSnapshot({
      httpStatus: 503,
      successFlag: false,
      snapshot: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('http_status_503')
  })

  it('fails when httpStatus is missing/null', () => {
    const result = evaluateHealthSnapshot({
      httpStatus: null,
      successFlag: false,
      snapshot: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('http_status_unknown')
  })

  it('fails when JSON success is not true even at 200', () => {
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: false,
      snapshot: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('response_not_success')
  })

  it('fails when data is missing', () => {
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot: null,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_data')
  })

  it('fails when liveChatJwt is missing', () => {
    const snapshot = healthySnapshot()
    // @ts-expect-error -- intentional to simulate degraded payload
    delete snapshot.liveChatJwt
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_live_chat_jwt')
  })

  it('fails when minutesUntilExpiry is below threshold (default 20)', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = 19
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expiring_soon')
  })

  it('passes when minutesUntilExpiry equals threshold', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = 20
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(true)
  })

  it('respects a custom minExpiryMinutes threshold', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = 25
    const result = evaluateHealthSnapshot(
      { httpStatus: 200, successFlag: true, snapshot },
      { minExpiryMinutes: 30 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expiring_soon')
  })

  it('fails closed when minutesUntilExpiry is null (cannot prove freshness)', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = null as unknown as number
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expiring_soon')
  })

  it('fails on writer anomaly even with comfortable expiry', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.writerAnomaly = {
      isAnomalous: true,
      reason: 'legacy_in_process_refresher',
      writer: 'cursor-hermit-rotate',
    }
    snapshot.liveChatJwt.writer = 'cursor-hermit-rotate'
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('writer_anomaly')
  })

  it('fails when lastSuccess is missing', () => {
    const snapshot = healthySnapshot()
    snapshot.lastSuccess = null as unknown as typeof snapshot.lastSuccess
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_last_success')
  })

  it('fails when lastFailure.at is newer than lastSuccess.at', () => {
    const snapshot = healthySnapshot()
    snapshot.lastFailure = {
      at: '2026-05-01T11:58:00.000Z',
      status: 'error',
      errorCode: 'privy_refresh_failed:400',
      detail: '',
    } as unknown as null
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('failure_after_success')
  })

  it('passes when lastFailure.at is older than lastSuccess.at', () => {
    const snapshot = healthySnapshot()
    snapshot.lastFailure = {
      at: '2026-05-01T11:00:00.000Z',
      status: 'error',
      errorCode: 'privy_refresh_failed:400',
      detail: '',
    } as unknown as null
    const result = evaluateHealthSnapshot({
      httpStatus: 200,
      successFlag: true,
      snapshot,
    })
    expect(result.ok).toBe(true)
  })

  // The runbook's wake-oncall condition: a Privy 400 plus an expiry
  // window that's narrower than a single refresh cadence (~30m).
  // Crucially this must fire even when a later success has bumped
  // lastSuccess.at past lastFailure.at — the underlying refresh
  // credential is still rotten and the next attempt will re-fail.
  describe('refresh_failed_low_expiry — wake-oncall condition', () => {
    it('fails when lastFailure.errorCode is privy_refresh_failed:400 and minutesUntilExpiry < 30', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 25
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })

    it('fires even when lastSuccess.at is newer than lastFailure.at (papered-over 400)', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 28
      // lastFailure happened first, then a later refresh succeeded —
      // failure_after_success would stay green, but the credential is
      // still bad so we must page anyway.
      snapshot.lastFailure = {
        at: '2026-05-01T11:50:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400',
        detail: '',
      } as unknown as null
      snapshot.lastSuccess = {
        ...snapshot.lastSuccess,
        at: '2026-05-01T11:55:00.000Z',
      }
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })

    it('takes precedence over the generic expiring_soon when both apply', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 10
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })

    it('does not fire when minutesUntilExpiry >= 30 even with a 400 lastFailure', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 35
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(true)
    })

    it('does not fire when errorCode is something other than privy_refresh_failed:400', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 25
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'token_persistence_failed',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      // mins=25 is above the default <20 threshold, so this stays green.
      expect(result.ok).toBe(true)
    })

    it('respects a custom refreshFailedLowExpiryMinutes threshold', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 50
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot(
        { httpStatus: 200, successFlag: true, snapshot },
        { refreshFailedLowExpiryMinutes: 60 },
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })

    it('also fires when errorCode carries a Privy subcode (privy_refresh_failed:400:missing_or_invalid_token)', () => {
      // Hardening PR after incident 2026-05-01: the classifier may
      // append a Privy response code as a third segment. The
      // wake-oncall match must accept both the legacy bare shape and
      // the subcoded shape so we keep paging on a credential cliff.
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 25
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400:missing_or_invalid_token',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })

    it('also fires for privy_refresh_failed:400:invalid_refresh_token', () => {
      const snapshot = healthySnapshot()
      snapshot.liveChatJwt.minutesUntilExpiry = 25
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400:invalid_refresh_token',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })
  })

  // Hardening after incident 2026-05-01: page when the Privy access
  // token (the bearer the refresher sends to Privy) is near expiry,
  // even when the live identity token still looks fresh. The
  // refresher records that exp on lastSuccess.accessTokenExp; the
  // server-side snapshot derives lastSuccess.minutesUntilAccessExpiry.
  describe('access_token_expiring_soon — Privy access-token cliff guard', () => {
    function withAccessExpiry(snapshot: Snapshot, mins: number | null): Snapshot {
      return {
        ...snapshot,
        lastSuccess: {
          ...snapshot.lastSuccess,
          minutesUntilAccessExpiry: mins,
        },
      }
    }

    it('fails when minutesUntilAccessExpiry < 20 even with a comfortable identity token', () => {
      const snapshot = withAccessExpiry(healthySnapshot(), 5)
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('access_token_expiring_soon')
    })

    it('passes when minutesUntilAccessExpiry equals threshold', () => {
      const snapshot = withAccessExpiry(healthySnapshot(), 20)
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(true)
    })

    it('respects custom minExpiryMinutes for access-token expiry too', () => {
      const snapshot = withAccessExpiry(healthySnapshot(), 25)
      const result = evaluateHealthSnapshot(
        { httpStatus: 200, successFlag: true, snapshot },
        { minExpiryMinutes: 30 },
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('access_token_expiring_soon')
    })

    it('null minutesUntilAccessExpiry stays green (older rows pre-date the field)', () => {
      const snapshot = withAccessExpiry(healthySnapshot(), null)
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      // Strictly: not failing on missing field. Identity-token freshness
      // and other guards still drive their own alerts.
      expect(result.ok).toBe(true)
    })

    it('a negative minutesUntilAccessExpiry (already expired) fails', () => {
      const snapshot = withAccessExpiry(healthySnapshot(), -10)
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('access_token_expiring_soon')
    })

    it('refresh_failed_low_expiry takes precedence over access_token_expiring_soon when both apply', () => {
      // Both conditions are bad-news: a 400 from Privy AND the access
      // token is already near expiry. The 400 is the louder signal
      // (almost certainly the cause of the access cliff), so the
      // monitor should keep its existing wake-oncall reason.
      const snapshot = withAccessExpiry(healthySnapshot(), 5)
      snapshot.liveChatJwt.minutesUntilExpiry = 25
      snapshot.lastFailure = {
        at: '2026-05-01T11:00:00.000Z',
        status: 'error',
        errorCode: 'privy_refresh_failed:400:missing_or_invalid_token',
        detail: '',
      } as unknown as null
      const result = evaluateHealthSnapshot({
        httpStatus: 200,
        successFlag: true,
        snapshot,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('refresh_failed_low_expiry')
    })
  })
})

describe('summarizeSnapshot — sanitized output', () => {
  it('emits a single line with the documented fields only', () => {
    const out = summarizeSnapshot(healthySnapshot())
    expect(out.split('\n')).toHaveLength(1)
    expect(out).toContain('minutesUntilExpiry=60')
    // New: Privy access-token cliff guard surfaces alongside identity exp.
    expect(out).toContain('minutesUntilAccessExpiry=null')
    expect(out).toContain('writer=privy-token-refresher')
    expect(out).toContain('anomaly=ok')
    expect(out).toContain('lastSuccess.at=2026-05-01T11:55:00.000Z')
    expect(out).toContain('lastFailure.at=null')
  })

  it('renders the access-token-exp number when lastSuccess.minutesUntilAccessExpiry is set', () => {
    const snapshot = healthySnapshot()
    snapshot.lastSuccess = { ...snapshot.lastSuccess, minutesUntilAccessExpiry: 42 }
    const out = summarizeSnapshot(snapshot)
    expect(out).toContain('minutesUntilAccessExpiry=42')
  })

  it('encodes anomalous writer with reason', () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.writerAnomaly = {
      isAnomalous: true,
      reason: 'legacy_in_process_refresher',
      writer: 'cursor-hermit-rotate',
    }
    snapshot.liveChatJwt.writer = 'cursor-hermit-rotate'
    const out = summarizeSnapshot(snapshot)
    expect(out).toContain('anomaly=anomalous(legacy_in_process_refresher)')
    expect(out).toContain('writer=cursor-hermit-rotate')
  })

  it('renders snapshot=missing for a null/undefined input', () => {
    expect(summarizeSnapshot(null)).toBe('snapshot=missing')
    expect(summarizeSnapshot(undefined)).toBe('snapshot=missing')
  })

  it('never emits raw JWT-shaped or Bearer-shaped strings even if writer leaks one', () => {
    const snapshot = healthySnapshot()
    // Construct a writer string that looks like a JWT to verify the
    // redactor runs on the field even though writers are normally
    // short labels like "privy-token-refresher".
    snapshot.liveChatJwt.writer =
      'header_xxxxxxx.payload_yyyyyyy.signature_zzzzzzz'
    const out = summarizeSnapshot(snapshot)
    expect(out).not.toContain('header_xxxxxxx.payload_yyyyyyy')
    expect(out).toContain('<redacted-jwt>')
  })
})

describe('redact — defense-in-depth', () => {
  it('strips JWT-shaped substrings', () => {
    const out = redact('token=AAAAAAAA.BBBBBBBB.CCCCCCCC trailing')
    expect(out).toContain('<redacted-jwt>')
    expect(out).not.toContain('AAAAAAAA.BBBBBBBB.CCCCCCCC')
  })

  it('strips Bearer headers', () => {
    const out = redact('Authorization: Bearer abcd1234efgh5678ijkl9012mnop3456')
    expect(out).toContain('Bearer <redacted>')
    expect(out).not.toContain('abcd1234efgh5678')
  })

  it('strips long opaque base64url runs', () => {
    const opaque = 'A'.repeat(60)
    const out = redact(`refresh=${opaque}`)
    expect(out).toContain('<redacted-opaque>')
    expect(out).not.toContain(opaque)
  })

  it('truncates output to 300 chars', () => {
    const huge = 'x'.repeat(2000)
    expect(redact(huge).length).toBeLessThanOrEqual(300)
  })

  it('passes short non-token strings through unchanged', () => {
    expect(redact('OK 200')).toBe('OK 200')
  })
})

// ── Integration: runMonitor() with an injected fetchImpl ──────────
//
// runMonitor is the in-process equivalent of the CLI: same evaluator,
// same summary, same exit codes, but returns `{ exitCode, stdout,
// stderr }` instead of touching `process`. We feed it a stub
// `fetchImpl` that returns deterministic fixtures, so the tests do
// not depend on any real network / loopback server.

const STUB_URL = 'https://app.example/api/v1/alfaclub/chat-auth-health'

describe('runMonitor — exit codes and sanitized output', () => {
  it('exits 0 on healthy fixture and emits the OK summary', async () => {
    const capture: { headers: Record<string, string> | null; url: string | null } = {
      headers: null,
      url: null,
    }
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: healthySnapshot() },
        capture,
      }),
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/alfaclub-auth-health: OK /)
    expect(result.stdout).toContain('minutesUntilExpiry=60')
    expect(result.stdout).toContain('writer=privy-token-refresher')
    expect(result.stdout).toContain('anomaly=ok')
    expect(result.stderr).toBe('')
    // Caller forwarded the secret as x-cron-secret header.
    expect(capture.headers?.['x-cron-secret']).toBe('stub-secret')
    expect(capture.url).toBe(STUB_URL)
  })

  it('exits 1 with FAIL expiring_soon when minutesUntilExpiry < 20', async () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = 5
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/alfaclub-auth-health: FAIL expiring_soon/)
    expect(result.stderr).toContain('minutesUntilExpiry=5')
  })

  it('exits 1 with FAIL writer_anomaly when liveChatJwt.writerAnomaly.isAnomalous', async () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.writerAnomaly = {
      isAnomalous: true,
      reason: 'legacy_in_process_refresher',
      writer: 'cursor-hermit-rotate',
    }
    snapshot.liveChatJwt.writer = 'cursor-hermit-rotate'
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/alfaclub-auth-health: FAIL writer_anomaly/)
    expect(result.stderr).toContain('anomaly=anomalous(legacy_in_process_refresher)')
  })

  it('exits 1 with FAIL refresh_failed_low_expiry on the wake-oncall condition', async () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.minutesUntilExpiry = 25
    snapshot.lastFailure = {
      at: '2026-05-01T11:50:00.000Z',
      status: 'error',
      errorCode: 'privy_refresh_failed:400',
      detail: '',
    } as unknown as null
    // lastSuccess.at is later than lastFailure.at — failure_after_success
    // would stay green, but the wake-oncall rule still fires.
    snapshot.lastSuccess = {
      ...snapshot.lastSuccess,
      at: '2026-05-01T11:55:00.000Z',
    }
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/alfaclub-auth-health: FAIL refresh_failed_low_expiry/)
    expect(result.stderr).toContain('minutesUntilExpiry=25')
  })

  it('exits 1 with FAIL failure_after_success when lastFailure newer than lastSuccess', async () => {
    const snapshot = healthySnapshot()
    snapshot.lastFailure = {
      at: '2026-05-01T11:58:00.000Z',
      status: 'error',
      errorCode: 'privy_refresh_failed:400',
      detail: '',
    } as unknown as null
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/alfaclub-auth-health: FAIL failure_after_success/)
  })

  it('exits 1 with FAIL missing_live_chat_jwt when liveChatJwt absent', async () => {
    const snapshot = healthySnapshot()
    // @ts-expect-error -- intentional shape removal
    delete snapshot.liveChatJwt
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/FAIL missing_live_chat_jwt/)
  })

  it('exits 1 with FAIL missing_last_success when lastSuccess absent', async () => {
    const snapshot = healthySnapshot()
    snapshot.lastSuccess = null as unknown as typeof snapshot.lastSuccess
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/FAIL missing_last_success/)
  })

  it('exits 1 with FAIL response_not_success when success:false', async () => {
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: false, error: 'Unauthorized' },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/FAIL response_not_success/)
  })

  it('exits 1 with FAIL http_status_<n> on non-200', async () => {
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 503,
        body: { success: false, error: 'CRON_SECRET is not configured' },
      }),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/FAIL http_status_503/)
  })

  it('exits 2 (misconfig) when secret is missing', async () => {
    const result = await runMonitor({
      url: STUB_URL,
      secret: '',
      fetchImpl: async () => {
        throw new Error('fetch should not have been called')
      },
    })
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/ALFACLUB_HEALTH_CRON_SECRET env var is required/)
  })

  it('exits 2 (misconfig) when url is not http(s)', async () => {
    const result = await runMonitor({
      url: 'file:///etc/passwd',
      secret: 'stub-secret',
      fetchImpl: async () => {
        throw new Error('fetch should not have been called')
      },
    })
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/must be http\(s\) URL/)
  })

  it('exits 1 with FAIL fetch_error on network failure', async () => {
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:9')
      },
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/FAIL fetch_error network/)
    // The redactor should not strip the diagnostic itself; it only
    // strips token-shaped substrings, which are not present here.
    expect(result.stderr).toContain('ECONNREFUSED')
  })

  it('never echoes the secret value in stdout or stderr', async () => {
    const sentinel = 'sek-1234-not-a-real-secret-but-distinctive'
    const result = await runMonitor({
      url: STUB_URL,
      secret: sentinel,
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: healthySnapshot() },
      }),
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain(sentinel)
    expect(result.stderr).not.toContain(sentinel)
  })

  it('aborts the request when the body read stalls past the timeout (timer covers headers + body)', async () => {
    // Simulate the case where headers arrive promptly but the body
    // never completes. The fetchImpl returns a Response whose body is
    // a stream that hangs; the AbortController on the request signal
    // must reject the body read once the timer fires. If clearTimeout
    // were called immediately after fetch() resolved, this test would
    // hang past the test runner timeout.
    let abortObserved = false
    const fetchImpl = (
      _input: string,
      init: { method: string; headers: Record<string, string>; signal: AbortSignal },
    ): Promise<Response> => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Send some bytes so headers can be considered "delivered",
          // then stall — only the abort signal will close us.
          controller.enqueue(new TextEncoder().encode('{"success":'))
          init.signal.addEventListener('abort', () => {
            abortObserved = true
            controller.error(new DOMException('Aborted', 'AbortError'))
          })
        },
      })
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      timeoutMs: 50,
      fetchImpl,
    })
    expect(abortObserved).toBe(true)
    // The aborted body read manifests as a fetch_error — the snapshot
    // is unparseable so the monitor cannot evaluate. Either fetch_error
    // or http_status_unknown is acceptable depending on how the runtime
    // surfaces the abort, but the key invariant is that the script does
    // not hang.
    expect(result.exitCode).toBe(1)
  })

  it('never echoes a JWT even if the response body somehow contains one', async () => {
    const snapshot = healthySnapshot()
    snapshot.liveChatJwt.writer =
      'leaky_header_xxxxxx.leaky_payload_yyyyyy.leaky_signature_zzzzzz'
    const result = await runMonitor({
      url: STUB_URL,
      secret: 'stub-secret',
      fetchImpl: makeFetchImpl({
        status: 200,
        body: { success: true, data: snapshot },
      }),
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('leaky_header_xxxxxx.leaky_payload_yyyyyy')
    expect(result.stdout).toContain('<redacted-jwt>')
  })
})
