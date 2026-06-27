import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbSqlMock, getDbMock, runInTransactionMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [] as any[],
    rowCount: 0,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  runInTransactionMock: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => {
    const db = await getDbMock()
    return fn(db)
  }),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@4626/server-core')
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    getDb: getDbMock,
    isDbConfigured: () => true,
    runInTransaction: runInTransactionMock,
  }
})

vi.mock('../../server/_lib/infra/telemetrySampling.js', () => ({
  shouldSampleEvent: () => true,
}))

import {
  beginOperationExecution,
  ControlPlaneOperationError,
  transitionOperationStatus,
} from '../../server/_lib/controlPlane/operations.js'

describe('transitionOperationStatus atomic updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws transition_race when update affects zero rows', async () => {
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ status: 'running', policy_version: 'cpol_test' }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await expect(
      transitionOperationStatus({
        operationId: 'op_1',
        nextStatus: 'succeeded',
        reason: 'test_complete',
      }),
    ).rejects.toMatchObject({ code: 'transition_race' })
  })

  it('allows only one concurrent transition to win', async () => {
    dbSqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ')
      if (query.includes('SELECT status')) {
        return { rows: [{ status: 'running', policy_version: 'cpol_test' }] }
      }
      if (query.includes('UPDATE public.control_plane_operations')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    })

    const results = await Promise.allSettled([
      transitionOperationStatus({
        operationId: 'op_race',
        nextStatus: 'succeeded',
        reason: 'winner',
      }),
      transitionOperationStatus({
        operationId: 'op_race',
        nextStatus: 'failed',
        reason: 'loser',
      }),
    ])

    const races = results.filter(
      (result) => result.status === 'rejected' && (result.reason as { code?: string })?.code === 'transition_race',
    )
    expect(races.length).toBeGreaterThanOrEqual(1)
  })

  it('writes status update and timeline event inside one transaction', async () => {
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ status: 'running', policy_version: 'cpol_test' }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await transitionOperationStatus({
      operationId: 'op_tx',
      nextStatus: 'succeeded',
      reason: 'test_complete',
    })

    expect(runInTransactionMock).toHaveBeenCalledTimes(1)
    expect(dbSqlMock).toHaveBeenCalledTimes(3)
  })
})

describe('beginOperationExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resumes a terminal failed operation through retrying before running', async () => {
    dbSqlMock
      .mockResolvedValueOnce({
        rows: [{ status: 'failed', policy_version: 'cpol_test' }],
      })
      .mockResolvedValueOnce({
        rows: [{ status: 'failed', policy_version: 'cpol_test' }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ status: 'retrying', policy_version: 'cpol_test' }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const result = await beginOperationExecution({
      operationId: 'op_failed_retry',
      reason: 'solana_reconcile_started',
      actor: 'keeper',
    })

    expect(result).toEqual({ status: 'running', resumedFromTerminal: true })
    expect(runInTransactionMock).toHaveBeenCalledTimes(2)
  })

  it('does not transition when the operation already succeeded', async () => {
    dbSqlMock.mockResolvedValueOnce({
      rows: [{ status: 'succeeded', policy_version: 'cpol_test' }],
    })

    const result = await beginOperationExecution({
      operationId: 'op_done',
      reason: 'solana_reconcile_started',
      actor: 'keeper',
    })

    expect(result).toEqual({ status: 'succeeded', resumedFromTerminal: false })
    expect(runInTransactionMock).not.toHaveBeenCalled()
  })
})
