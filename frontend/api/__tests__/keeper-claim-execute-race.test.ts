import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { dbSqlMock, getDbMock, ensureKeeprSchemaMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [{ graduated_at: new Date().toISOString(), settled_at: null, settlement_stage_updated_at: null }],
    rowCount: 1,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  ensureKeeprSchemaMock: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: () => true,
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '198.51.100.10'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: { keeperTriggerWrite: { windowMs: 60_000, maxRequests: 60 } },
}))

vi.mock('../../server/_lib/controlPlane/operations.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/controlPlane/operations.js')>(
    '../../server/_lib/controlPlane/operations.js',
  )
  return {
    ...actual,
    transitionOperationStatus: vi.fn(async () => undefined),
    transitionStageStatus: vi.fn(async () => undefined),
    startControlPlaneOperation: vi.fn(async () => ({ operationId: 'op_settle_race', persisted: true, reused: false })),
    createControlPlaneStage: vi.fn(async () => ({ stageId: 'stage_settle_race', persisted: true })),
    addControlPlaneEvent: vi.fn(async () => undefined),
  }
})

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: vi.fn(async () => ({ id: 55 })),
}))

import markSettledHandler from '../_handlers/keeper/_markSettled.ts'

describe('keeper explicit intent: claim/execute race settlement gate', () => {
  const VAULT = '0x1111111111111111111111111111111111111111'
  const AUTH = { authorization: 'Bearer test-keepr-key' }

  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({ KPR_API_KEY: 'test-keepr-key' })
  })

  async function post(body: Record<string, unknown>) {
    const req = createMockReq({ method: 'POST', headers: AUTH, body })
    const res = createMockRes()
    await markSettledHandler(req, res)
    return res
  }

  it('rejects claim-time settledAt before execute-time completion is confirmed', async () => {
    const res = await post({
      vaultAddress: VAULT,
      settledAt: new Date().toISOString(),
      settlementStage: 'awaiting_owner_hook_config',
    })

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('settlementStage="completed"')
    const sqlTexts = dbSqlMock.mock.calls.map((call) => String((call[0] as TemplateStringsArray | undefined)?.[0] ?? ''))
    expect(sqlTexts.some((text) => text.includes('UPDATE keepr_vaults'))).toBe(false)
  })

  it('queues execute-time settlement only when stage is completed', async () => {
    const res = await post({
      vaultAddress: VAULT,
      settledAt: new Date().toISOString(),
      settlementStage: 'completed',
    })

    expect(res.statusCode).toBe(202)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.accepted).toBe(true)
    const sqlTexts = dbSqlMock.mock.calls.map((call) => String((call[0] as TemplateStringsArray | undefined)?.[0] ?? ''))
    expect(sqlTexts.some((text) => text.includes('UPDATE keepr_vaults'))).toBe(false)
  })
})
