import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbSqlMock, getDbMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [] as any[],
    rowCount: 0,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@4626/server-core')
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    getDb: getDbMock,
    isDbConfigured: () => true,
    runInTransaction: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => fn(await getDbMock())),
  }
})

vi.mock('../../server/_lib/infra/telemetrySampling.js', () => ({
  shouldSampleEvent: () => true,
}))

import { startControlPlaneOperation } from '../../server/_lib/controlPlane/operations.js'

describe('startControlPlaneOperation schema readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns persisted false for missing-table errors without treating check constraints as missing schema', async () => {
    dbSqlMock.mockRejectedValueOnce(
      new Error(
        'new row for relation "control_plane_operations" violates check constraint "control_plane_operations_status_check"',
      ),
    )

    const result = await startControlPlaneOperation({
      operationKind: 'solana.reconcile',
      scopeType: 'solana_route',
      scopeId: 'workflow:checkpoint',
      idempotencyKey: 'workflow:checkpoint',
      input: { workflow: 'workflow', checkpointKey: 'checkpoint' },
    })

    expect(result.persisted).toBe(false)
    expect(result.reused).toBe(false)
  })

  it('returns persisted false when insert succeeds but operation row is not readable', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    const result = await startControlPlaneOperation({
      operationKind: 'solana.reconcile',
      scopeType: 'solana_route',
      scopeId: 'workflow:checkpoint',
      input: { workflow: 'workflow', checkpointKey: 'checkpoint' },
    })

    expect(result.persisted).toBe(false)
  })

  it('reuses idempotency only when the prior operation row still exists', async () => {
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ operation_id: 'op_existing', input_hash: null }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ operation_id: 'op_new' }], rowCount: 1 })

    const result = await startControlPlaneOperation({
      operationKind: 'solana.reconcile',
      scopeType: 'solana_route',
      scopeId: 'workflow:checkpoint',
      idempotencyKey: 'workflow:checkpoint',
      input: { workflow: 'workflow', checkpointKey: 'checkpoint' },
    })

    expect(result.persisted).toBe(true)
    expect(result.reused).toBe(false)
    expect(result.operationId).toMatch(/^solana\.reconcile_/)
  })
})
