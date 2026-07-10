import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { dbSqlMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({ rows: [] })),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  requireKeeprApiKey: vi.fn(() => true),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  isDbConfigured: vi.fn(() => true),
  getDbForCron: vi.fn(async () => ({ sql: dbSqlMock })),
  RATE_LIMITS: { keeperTriggerWrite: { windowMs: 60_000, maxRequests: 60 } },
  checkRateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn(() => 'keeper-solana-reconcile:test'),
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/controlPlane/policy.js', () => ({
  loadControlPlanePolicy: vi.fn(() => ({ policyVersion: 'test-v1' })),
}))

vi.mock('../../server/_lib/controlPlane/operations.js', () => ({
  startControlPlaneOperation: vi.fn(async () => ({
    operationId: 'op_test',
    persisted: false,
    reused: false,
  })),
  beginOperationExecution: vi.fn(),
  completeControlPlaneOperation: vi.fn(),
  createControlPlaneStage: vi.fn(),
  transitionOperationStatus: vi.fn(),
  transitionStageStatus: vi.fn(),
}))

import handler from '../_handlers/keeper/_solanaReconcile.ts'

describe('keeper Solana reconcile retry semantics', () => {
  const originalUrl = process.env.SOLANA_ORCHESTRATOR_URL

  beforeEach(() => {
    vi.clearAllMocks()
    dbSqlMock.mockReset()
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ claim_outcome: 'claimed', status: 'processing' }],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'failed' }] })
    process.env.SOLANA_ORCHESTRATOR_URL = 'https://orchestrator.invalid'
  })

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.SOLANA_ORCHESTRATOR_URL
    else process.env.SOLANA_ORCHESTRATOR_URL = originalUrl
    vi.unstubAllGlobals()
  })

  it('does not convert a nested lease-held outcome into top-level success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          ok: false,
          error: 'action_lease_held',
          retryable: true,
        }),
      })),
    )
    const req = createMockReq({
      method: 'POST',
      body: {
        workflow: 'solana-orchestrator',
        action: 'winner_relay',
        checkpointKey: 'finalized:123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      success: false,
      error: 'solana_reconcile_not_completed',
      data: {
        status: 'failed',
        executed: false,
        retryable: true,
        upstreamStatusCode: 409,
        upstreamResponse: {
          error: 'action_lease_held',
        },
      },
    })
  })

  it('preserves a non-retryable indeterminate action outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          ok: false,
          error: 'action_lease_outcome_indeterminate',
          retryable: false,
        }),
      })),
    )
    const req = createMockReq({
      method: 'POST',
      body: {
        workflow: 'solana-orchestrator',
        action: 'settle_fees',
        checkpointKey: 'harvest:123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      success: false,
      error: 'solana_reconcile_not_completed',
      data: {
        status: 'failed',
        executed: false,
        retryable: false,
        upstreamStatusCode: 409,
        upstreamResponse: {
          error: 'action_lease_outcome_indeterminate',
          retryable: false,
        },
      },
    })
  })

  it('allows only one concurrent request to reach the upstream mutation', async () => {
    dbSqlMock.mockReset()
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ claim_outcome: 'claimed', status: 'processing' }],
      })
      .mockResolvedValueOnce({
        rows: [{ claim_outcome: 'conflict', status: 'processing' }],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'completed' }] })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, signature: 'solana_signature' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const requestBody = {
      workflow: 'solana-orchestrator',
      action: 'winner_relay',
      checkpointKey: 'finalized:concurrent',
      payload: { slot: 123 },
    }
    const firstRes = createMockRes()
    const secondRes = createMockRes()

    await Promise.all([
      handler(createMockReq({ method: 'POST', body: requestBody }), firstRes),
      handler(createMockReq({ method: 'POST', body: requestBody }), secondRes),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect([firstRes.statusCode, secondRes.statusCode].sort()).toEqual([200, 409])
    const conflictResponse = firstRes.statusCode === 409 ? firstRes : secondRes
    expect(conflictResponse.body).toMatchObject({
      success: false,
      error: 'solana_reconcile_claim_conflict',
      data: {
        status: 'failed',
        executed: false,
        retryable: true,
        upstreamResponse: { reason: 'checkpoint_claim_active' },
      },
    })
  })

  it('does not report success when the attempt loses its finalize fence', async () => {
    dbSqlMock.mockReset()
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ claim_outcome: 'claimed', status: 'processing' }],
      })
      .mockResolvedValueOnce({ rows: [] })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, signature: 'late_signature' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const req = createMockReq({
      method: 'POST',
      body: {
        workflow: 'solana-orchestrator',
        action: 'settle_fees',
        checkpointKey: 'harvest:lost-fence',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      success: false,
      error: 'solana_reconcile_claim_conflict',
      data: {
        status: 'failed',
        executed: false,
        retryable: true,
        upstreamStatusCode: 200,
        upstreamResponse: { reason: 'checkpoint_claim_lost' },
      },
    })
  })
})
