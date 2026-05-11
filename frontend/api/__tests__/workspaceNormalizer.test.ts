import { beforeEach, describe, expect, it, vi } from 'vitest'

const VAULT = '0x9999999999999999999999999999999999999999'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createActivityEvent: vi.fn(),
  createTaskItem: vi.fn(),
  createAlertEvent: vi.fn(),
  updateTaskItem: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/_lib/workspace/repository.js', () => ({
  createActivityEvent: mocks.createActivityEvent,
  createTaskItem: mocks.createTaskItem,
  createAlertEvent: mocks.createAlertEvent,
  updateTaskItem: mocks.updateTaskItem,
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
