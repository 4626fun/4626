import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { dbSqlMock, getDbMock, getSessionAddressMock, isAdminAddressMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [] as any[],
    rowCount: 0,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  getSessionAddressMock: vi.fn<() => string | null>(() => '0x00000000000000000000000000000000000000aa'),
  isAdminAddressMock: vi.fn(() => true),
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

    const req = createMockReq({ method: 'GET', query: { stuckMinutes: '15', limit: '10' } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.admin).toBe('0x00000000000000000000000000000000000000aa')
    expect(res.body?.data?.operationCounts?.running).toBe(2)
    expect(res.body?.data?.stuck?.thresholdMinutes).toBe(15)
    expect(res.body?.data?.stuck?.operations?.[0]?.operationId).toBe('op_123')
  })
})

