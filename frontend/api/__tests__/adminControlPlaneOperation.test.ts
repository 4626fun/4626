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
  getSessionAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
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
import handler from '../_handlers/admin/control-plane/_operation.ts'

describe('/api/admin/control-plane/operation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    isAdminAddressMock.mockReturnValue(true)
  })

  it('is registered in route map', async () => {
    await expect(getApiHandler('admin/control-plane/operation')).resolves.toBeTypeOf('function')
  })

  it('requires operationId query param', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns operation detail payload', async () => {
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            operation_id: 'op_123',
            operation_kind: 'vault.provision',
            status: 'running',
            scope_type: 'vault',
            scope_id: '0x1111111111111111111111111111111111111111',
            lock_scope: 'vault',
            lock_key: '0x1111111111111111111111111111111111111111',
            idempotency_key: 'idem-1',
            policy_version: 'v1',
            schema_version: 'v1',
            requested_by: 'system',
            error_code: null,
            error_message: null,
            input_json: { hello: 'world' },
            result_json: null,
            created_at: '2026-05-18T16:00:00.000Z',
            updated_at: '2026-05-18T16:01:00.000Z',
            finished_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            stage_id: 'stg_1',
            stage_kind: 'vault.queue',
            status: 'running',
            attempt_count: 1,
            error_code: null,
            error_message: null,
            input_json: {},
            result_json: null,
            started_at: '2026-05-18T16:00:20.000Z',
            finished_at: null,
            created_at: '2026-05-18T16:00:20.000Z',
            updated_at: '2026-05-18T16:01:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_type: 'stage.status_transition',
            stage_id: 'stg_1',
            message: 'running',
            data_json: { attempt: 1 },
            created_at: '2026-05-18T16:00:20.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 42,
            stage_id: 'stg_1',
            kind: 'internal_api',
            status: 'claimed',
            attempt_count: 1,
            max_attempts: 5,
            dedupe_key: 'keeper:1',
            source: 'system',
            last_error: null,
            created_at: '2026-05-18T16:00:15.000Z',
            updated_at: '2026-05-18T16:00:45.000Z',
            run_at: '2026-05-18T16:00:15.000Z',
            claimed_by: 'worker-a',
            claim_expires_at: '2026-05-18T16:05:45.000Z',
          },
        ],
      })

    const req = createMockReq({
      method: 'GET',
      query: { operationId: 'op_123', eventsLimit: '10', jobsLimit: '10' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.operation?.operationId).toBe('op_123')
    expect(res.body?.data?.stages?.[0]?.stageId).toBe('stg_1')
    expect(res.body?.data?.events?.[0]?.eventType).toBe('stage.status_transition')
    expect(res.body?.data?.jobs?.[0]?.id).toBe(42)
  })
})

