import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { dbSqlMock, getDbMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({ rows: [] as any[], rowCount: 0 })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: () => true,
}))

import { getApiHandler } from '../_handlers/_routes.js'
import claimHandler from '../_handlers/keeper/jobs/_claim.js'
import completeHandler from '../_handlers/keeper/jobs/_complete.js'
import enqueueHandler from '../_handlers/keeper/jobs/_enqueue.js'
import healthHandler from '../_handlers/keeper/jobs/_health.js'
import runHandler from '../_handlers/keeper/jobs/_run.js'
import statusHandler from '../_handlers/keeper/jobs/_status.js'

const API_KEY = 'keeper-api-key-for-coordination-tests'
const AUTH = { authorization: `Bearer ${API_KEY}` }

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    kind: 'internal_api',
    status: 'pending',
    priority: 0,
    payload: { path: '/api/cre/keeper/tend', body: { vaultAddress: '0x1111111111111111111111111111111111111111' } },
    result: null,
    source: 'test',
    dedupe_key: 'job:test',
    run_at: new Date('2026-05-06T22:00:00.000Z'),
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    attempt_count: 0,
    max_attempts: 5,
    last_error: null,
    created_at: new Date('2026-05-06T22:00:00.000Z'),
    updated_at: new Date('2026-05-06T22:00:00.000Z'),
    ...overrides,
  }
}

describe('keeper job coordination handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({ KEEPR_API_KEY: API_KEY })
  })

  it('routes keeper job endpoints through the API route map', async () => {
    await expect(getApiHandler('keeper/jobs/enqueue')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/claim')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/complete')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/run')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/status')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/health')).resolves.toBeTypeOf('function')
  })

  it('requires machine auth before enqueueing jobs', async () => {
    const req = createMockReq({ method: 'POST', body: { kind: 'internal_api', payload: {} } })
    const res = createMockRes()

    await enqueueHandler(req, res)

    expect(res.statusCode).toBe(401)
    expect(dbSqlMock).not.toHaveBeenCalled()
  })

  it('enqueues a deduped internal API job', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [jobRow()], rowCount: 1 })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        kind: 'internal_api',
        dedupeKey: 'job:test',
        source: 'test',
        payload: {
          path: '/api/cre/keeper/tend',
          body: { vaultAddress: '0x1111111111111111111111111111111111111111' },
        },
      },
    })
    const res = createMockRes()

    await enqueueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.job?.id).toBe(42)
    expect(dbSqlMock).toHaveBeenCalledTimes(1)
  })

  it('claims due jobs after releasing expired claims', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [jobRow({ status: 'claimed', claimed_by: 'worker-a', attempt_count: 1 })],
        rowCount: 1,
      })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: { workerId: 'worker-a', limit: 1, leaseSeconds: 120, kinds: ['internal_api'] },
    })
    const res = createMockRes()

    await claimHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.count).toBe(1)
    expect(res.body?.data?.releasedExpiredClaims).toBe(1)
    expect(res.body?.data?.jobs?.[0]?.claimedBy).toBe('worker-a')
  })

  it('rejects completion by a worker that does not own the claim', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: { id: 42, workerId: 'worker-b', status: 'succeeded', result: { ok: true } },
    })
    const res = createMockRes()

    await completeHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('keeper_job_not_claimed_by_worker')
  })

  it('lists jobs for status inspection', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [jobRow({ status: 'retry' })], rowCount: 1 })
    const req = createMockReq({
      method: 'GET',
      headers: AUTH,
      query: { status: 'retry', limit: '10' },
    })
    const res = createMockRes()

    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.count).toBe(1)
    expect(res.body?.data?.jobs?.[0]?.status).toBe('retry')
  })

  it('reports retry, failed, and expired claim health counts', async () => {
    dbSqlMock.mockResolvedValueOnce({
      rows: [{ retry: 2, failed: 1, expired_claims: 3, claimed: 4 }],
      rowCount: 1,
    })
    const req = createMockReq({ method: 'GET', headers: AUTH })
    const res = createMockRes()

    await healthHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      retry: 2,
      failed: 1,
      expiredClaims: 3,
      claimed: 4,
    })
  })

  it('runs one cron-gated noop worker tick', async () => {
    const restoreEnv = applyEnv({
      KEEPR_API_KEY: API_KEY,
      CRON_SECRET: 'cron-secret-for-keeper-runner',
      KEEPER_COORDINATION_BASE_URL: 'https://app.4626.fun',
      KEEPER_WORKER_ID: 'test-cron-worker',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 77, kind: 'noop', status: 'claimed', claimed_by: 'test-cron-worker' })],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 77, kind: 'noop', status: 'succeeded' })],
          rowCount: 1,
        })
      const req = createMockReq({
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret-for-keeper-runner',
          host: 'app.4626.fun',
          'x-forwarded-proto': 'https',
        },
      })
      const res = createMockRes()

      await runHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.claimed).toBe(1)
      expect(res.body?.data?.results?.[0]).toMatchObject({
        id: 77,
        kind: 'noop',
        status: 'succeeded',
        error: null,
      })
    } finally {
      restoreEnv()
    }
  })
})
