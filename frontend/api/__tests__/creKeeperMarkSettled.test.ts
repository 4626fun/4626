import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

// Mock rate-limit as always-allowed so we reach handler logic.
const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: true,
    remaining: 1,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '198.51.100.55'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    creRuntimeTriggerWrite: { windowMs: 60_000, maxRequests: 60 },
  },
}))

// Mock the DB layer so handler writes don't actually need Postgres.
const { dbSqlMock, getDbMock, ensureKeeprSchemaMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({ rows: [] as any[], rowCount: 0 })),
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

import creKeeperMarkSettledHandler from '../_handlers/cre/keeper/_markSettled.ts'

describe('/api/cre/keeper/mark-settled — audit §5.1 invariant 5 gate', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-keepr-key',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  const VAULT = '0x' + '1'.repeat(40)
  const NOW_ISO = new Date().toISOString()
  const AUTH = { authorization: 'Bearer test-keepr-key' }

  async function postBody(body: Record<string, unknown>) {
    const req = createMockReq({ method: 'POST', headers: AUTH, body })
    const res = createMockRes()
    await creKeeperMarkSettledHandler(req, res)
    return res
  }

  it('accepts graduatedAt-only without any settledAt gate check', async () => {
    const res = await postBody({ vaultAddress: VAULT, graduatedAt: NOW_ISO })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('accepts settlementStage-only (pending state) without requiring settledAt', async () => {
    const res = await postBody({
      vaultAddress: VAULT,
      settlementStage: 'awaiting_owner_hook_config',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('accepts settledAt paired with settlementStage="completed"', async () => {
    const res = await postBody({
      vaultAddress: VAULT,
      settledAt: NOW_ISO,
      settlementStage: 'completed',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('rejects settledAt without any settlementStage', async () => {
    const res = await postBody({ vaultAddress: VAULT, settledAt: NOW_ISO })
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('settlementStage="completed"')
  })

  it('rejects settledAt paired with a non-completed settlementStage', async () => {
    const res = await postBody({
      vaultAddress: VAULT,
      settledAt: NOW_ISO,
      settlementStage: 'in_progress',
    })
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('settlementStage="completed"')
  })

  it('rejects settledAt with a malformed timestamp', async () => {
    const res = await postBody({
      vaultAddress: VAULT,
      settledAt: 'not-a-timestamp',
      settlementStage: 'completed',
    })
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('ISO-8601')
  })

  it('rejects settledAt in the future (beyond clock skew tolerance)', async () => {
    const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const res = await postBody({
      vaultAddress: VAULT,
      settledAt: farFuture,
      settlementStage: 'completed',
    })
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('future')
  })

  it('tolerates small clock skew (<5 minutes)', async () => {
    const nearFuture = new Date(Date.now() + 2 * 60 * 1000).toISOString()
    const res = await postBody({
      vaultAddress: VAULT,
      settledAt: nearFuture,
      settlementStage: 'completed',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('rejects when body has none of graduatedAt, settledAt, settlementStage', async () => {
    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(400)
  })
})
