// PR 4 — `_amoeRetryCron` handler integration tests.
//
// Covers the Vercel-cron retry handler (GET /api/v1/lottery/amoe/retry-cron):
//
//   1. Routing — `lottery/amoe/retry-cron` resolves to a function.
//   2. Method enforcement — non-GET/POST → 405.
//   3. Feature flag closed → 503 `zk_path_disabled`.
//   4. Cron auth — missing / wrong / too-short bearer → 401 unauthorized.
//   5. Cron auth — `CRON_SECRET` and `AMOE_CRON_SECRET` fallback both work.
//   6. Cron auth — accepts both `Bearer <secret>` and bare `<secret>`.
//   7. Lottery router env unset → 503 `Lottery manager not configured`.
//   8. No relay configured → 200 with `tick: 'no_relay_configured'`.
//   9. Happy path — picks rows, calls `retrySubmissionByIdAsCron` per
//      row, returns aggregated outcomes; reclaim + GC also invoked.
//  10. Per-row throw is caught and surfaced as `outcome: 'error'` with
//      truncated `error` message.
//  11. Reclaim / GC errors do not blow up the cron tick.
//
// Mocks:
//   * `amoeSubmitZk` env helpers (feature flag, router address, epoch).
//   * `amoeReplayStore` row picker + reclaim + GC.
//   * `amoeReplayRetry` per-row retry function.
//   * Use the handler's `__setAmoeRetryCronHandlerHooksForTest` to inject
//     a relay (the production cron currently no-ops without one — the
//     hook lets us drive the processed path in tests).

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  pickRetriesForCronMock,
  reclaimStrandedRetriesMock,
  gcExpiredProofBlobsMock,
  retrySubmissionByIdAsCronMock,
} = vi.hoisted(() => ({
  pickRetriesForCronMock: vi.fn(),
  reclaimStrandedRetriesMock: vi.fn(),
  gcExpiredProofBlobsMock: vi.fn(),
  retrySubmissionByIdAsCronMock: vi.fn(),
}))

vi.mock('../../server/_lib/lottery/amoeReplayStore.js', () => ({
  pickRetriesForCron: pickRetriesForCronMock,
  reclaimStrandedRetries: reclaimStrandedRetriesMock,
  gcExpiredProofBlobs: gcExpiredProofBlobsMock,
}))

vi.mock('../../server/_lib/lottery/amoeReplayRetry.js', () => ({
  retrySubmissionByIdAsCron: retrySubmissionByIdAsCronMock,
}))

import {
  __setAmoeRetryCronHandlerHooksForTest,
  __resetAmoeRetryCronHandlerHooksForTest,
} from '../_handlers/v1/lottery/_amoeRetryCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'
const LOTTERY_ROUTER = '0x000000000000000000000000000000000000abcd'

function fakeRow(id: string) {
  // Minimal fields the cron iterates over — only `id` is read by the
  // handler (it forwards to retryOne and reports back); we don't need
  // a full AmoeSubmissionRow shape because the handler doesn't read
  // anything else.
  return { id } as any
}

function setEnabledEnv(opts: { secretEnv?: 'CRON_SECRET' | 'AMOE_CRON_SECRET' } = {}): () => void {
  const prior = {
    enabled: process.env.AMOE_ZK_SUBMIT_ENABLED,
    router: process.env.LOTTERY_AMOE_ROUTER,
    cron: process.env.CRON_SECRET,
    amoecron: process.env.AMOE_CRON_SECRET,
  }
  process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
  process.env.LOTTERY_AMOE_ROUTER = LOTTERY_ROUTER
  // Default: write the canonical CRON_SECRET unless caller asked for
  // the AMOE_CRON_SECRET fallback specifically.
  delete process.env.CRON_SECRET
  delete process.env.AMOE_CRON_SECRET
  if (opts.secretEnv === 'AMOE_CRON_SECRET') {
    process.env.AMOE_CRON_SECRET = VALID_SECRET
  } else {
    process.env.CRON_SECRET = VALID_SECRET
  }
  return () => {
    for (const [k, v] of Object.entries({
      AMOE_ZK_SUBMIT_ENABLED: prior.enabled,
      LOTTERY_AMOE_ROUTER: prior.router,
      CRON_SECRET: prior.cron,
      AMOE_CRON_SECRET: prior.amoecron,
    })) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

function authReq(opts: {
  method?: string
  authHeader?: string | undefined
} = {}) {
  const headers: Record<string, string | undefined> = {}
  if (opts.authHeader !== undefined) headers.authorization = opts.authHeader
  return createMockReq({ method: opts.method ?? 'GET', headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  pickRetriesForCronMock.mockResolvedValue([])
  reclaimStrandedRetriesMock.mockResolvedValue(0)
  gcExpiredProofBlobsMock.mockResolvedValue(0)
  retrySubmissionByIdAsCronMock.mockResolvedValue({
    kind: 'settled',
    txHash: `0x${'aa'.repeat(32)}`,
  })
})

afterEach(() => {
  __resetAmoeRetryCronHandlerHooksForTest()
})

// ---------------------------------------------------------------------------
// Routing + method
// ---------------------------------------------------------------------------

describe('routing — lottery/amoe/retry-cron', () => {
  it('registers the retry-cron route', async () => {
    const fn = await getV1ApiHandler('lottery/amoe/retry-cron')
    expect(typeof fn).toBe('function')
  })
})

describe('method enforcement', () => {
  it('returns 405 for non-GET/POST methods', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ method: 'PUT', authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
    } finally {
      restore()
    }
  })

  it('accepts POST in addition to GET', async () => {
    const restore = setEnabledEnv()
    try {
      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ method: 'POST', authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.tick).toBe('processed')
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
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
    const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('zk_path_disabled')
  })
})

// ---------------------------------------------------------------------------
// Cron auth
// ---------------------------------------------------------------------------

describe('cron auth', () => {
  it('returns 401 when CRON_SECRET / AMOE_CRON_SECRET are unset', async () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
    process.env.LOTTERY_AMOE_ROUTER = LOTTERY_ROUTER
    delete process.env.CRON_SECRET
    delete process.env.AMOE_CRON_SECRET
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer whatever` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.error).toBe('unauthorized')
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
      delete process.env.LOTTERY_AMOE_ROUTER
    }
  })

  it('returns 401 when secret is too short (<16 chars), even if set', async () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
    process.env.LOTTERY_AMOE_ROUTER = LOTTERY_ROUTER
    process.env.CRON_SECRET = 'tooshort'
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: 'Bearer tooshort' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.error).toBe('unauthorized')
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
      delete process.env.LOTTERY_AMOE_ROUTER
      delete process.env.CRON_SECRET
    }
  })

  it('returns 401 when Authorization header is missing', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({}) // no header
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.error).toBe('unauthorized')
    } finally {
      restore()
    }
  })

  it('returns 401 when Authorization header value mismatches', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: 'Bearer wrong-secret-of-sufficient-length-xxx' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.error).toBe('unauthorized')
    } finally {
      restore()
    }
  })

  it('returns 401 when provided length differs from expected (length-then-byte compare)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      // Differing-length secret is rejected without scanning bytes.
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}-extra` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
    } finally {
      restore()
    }
  })

  it('accepts CRON_SECRET via Bearer prefix', async () => {
    const restore = setEnabledEnv()
    try {
      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.ok).toBe(true)
    } finally {
      restore()
    }
  })

  it('accepts bare <secret> without Bearer prefix', async () => {
    const restore = setEnabledEnv()
    try {
      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: VALID_SECRET })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.ok).toBe(true)
    } finally {
      restore()
    }
  })

  it('falls back to AMOE_CRON_SECRET when CRON_SECRET is unset', async () => {
    const restore = setEnabledEnv({ secretEnv: 'AMOE_CRON_SECRET' })
    try {
      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.ok).toBe(true)
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
    process.env.CRON_SECRET = VALID_SECRET
    delete process.env.LOTTERY_AMOE_ROUTER
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body?.error).toMatch(/Lottery manager not configured/i)
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
      delete process.env.CRON_SECRET
    }
  })
})

// ---------------------------------------------------------------------------
// Relay availability
// ---------------------------------------------------------------------------

describe('relay availability', () => {
  it('returns 200 no_relay_configured when no relay is wired in', async () => {
    const restore = setEnabledEnv()
    try {
      // Leave hooks untouched — no relay injected.
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        tick: 'no_relay_configured',
        pickedCount: 0,
        reclaimedCount: 0,
        gcCount: 0,
      })
      // No DB calls in the no-relay short-circuit.
      expect(pickRetriesForCronMock).not.toHaveBeenCalled()
      expect(reclaimStrandedRetriesMock).not.toHaveBeenCalled()
      expect(gcExpiredProofBlobsMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Processed-tick happy path + per-row outcomes
// ---------------------------------------------------------------------------

describe('processed tick', () => {
  it('reclaims, picks rows, retries each, then GCs and returns aggregate', async () => {
    const restore = setEnabledEnv()
    try {
      reclaimStrandedRetriesMock.mockResolvedValueOnce(2)
      pickRetriesForCronMock.mockResolvedValueOnce([
        fakeRow('11111111-1111-1111-1111-111111111111'),
        fakeRow('22222222-2222-2222-2222-222222222222'),
        fakeRow('33333333-3333-3333-3333-333333333333'),
      ])
      retrySubmissionByIdAsCronMock
        .mockResolvedValueOnce({ kind: 'settled', txHash: `0x${'aa'.repeat(32)}` })
        .mockResolvedValueOnce({ kind: 'manager_declined_again', retryCount: 4, reason: 'ManagerDeclinedEntry' })
        .mockResolvedValueOnce({ kind: 'abandoned_epoch_rolled' })
      gcExpiredProofBlobsMock.mockResolvedValueOnce(7)

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        tick: 'processed',
        pickedCount: 3,
        reclaimedCount: 2,
        gcCount: 7,
      })
      expect(res.body.outcomes).toEqual([
        { id: '11111111-1111-1111-1111-111111111111', outcome: 'settled' },
        { id: '22222222-2222-2222-2222-222222222222', outcome: 'manager_declined_again' },
        { id: '33333333-3333-3333-3333-333333333333', outcome: 'abandoned_epoch_rolled' },
      ])

      // Reclaim runs BEFORE the row pick (so a single tick has the
      // chance to recover-then-process).
      const reclaimOrder = reclaimStrandedRetriesMock.mock.invocationCallOrder[0]
      const pickOrder = pickRetriesForCronMock.mock.invocationCallOrder[0]
      expect(reclaimOrder).toBeLessThan(pickOrder)

      // Each row was retried with the right env wiring.
      expect(retrySubmissionByIdAsCronMock).toHaveBeenCalledTimes(3)
      const firstCall = retrySubmissionByIdAsCronMock.mock.calls[0]
      expect(firstCall[0]).toBe('11111111-1111-1111-1111-111111111111')
      expect(firstCall[1].lotteryAmoeRouter).toBe(LOTTERY_ROUTER)
      expect(typeof firstCall[1].currentEpoch).toBe('bigint')
      expect(typeof firstCall[1].relay).toBe('function')

      // GC ran at the end (after the last retry).
      const lastRetryOrder =
        retrySubmissionByIdAsCronMock.mock.invocationCallOrder[2]
      const gcOrder = gcExpiredProofBlobsMock.mock.invocationCallOrder[0]
      expect(lastRetryOrder).toBeLessThan(gcOrder)
    } finally {
      restore()
    }
  })

  it('catches per-row errors and surfaces them as outcome: "error"', async () => {
    const restore = setEnabledEnv()
    try {
      pickRetriesForCronMock.mockResolvedValueOnce([
        fakeRow('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
        fakeRow('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      ])
      retrySubmissionByIdAsCronMock
        .mockRejectedValueOnce(new Error('rpc_timeout'))
        .mockResolvedValueOnce({ kind: 'settled', txHash: `0x${'aa'.repeat(32)}` })

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.tick).toBe('processed')
      expect(res.body.pickedCount).toBe(2)
      expect(res.body.outcomes).toEqual([
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          outcome: 'error',
          error: 'rpc_timeout',
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          outcome: 'settled',
        },
      ])
    } finally {
      restore()
    }
  })

  it('truncates long error messages to 200 chars', async () => {
    const restore = setEnabledEnv()
    try {
      const longMsg = 'x'.repeat(500)
      pickRetriesForCronMock.mockResolvedValueOnce([fakeRow('cccccccc-cccc-cccc-cccc-cccccccccccc')])
      retrySubmissionByIdAsCronMock.mockRejectedValueOnce(new Error(longMsg))

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.outcomes[0]).toMatchObject({
        outcome: 'error',
      })
      expect((res.body.outcomes[0].error as string).length).toBe(200)
    } finally {
      restore()
    }
  })

  it('handles non-Error throws with "unknown_error"', async () => {
    const restore = setEnabledEnv()
    try {
      pickRetriesForCronMock.mockResolvedValueOnce([fakeRow('dddddddd-dddd-dddd-dddd-dddddddddddd')])
      retrySubmissionByIdAsCronMock.mockRejectedValueOnce('not-an-error-instance')

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.outcomes[0]).toMatchObject({
        outcome: 'error',
        error: 'unknown_error',
      })
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Reclaim / GC failure isolation
// ---------------------------------------------------------------------------

describe('reclaim / gc failure isolation', () => {
  it('continues the tick when reclaim throws (records 0 reclaimedCount)', async () => {
    const restore = setEnabledEnv()
    try {
      reclaimStrandedRetriesMock.mockRejectedValueOnce(new Error('db_blip'))
      pickRetriesForCronMock.mockResolvedValueOnce([])

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        tick: 'processed',
        pickedCount: 0,
        reclaimedCount: 0,
      })
    } finally {
      restore()
    }
  })

  it('continues the tick when GC throws (records 0 gcCount)', async () => {
    const restore = setEnabledEnv()
    try {
      pickRetriesForCronMock.mockResolvedValueOnce([])
      gcExpiredProofBlobsMock.mockRejectedValueOnce(new Error('gc_blip'))

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        tick: 'processed',
        pickedCount: 0,
        gcCount: 0,
      })
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Hook injection — pickRows / retryOne overrides
// ---------------------------------------------------------------------------

describe('hook overrides', () => {
  it('uses test-injected pickRows when hooks.pickRows is set', async () => {
    const restore = setEnabledEnv()
    try {
      const customPick = vi.fn(async () => [fakeRow('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')])
      const customRetry = vi.fn(async () => ({ kind: 'settled' as const, txHash: `0x${'bb'.repeat(32)}` as `0x${string}` }))

      __setAmoeRetryCronHandlerHooksForTest({
        relay: async () => `0x${'aa'.repeat(32)}` as `0x${string}`,
        pickRows: customPick,
        retryOne: customRetry,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeRetryCron')
      const req = authReq({ authHeader: `Bearer ${VALID_SECRET}` })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(customPick).toHaveBeenCalledTimes(1)
      expect(customRetry).toHaveBeenCalledTimes(1)
      // Default impls were NOT called when overrides are present.
      expect(pickRetriesForCronMock).not.toHaveBeenCalled()
      expect(retrySubmissionByIdAsCronMock).not.toHaveBeenCalled()
      expect(res.body.outcomes).toEqual([
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', outcome: 'settled' },
      ])
    } finally {
      restore()
    }
  })
})
