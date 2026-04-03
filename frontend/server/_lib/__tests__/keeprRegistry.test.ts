import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureKeeprSchemaMock, getDbMock, sqlMock } = vi.hoisted(() => ({
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
  sqlMock: vi.fn(),
}))

vi.mock('../keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../postgres.js', () => ({
  getDb: getDbMock,
}))

import { enqueueKeeprAction } from '../keeprRegistry.js'

describe('keeprRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlMock.mockResolvedValue({ rows: [{ id: 42 }] })
    getDbMock.mockResolvedValue({ sql: sqlMock })
  })

  it('stores the effective action type when the nested action payload is more specific', async () => {
    await enqueueKeeprAction({
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-1',
      actionType: 'monitor.healthcheck',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: '0x00000000000000000000000000000000000000cc',
        targetBucket: 1200,
      },
    })

    expect(sqlMock).toHaveBeenCalled()
    expect(sqlMock.mock.calls[0]?.[3]).toBe('strategy.ajna.rebucket')
  })
})
