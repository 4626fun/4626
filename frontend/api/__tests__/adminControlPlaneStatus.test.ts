import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { dbSqlMock, getDbMock, getSessionAddressMock, isAdminAddressMock, getVaultLifecycleStatusMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [] as any[],
    rowCount: 0,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  getSessionAddressMock: vi.fn<() => string | null>(() => '0x00000000000000000000000000000000000000aa'),
  isAdminAddressMock: vi.fn(() => true),
  getVaultLifecycleStatusMock: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
}))

vi.mock('../../server/_lib/controlPlane/vaultControlPlane.js', () => ({
  createVaultControlPlane: () => ({
    getVaultLifecycleStatus: getVaultLifecycleStatusMock,
  }),
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../packages/server-core/src/index.js')
  return {
    ...actual,
    getDb: getDbMock,
    getSessionAddress: getSessionAddressMock,
    isAdminAddress: isAdminAddressMock,
  }
})

import { getApiHandler } from '../_handlers/_routes.js'
import handler from '../_handlers/admin/control-plane/_status.ts'

describe('/api/admin/control-plane/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    isAdminAddressMock.mockReturnValue(true)
  })

  it('is registered in route map', async () => {
    await expect(getApiHandler('admin/control-plane/status')).resolves.toBeTypeOf('function')
  })

  it('requires signed-in admin', async () => {
    getSessionAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns aggregate counts and stuck operations', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [{ status: 'running', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ status: 'queued', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ status: 'claimed', count: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_123',
            operation_kind: 'vault.provision',
            status: 'running',
            scope_type: 'vault',
            scope_id: '0x1111111111111111111111111111111111111111',
            updated_at: '2026-05-18T16:00:00.000Z',
            age_minutes: 90,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_123',
            stage_id: 'stage_1',
            event_type: 'stage.status_transition',
            message: 'keeper_job_failed',
            created_at: '2026-05-18T16:10:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_pay_1',
            operation_kind: 'payment.activation',
            status: 'succeeded',
            scope_type: 'payment',
            scope_id: 'pay_1',
            created_at: '2026-05-18T15:00:00.000Z',
            updated_at: '2026-05-18T15:05:00.000Z',
          },
        ],
      })

    const req = createMockReq({ method: 'GET', query: { stuckMinutes: '15', limit: '10' } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.admin).toBe('0x00000000000000000000000000000000000000aa')
    expect(res.body?.data?.operationCounts?.running).toBe(2)
    expect(res.body?.data?.stuck?.thresholdMinutes).toBe(15)
    expect(res.body?.data?.stuck?.operations?.[0]?.operationId).toBe('op_123')
    expect(res.body?.data?.recentOperations?.[0]?.operationKind).toBe('payment.activation')
  })

  it('filters stuck and recent operations by operationKind', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_pay_stuck',
            operation_kind: 'payment.activation',
            status: 'running',
            scope_type: 'payment',
            scope_id: 'pay_2',
            updated_at: '2026-05-18T16:00:00.000Z',
            age_minutes: 120,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_pay_recent',
            operation_kind: 'payment.activation',
            status: 'queued',
            scope_type: 'payment',
            scope_id: 'pay_3',
            created_at: '2026-05-18T17:00:00.000Z',
            updated_at: '2026-05-18T17:00:00.000Z',
          },
        ],
      })

    const req = createMockReq({
      method: 'GET',
      query: { operationKind: 'payment.activation', limit: '5' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.stuck?.operations?.[0]?.operationId).toBe('op_pay_stuck')
    expect(res.body?.data?.recentOperations?.[0]?.operationId).toBe('op_pay_recent')
  })

  it('includes vault lifecycle when vaultAddress query is valid', async () => {
    getVaultLifecycleStatusMock.mockResolvedValueOnce({
      vaultAddress: '0x1111111111111111111111111111111111111111',
      graduatedAt: '2026-05-18T10:00:00.000Z',
      settledAt: null,
      settlementStage: 'awaiting_owner_hook_config',
      settlementStageUpdatedAt: '2026-05-18T11:00:00.000Z',
      freshness: 'stale',
      lastUpdatedAt: '2026-05-18T11:00:00.000Z',
      degradationMode: 'allow_stale_read',
      warning: 'lifecycle_data_stale:120m',
    })

    dbSqlMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const req = createMockReq({
      method: 'GET',
      query: { vaultAddress: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getVaultLifecycleStatusMock).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
    expect(res.body?.data?.vaultLifecycle?.freshness).toBe('stale')
    expect(res.body?.data?.vaultLifecycle?.warning).toContain('lifecycle_data_stale')
  })
})

