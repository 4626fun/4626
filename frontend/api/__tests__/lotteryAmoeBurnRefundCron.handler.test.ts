// PR 6c — `_amoeBurnRefundCron` handler integration tests.
//
// Covers the Vercel-cron orphan-burn refund handler
// (GET /api/v1/lottery/amoe/burn-refund-cron):
//
//   1. Routing — `lottery/amoe/burn-refund-cron` resolves to a function.
//   2. Method enforcement — non-GET/POST → 405.
//   3. AMOE_ZK_SUBMIT_ENABLED missing → 503 `zk_path_disabled`.
//   4. AMOE_REFUND_CRON_ENABLED missing → 503 `refund_cron_disabled`.
//   5. Cron auth — missing / wrong bearer → 401 `unauthorized`.
//   6. No orphans → 200 `tick: 'no_orphans'` with zero counts.
//   7. Happy path — runner returns refunded count, response surfaces it.
//   8. Errors from the runner — handler returns 500 `tick: 'errored'`.
//   9. Per-row errors (refund failures inside the tick) flow through to
//      the response body's `errors` array but the handler still returns 200.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks for the helper module
// ---------------------------------------------------------------------------

const {
  isAmoeBurnRefundCronEnabledMock,
  readMaxRefundsPerTickMock,
  readRefundAgeSecMock,
  requireBurnRefundDbMock,
  runBurnRefundTickMock,
} = vi.hoisted(() => ({
  isAmoeBurnRefundCronEnabledMock: vi.fn(),
  readMaxRefundsPerTickMock: vi.fn(),
  readRefundAgeSecMock: vi.fn(),
  requireBurnRefundDbMock: vi.fn(),
  runBurnRefundTickMock: vi.fn(),
}))

vi.mock('../../server/_lib/lottery/amoeBurnRefund.js', () => ({
  isAmoeBurnRefundCronEnabled: isAmoeBurnRefundCronEnabledMock,
  readMaxRefundsPerTick: readMaxRefundsPerTickMock,
  readRefundAgeSec: readRefundAgeSecMock,
  requireBurnRefundDb: requireBurnRefundDbMock,
  runBurnRefundTick: runBurnRefundTickMock,
}))

import {
  __resetAmoeBurnRefundCronHandlerHooksForTest,
  __setAmoeBurnRefundCronHandlerHooksForTest,
} from '../_handlers/v1/lottery/_amoeBurnRefundCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'

function setEnabledEnv(): () => void {
  return applyEnv({
    AMOE_ZK_SUBMIT_ENABLED: '1',
    AMOE_REFUND_CRON_ENABLED: '1',
    CRON_SECRET: VALID_SECRET,
    AMOE_CRON_SECRET: undefined,
  })
}

function fakeDb(): any {
  return { sql: vi.fn(async () => ({ rows: [] })) }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('lottery/amoe/burn-refund-cron handler', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    restoreEnv = setEnabledEnv()
    isAmoeBurnRefundCronEnabledMock.mockReset()
    readMaxRefundsPerTickMock.mockReset()
    readRefundAgeSecMock.mockReset()
    requireBurnRefundDbMock.mockReset()
    runBurnRefundTickMock.mockReset()

    // Defaults: enabled, sane env, valid db, empty tick.
    isAmoeBurnRefundCronEnabledMock.mockReturnValue(true)
    readMaxRefundsPerTickMock.mockReturnValue(50)
    // 7 epochs × 86400s.
    readRefundAgeSecMock.mockReturnValue(7 * 86_400)
    requireBurnRefundDbMock.mockResolvedValue(fakeDb())
    runBurnRefundTickMock.mockResolvedValue({
      scannedCount: 0,
      refundedCount: 0,
      errors: [],
    })
  })

  afterEach(() => {
    __resetAmoeBurnRefundCronHandlerHooksForTest()
    restoreEnv()
  })

  it('routes lottery/amoe/burn-refund-cron to a handler', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    expect(typeof handler).toBe('function')
  })

  it('returns 405 for non-GET/POST methods', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({ method: 'DELETE' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toMatchObject({ ok: false })
  })

  it('returns 503 zk_path_disabled when AMOE_ZK_SUBMIT_ENABLED unset', async () => {
    const cleanup = applyEnv({ AMOE_ZK_SUBMIT_ENABLED: undefined })
    try {
      const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({ ok: false, error: 'zk_path_disabled' })
    } finally {
      cleanup()
    }
  })

  it('returns 503 refund_cron_disabled when AMOE_REFUND_CRON_ENABLED unset', async () => {
    isAmoeBurnRefundCronEnabledMock.mockReturnValue(false)
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ ok: false, error: 'refund_cron_disabled' })
  })

  it('returns 401 when bearer is missing', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' })
  })

  it('returns 401 when bearer is wrong', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret-of-sufficient-length-32' },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 tick=no_orphans when nothing matches', async () => {
    runBurnRefundTickMock.mockResolvedValue({
      scannedCount: 0,
      refundedCount: 0,
      errors: [],
    })
    __setAmoeBurnRefundCronHandlerHooksForTest({
      db: fakeDb(),
      runTick: runBurnRefundTickMock,
    })
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'no_orphans',
      scannedCount: 0,
      refundedCount: 0,
    })
    expect(runBurnRefundTickMock).toHaveBeenCalledTimes(1)
  })

  it('happy path: refunds reported in response', async () => {
    runBurnRefundTickMock.mockResolvedValue({
      scannedCount: 3,
      refundedCount: 3,
      errors: [],
    })
    __setAmoeBurnRefundCronHandlerHooksForTest({
      db: fakeDb(),
      runTick: runBurnRefundTickMock,
      ageSec: 7 * 86_400,
      limit: 50,
    })
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'refunded',
      scannedCount: 3,
      refundedCount: 3,
      ageSec: 7 * 86_400,
      limit: 50,
    })
    // The runner is invoked with the hook-supplied (db, args) tuple.
    expect(runBurnRefundTickMock).toHaveBeenCalledWith(expect.any(Object), {
      ageSec: 7 * 86_400,
      limit: 50,
    })
  })

  it('per-row errors surface in response body but handler returns 200', async () => {
    runBurnRefundTickMock.mockResolvedValue({
      scannedCount: 2,
      refundedCount: 1,
      errors: [{ pointsId: '42', message: 'unique_violation_simulated' }],
    })
    __setAmoeBurnRefundCronHandlerHooksForTest({
      db: fakeDb(),
      runTick: runBurnRefundTickMock,
    })
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: false,
      tick: 'refunded',
      scannedCount: 2,
      refundedCount: 1,
      errors: [{ pointsId: '42', message: 'unique_violation_simulated' }],
    })
  })

  it('runner-level exception → 500 tick=errored', async () => {
    runBurnRefundTickMock.mockRejectedValue(new Error('boom_db_unreachable'))
    __setAmoeBurnRefundCronHandlerHooksForTest({
      db: fakeDb(),
      runTick: runBurnRefundTickMock,
    })
    const handler = await getV1ApiHandler('lottery/amoe/burn-refund-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatchObject({
      ok: false,
      tick: 'errored',
      error: expect.stringContaining('boom_db_unreachable'),
    })
  })
})
