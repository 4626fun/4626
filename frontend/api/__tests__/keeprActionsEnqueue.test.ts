import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import handler from '../_handlers/keepr/actions/_enqueue.ts'

const { enqueueKeeprActionMock } = vi.hoisted(() => ({
  enqueueKeeprActionMock: vi.fn(),
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  enqueueKeeprAction: enqueueKeeprActionMock,
}))

describe('keepr/actions/enqueue', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ KEEPR_API_KEY: 'test-keepr-key' })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('rejects unauthorized requests', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it('rejects invalid payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: 'bad',
        groupId: '',
        actionType: '',
        action: null,
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it('enqueues a valid deduped action', async () => {
    enqueueKeeprActionMock.mockResolvedValue({ id: 42 })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        dedupeKey: 'vault:0x...:strategy:0x...:action:strategy.ajna.rebucket:band:1234',
        action: {
          action: 'strategy.ajna.rebucket',
          strategyAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.id).toBe(42)
    expect(enqueueKeeprActionMock).toHaveBeenCalledWith({
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-1',
      actionType: 'strategy.ajna.rebucket',
      dedupeKey: 'vault:0x...:strategy:0x...:action:strategy.ajna.rebucket:band:1234',
      action: {
        action: 'strategy.ajna.rebucket',
        strategyAddress: '0x00000000000000000000000000000000000000cc',
        targetBucket: 1234,
      },
    })
  })
})

