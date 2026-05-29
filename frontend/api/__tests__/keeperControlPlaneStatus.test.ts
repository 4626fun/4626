import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEnv, createMockReq, createMockRes } from './helpers'

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
  const actual = await vi.importActual<Record<string, unknown>>('../../@4626/server-core')
  return {
    ...actual,
    getDb: getDbMock,
  }
})

import { getApiHandler } from '../_handlers/_routes.js'
import handler from '../_handlers/keeper/_controlPlaneStatus.ts'

describe('/api/keeper/control-plane/status', () => {
  const API_KEY = 'kpr-control-plane-status-key'
  const AUTH = { authorization: `Bearer ${API_KEY}` }

  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({ KPR_API_KEY: API_KEY })
  })

  it('is registered in route map', async () => {
    await expect(getApiHandler('keeper/control-plane/status')).resolves.toBeTypeOf('function')
  })

  it('requires machine auth', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns aggregate counts and stuck operations', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [{ status: 'running', count: 2 }, { status: 'failed', count: 1 }] })
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

    const req = createMockReq({
      method: 'GET',
      headers: AUTH,
      query: { stuckMinutes: '15', limit: '10' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.operationCounts?.running).toBe(2)
    expect(res.body?.data?.stuck?.thresholdMinutes).toBe(15)
    expect(res.body?.data?.stuck?.operations?.[0]?.operationId).toBe('op_123')
    expect(res.body?.data?.recentFailures?.[0]?.eventType).toBe('stage.status_transition')
  })
})

