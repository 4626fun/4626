import { beforeEach, describe, expect, it, vi } from 'vitest'

const VAULT = '0x9999999999999999999999999999999999999999'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createActivityEvent: vi.fn(),
  createTaskItem: vi.fn(),
  createAlertEvent: vi.fn(),
  updateTaskItem: vi.fn(),
  createApprovalRequest: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/_lib/workspace/repository.js', () => ({
  createActivityEvent: mocks.createActivityEvent,
  createTaskItem: mocks.createTaskItem,
  createAlertEvent: mocks.createAlertEvent,
  updateTaskItem: mocks.updateTaskItem,
  createApprovalRequest: mocks.createApprovalRequest,
}))

describe('workspace normalizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createActivityEvent.mockResolvedValue({ id: 1 })
    mocks.createTaskItem.mockResolvedValue({
      id: 2,
      description: 'task',
    })
    mocks.createAlertEvent.mockResolvedValue({ id: 3 })
    mocks.updateTaskItem.mockResolvedValue({ id: 2 })
    mocks.createApprovalRequest.mockResolvedValue({ id: 4 })
  })

  it('creates task and alert for warning runtime records', async () => {
    const mod = await import('../../server/_lib/workspace/normalizer.ts')
    const result = await mod.normalizeRuntimeRecordForWorkspace({
      record: {
        id: 11,
        workflow: 'runtime-orchestrator',
        kind: 'worker_fail',
        idempotencyKey: 'abc',
        payload: {
          vaultAddress: VAULT,
          status: 'failed',
          message: 'worker failed',
        },
        source: 'cre',
        correlationId: null,
        createdAt: new Date().toISOString(),
      },
    })

    expect(result.created).toBe(true)
    expect(result.vaultAddress).toBe(VAULT)
    expect(mocks.createTaskItem).toHaveBeenCalled()
    expect(mocks.createAlertEvent).toHaveBeenCalled()
  })

  it('creates approval workflow when decision requires approval', async () => {
    const mod = await import('../../server/_lib/workspace/normalizer.ts')
    const result = await mod.normalizeRuntimeDecisionForWorkspace({
      decision: {
        id: 22,
        workflow: 'runtime-orchestrator',
        idempotencyKey: 'decision-1',
        decision: {
          vaultAddress: VAULT,
          requiresApproval: true,
          actionType: 'strategy.owner.emergencyUnwind',
          reason: 'drawdown threshold exceeded',
        },
        status: 'stored',
        correlationId: null,
        createdAt: new Date().toISOString(),
      },
      actionId: undefined,
      enqueueAction: null,
    })

    expect(result.created).toBe(true)
    expect(result.vaultAddress).toBe(VAULT)
    expect(result.approvalId).toBe(4)
    expect(mocks.createApprovalRequest).toHaveBeenCalled()
  })

  it('creates alert/task for failed keepr action status', async () => {
    mocks.getDb.mockResolvedValue({
      sql: vi.fn(async () => ({
        rows: [
          {
            id: 45,
            vault_address: VAULT,
            action_type: 'strategy.charm.rebalance',
            action: { action: 'strategy.charm.rebalance', params: {} },
            status: 'failed',
            attempt_count: 2,
            next_attempt_at: null,
          },
        ],
      })),
    })

    const mod = await import('../../server/_lib/workspace/normalizer.ts')
    const result = await mod.normalizeKeeprActionStatusForWorkspace({
      actionId: 45,
      status: 'failed',
      errorMessage: 'rpc timeout',
    })

    expect(result.created).toBe(true)
    expect(result.vaultAddress).toBe(VAULT)
    expect(mocks.createTaskItem).toHaveBeenCalled()
    expect(mocks.createAlertEvent).toHaveBeenCalled()
  })
})
