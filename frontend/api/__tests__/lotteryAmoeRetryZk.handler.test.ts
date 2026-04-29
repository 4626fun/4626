// PR 4 — `_amoeRetryZk` handler integration tests.
//
// Covers the manual retry endpoint (POST /api/v1/lottery/amoe/retry-zk):
//
//   1. Routing — `lottery/amoe/retry-zk` resolves to a function.
//   2. Method enforcement (only POST).
//   3. Feature flag closed (default) → 503 `zk_path_disabled`.
//   4. In-memory rate limit → 429 + `Retry-After`.
//   5. Durable rate limit → 429 `Rate limited`.
//   6. Body validation — missing / non-UUID `submissionId` → 400
//      `invalid_submission_id`.
//   7. Lottery router env unset → 503 `Lottery manager not configured`.
//   8. Auth/profile gating — unresolved wallet / non-safe-integer profileId
//      → 403 `amoe_profile_unresolved`.
//   9. Retry orchestrator outcomes:
//      - `settled` → 200 with `state: 'settled'` + `txHash`.
//      - `manager_declined_again` → 202 `submission_manager_declined`.
//      - `abandoned_epoch_rolled` → 410 `submission_epoch_rolled`.
//      - `abandoned_budget_exhausted` → 410 `submission_abandoned`.
//  10. Error mapping — `submission_not_retryable` → 409,
//      `submission_not_found` → 404, generic AmoeServerError → 500.
//
// Mocking strategy mirrors `lotteryAmoeSubmitZk.handler.test.ts`:
//   * Mock the `packages/server-core` barrel for guard / rate-limits /
//     body parsing / CORS.
//   * Mock the durable rate limit module separately (it lives outside
//     the barrel).
//   * Mock `amoeWalletResolver`, `amoeReplayRetry`, and the
//     `amoeSubmitZk` env helpers.
//   * Use `__setAmoeRetryZkHandlerHooksForTest` to inject the test
//     relay seam where needed.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  guardMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  handleOptionsMock,
  readBoundedJsonObjectBodyMock,
  checkDurableRateLimitMock,
  resolveAmoeWalletMock,
  retrySubmissionByIdMock,
} = vi.hoisted(() => ({
  guardMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
  rateLimitKeyMock: vi.fn(),
  handleOptionsMock: vi.fn(() => false),
  readBoundedJsonObjectBodyMock: vi.fn(),
  checkDurableRateLimitMock: vi.fn(),
  resolveAmoeWalletMock: vi.fn(),
  retrySubmissionByIdMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: handleOptionsMock,
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  guardAgentApiRequest: guardMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    lotteryRead: { windowMs: 60_000, maxRequests: 120 },
    lotteryWrite: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: checkDurableRateLimitMock,
}))

vi.mock('../../server/_lib/lottery/amoeWalletResolver.js', () => ({
  resolveAmoeWallet: resolveAmoeWalletMock,
}))

vi.mock('../../server/_lib/lottery/amoeReplayRetry.js', () => ({
  retrySubmissionById: retrySubmissionByIdMock,
}))

import {
  __resetAmoeRetryZkHandlerHooksForTest,
  __setAmoeRetryZkHandlerHooksForTest,
} from '../_handlers/v1/lottery/_amoeRetryZk.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'
import {
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeServerError,
} from '../../server/_lib/lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SUBMISSION_ID = '11111111-2222-3333-4444-555555555555'
const VALID_TX = `0x${'aa'.repeat(32)}` as `0x${string}`
const CALLER_WALLET = '0x000000000000000000000000000000000000cafe'
const PROFILE_ID = 42
const LOTTERY_ROUTER = '0x000000000000000000000000000000000000abcd'

function setEnabledEnv(): () => void {
  const prior = process.env.AMOE_ZK_SUBMIT_ENABLED
  const priorRouter = process.env.LOTTERY_AMOE_ROUTER
  process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
  process.env.LOTTERY_AMOE_ROUTER = LOTTERY_ROUTER
  return () => {
    if (prior === undefined) delete process.env.AMOE_ZK_SUBMIT_ENABLED
    else process.env.AMOE_ZK_SUBMIT_ENABLED = prior
    if (priorRouter === undefined) delete process.env.LOTTERY_AMOE_ROUTER
    else process.env.LOTTERY_AMOE_ROUTER = priorRouter
  }
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { submissionId: VALID_SUBMISSION_ID, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  handleOptionsMock.mockReturnValue(false)
  readBoundedJsonObjectBodyMock.mockImplementation(async (req: any) => req.body ?? null)
  guardMock.mockResolvedValue({
    ok: true,
    ip: '127.0.0.1',
    auth: { type: 'session', address: '0x0000000000000000000000000000000000000aa1' },
  })
  checkRateLimitMock.mockReturnValue({
    allowed: true,
    remaining: 39,
    resetAt: Date.now() + 60_000,
  })
  getClientIpMock.mockReturnValue('127.0.0.1')
  rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
  checkDurableRateLimitMock.mockResolvedValue({
    allowed: true,
    remaining: 5,
    resetAt: Date.now() + 60_000,
  })
  resolveAmoeWalletMock.mockResolvedValue({
    ok: true,
    value: {
      wallet: CALLER_WALLET,
      profileId: PROFILE_ID,
      canonicalSmartWalletAddress: CALLER_WALLET,
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    },
  })
  // Default outcome — settled. Each outcome test overrides this.
  retrySubmissionByIdMock.mockResolvedValue({
    kind: 'settled',
    txHash: VALID_TX,
  })
  // Most tests assume a relay is wired so they reach the retry
  // orchestrator. The bare-handler short-circuit is exercised in its
  // own describe block below; tests that need the missing-relay path
  // call `__resetAmoeRetryZkHandlerHooksForTest()` explicitly.
  __setAmoeRetryZkHandlerHooksForTest({
    relay: (async () => ({
      kind: 'sent',
      txHash: VALID_TX,
    })) as any,
  })
})

afterEach(() => {
  __resetAmoeRetryZkHandlerHooksForTest()
})

// ---------------------------------------------------------------------------
// Routing + method
// ---------------------------------------------------------------------------

describe('routing — lottery/amoe/retry-zk', () => {
  it('registers the retry-zk route', async () => {
    const fn = await getV1ApiHandler('lottery/amoe/retry-zk')
    expect(typeof fn).toBe('function')
  })
})

describe('method enforcement', () => {
  it('returns 405 for non-POST', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
    } finally {
      restore()
    }
  })

  it('short-circuits OPTIONS via handleOptions', async () => {
    const restore = setEnabledEnv()
    try {
      handleOptionsMock.mockReturnValueOnce(true)
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'OPTIONS' })
      const res = createMockRes()
      await handler(req, res)
      expect(handleOptionsMock).toHaveBeenCalled()
      // handleOptions=true => handler returns without further processing.
      expect(retrySubmissionByIdMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

describe('feature flag', () => {
  it('returns 503 zk_path_disabled when AMOE_ZK_SUBMIT_ENABLED is unset', async () => {
    delete process.env.AMOE_ZK_SUBMIT_ENABLED
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
    const req = createMockReq({ method: 'POST', body: validBody() })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('zk_path_disabled')
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('returns 429 with Retry-After when in-memory rate limit denies', async () => {
    const restore = setEnabledEnv()
    try {
      checkRateLimitMock.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.body?.error).toBe('Too many requests')
      expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    } finally {
      restore()
    }
  })

  it('returns 429 Rate limited when durable rate limit denies', async () => {
    const restore = setEnabledEnv()
    try {
      checkDurableRateLimitMock.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
      expect(res.body?.error).toBe('Rate limited')
      // Headers populated even on deny.
      expect(res.getHeader('x-ratelimit-remaining')).toBeDefined()
      expect(res.getHeader('x-ratelimit-reset')).toBeDefined()
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

describe('body validation', () => {
  it('rejects missing submissionId with 400 invalid_submission_id', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: {} })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_submission_id')
    } finally {
      restore()
    }
  })

  it('rejects non-UUID submissionId', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({
        method: 'POST',
        body: { submissionId: 'not-a-uuid' },
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_submission_id')
    } finally {
      restore()
    }
  })

  it('rejects non-string submissionId', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({
        method: 'POST',
        body: { submissionId: 12345 },
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_submission_id')
    } finally {
      restore()
    }
  })

  it('treats null body as empty (still rejects with 400 invalid_submission_id)', async () => {
    const restore = setEnabledEnv()
    try {
      readBoundedJsonObjectBodyMock.mockResolvedValueOnce(null)
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: null })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_submission_id')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Lottery router env
// ---------------------------------------------------------------------------

describe('lottery router env', () => {
  it('returns 503 when LOTTERY_AMOE_ROUTER is unset', async () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
    delete process.env.LOTTERY_AMOE_ROUTER
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body?.error).toMatch(/Lottery manager not configured/i)
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
    }
  })
})

// ---------------------------------------------------------------------------
// Auth / profile gating
// ---------------------------------------------------------------------------

describe('auth / profile gating', () => {
  it('returns 403 amoe_profile_unresolved when wallet resolution fails', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: false,
        error: 'amoe_profile_unresolved',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved for null profileId', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CALLER_WALLET,
          profileId: null,
          canonicalSmartWalletAddress: CALLER_WALLET,
          activeOwnerWalletAddress: CALLER_WALLET,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved for zero profileId', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CALLER_WALLET,
          profileId: 0,
          canonicalSmartWalletAddress: CALLER_WALLET,
          activeOwnerWalletAddress: CALLER_WALLET,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved for non-safe-integer profileId', async () => {
    const restore = setEnabledEnv()
    try {
      // Number above MAX_SAFE_INTEGER aliases distinct bigint rows.
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CALLER_WALLET,
          profileId: Number.MAX_SAFE_INTEGER + 2,
          canonicalSmartWalletAddress: CALLER_WALLET,
          activeOwnerWalletAddress: CALLER_WALLET,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Relay-missing short-circuit (Codex review on PR #444 — fix #1)
// ---------------------------------------------------------------------------

describe('relay-missing short-circuit', () => {
  // Codex review on PR #444 found the previous handler always passed
  // `relay: __testHooks.relay` (undefined in production) which made
  // `retrySubmissionById` throw `amoe_retry_relay_missing` → 500.
  // The fix is to short-circuit with a 200 `state: no_relay_configured`
  // — same shape as the cron handler — so ops gets an actionable
  // metric instead of a hard error.
  it('returns 200 no_relay_configured when no relay is configured', async () => {
    const restore = setEnabledEnv()
    try {
      // Default `beforeEach` installs a stub relay; clear it for this
      // single test so the short-circuit fires.
      __resetAmoeRetryZkHandlerHooksForTest()
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data).toMatchObject({
        submissionId: VALID_SUBMISSION_ID,
        state: 'no_relay_configured',
      })
      // Critically, the orchestrator must NOT have been entered —
      // otherwise we'd be re-incurring the original `amoe_retry_relay_missing`
      // 500 inside `retrySubmissionById`.
      expect(retrySubmissionByIdMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Retry orchestrator outcomes (happy path + each terminal kind)
// ---------------------------------------------------------------------------

describe('retry outcomes', () => {
  it('returns 200 settled with txHash on `settled` outcome', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockResolvedValueOnce({
        kind: 'settled',
        txHash: VALID_TX,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data).toMatchObject({
        submissionId: VALID_SUBMISSION_ID,
        txHash: VALID_TX,
        state: 'settled',
      })

      // Orchestrator received the right inputs.
      expect(retrySubmissionByIdMock).toHaveBeenCalledTimes(1)
      const call = retrySubmissionByIdMock.mock.calls[0][0]
      expect(call.submissionId).toBe(VALID_SUBMISSION_ID)
      expect(call.callerSignupId).toBe(BigInt(PROFILE_ID))
      expect(call.lotteryAmoeRouter).toBe(LOTTERY_ROUTER)
      expect(typeof call.currentEpoch).toBe('bigint')
    } finally {
      restore()
    }
  })

  it('returns 202 submission_manager_declined on `manager_declined_again`', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockResolvedValueOnce({
        kind: 'manager_declined_again',
        retryCount: 3,
        reason: 'ManagerDeclinedEntry',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(202)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('submission_manager_declined')
      expect(res.body?.data).toMatchObject({
        submissionId: VALID_SUBMISSION_ID,
        state: 'manager_declined',
        retryCount: 3,
      })
    } finally {
      restore()
    }
  })

  it('returns 410 submission_epoch_rolled on `abandoned_epoch_rolled`', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockResolvedValueOnce({
        kind: 'abandoned_epoch_rolled',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(410)
      expect(res.body?.error).toBe('submission_epoch_rolled')
      expect(res.body?.data).toMatchObject({ submissionId: VALID_SUBMISSION_ID })
    } finally {
      restore()
    }
  })

  it('returns 410 submission_abandoned on `abandoned_budget_exhausted`', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockResolvedValueOnce({
        kind: 'abandoned_budget_exhausted',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(410)
      expect(res.body?.error).toBe('submission_abandoned')
      expect(res.body?.data).toMatchObject({ submissionId: VALID_SUBMISSION_ID })
    } finally {
      restore()
    }
  })

  it('returns 500 amoe_retry_unexpected_outcome for unknown outcome kind', async () => {
    const restore = setEnabledEnv()
    try {
      // The handler defends against an unexpected outcome by throwing
      // AmoeServerError — `classifyAmoeError` maps that to 500.
      retrySubmissionByIdMock.mockResolvedValueOnce({
        kind: 'rejected_chain',
        reason: 'unexpected',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(500)
      expect(res.body?.error).toBe('amoe_retry_unexpected_outcome')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe('error mapping', () => {
  it('maps submission_not_retryable AmoeBadRequestError → 409', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockRejectedValueOnce(
        new AmoeBadRequestError('submission_not_retryable'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(409)
      expect(res.body?.error).toBe('submission_not_retryable')
    } finally {
      restore()
    }
  })

  it('maps submission_not_found AmoeBadRequestError → 404', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockRejectedValueOnce(
        new AmoeBadRequestError('submission_not_found'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(404)
      expect(res.body?.error).toBe('submission_not_found')
    } finally {
      restore()
    }
  })

  it('falls back to classifyAmoeError for other AmoeBadRequestError → 400', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockRejectedValueOnce(
        new AmoeBadRequestError('zk_invalid_proof'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('zk_invalid_proof')
    } finally {
      restore()
    }
  })

  it('maps AmoeAuthorityError → 403', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockRejectedValueOnce(
        new AmoeAuthorityError('signup_id_mismatch'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('signup_id_mismatch')
    } finally {
      restore()
    }
  })

  it('maps AmoeServerError → 500', async () => {
    const restore = setEnabledEnv()
    try {
      retrySubmissionByIdMock.mockRejectedValueOnce(
        new AmoeServerError('relay_failed'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(500)
      expect(res.body?.error).toBe('relay_failed')
    } finally {
      restore()
    }
  })
})
