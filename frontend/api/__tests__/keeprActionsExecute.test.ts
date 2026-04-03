import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import handler from '../_handlers/keepr/actions/_execute.ts'

const { executeKeeprActionMock } = vi.hoisted(() => ({
  executeKeeprActionMock: vi.fn(),
}))

vi.mock('../../server/keepr/xmtpQueueExecutor.js', () => ({
  executeKeeprAction: executeKeeprActionMock,
}))

describe('keepr/actions/execute', () => {
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
    expect(executeKeeprActionMock).not.toHaveBeenCalled()
  })

  it('rejects invalid payloads as non-retryable', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: { id: 0, vaultAddress: 'bad', groupId: '' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(executeKeeprActionMock).not.toHaveBeenCalled()
  })

  it('executes canonical add_member payload successfully', async () => {
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'xmtp.group.add_member',
      details: { wallet: '0x00000000000000000000000000000000000000aa' },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        id: 42,
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'xmtp.group.add_member',
        action: {
          action: 'xmtp.group.add_member',
          walletAddress: '0x00000000000000000000000000000000000000aa',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.trustZone).toBe('queue_messaging_monitoring')
    expect(executeKeeprActionMock).toHaveBeenCalledWith({
      id: 42,
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-1',
      actionType: 'xmtp.group.add_member',
      action: {
        action: 'xmtp.group.add_member',
        walletAddress: '0x00000000000000000000000000000000000000aa',
      },
    })
  })

  it('accepts legacy alias payload shape', async () => {
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'xmtp.group.add_member',
      details: {},
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        id: 7,
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-legacy',
        actionType: 'addMember',
        action: {
          action: 'addMember',
          wallet: '0x00000000000000000000000000000000000000aa',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.executed).toBe(true)
    expect(executeKeeprActionMock).toHaveBeenCalled()
  })

  it('executes nested Ajna rebucket action payload successfully', async () => {
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'strategy.ajna.rebucket',
      details: { txHash: '0xabc' },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        id: 11,
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-strategy',
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1200,
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.executed).toBe(true)
    expect(res.body?.data?.trustZone).toBe('financial_execution')
    expect(executeKeeprActionMock).toHaveBeenCalledWith({
      id: 11,
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-strategy',
      actionType: 'strategy.ajna.rebucket',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: '0x00000000000000000000000000000000000000cc',
        targetBucket: 1200,
      },
    })
  })

  it('returns 400 for non-retryable execution failures', async () => {
    executeKeeprActionMock.mockResolvedValue({
      success: false,
      retryable: false,
      actionType: 'xmtp.group.add_member',
      error: 'creator_agent_not_configured',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        id: 9,
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-2',
        action: { action: 'xmtp.group.add_member', wallet: '0x00000000000000000000000000000000000000aa' },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.data?.retryable).toBe(false)
  })

  it('returns 503 for retryable execution failures', async () => {
    executeKeeprActionMock.mockResolvedValue({
      success: false,
      retryable: true,
      actionType: 'xmtp.group.send_message',
      error: 'xmtp_network_timeout',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        id: 10,
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-3',
        action: { action: 'xmtp.group.send_message', message: 'hello' },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.data?.retryable).toBe(true)
  })

  it('enforces optional trust-zone key when configured', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING: 'zone-queue-secret',
    })
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'xmtp.group.add_member',
      details: {},
    })

    try {
      const unauthorizedReq = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          id: 99,
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-zone',
          actionType: 'xmtp.group.add_member',
          action: { action: 'xmtp.group.add_member', wallet: '0x00000000000000000000000000000000000000aa' },
        },
      })
      const unauthorizedRes = createMockRes()
      await handler(unauthorizedReq, unauthorizedRes)
      expect(unauthorizedRes.statusCode).toBe(401)
      expect(executeKeeprActionMock).not.toHaveBeenCalled()

      const authorizedReq = createMockReq({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-keepr-key',
          'x-keepr-zone-key': 'zone-queue-secret',
        },
        body: {
          id: 99,
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-zone',
          actionType: 'xmtp.group.add_member',
          action: { action: 'xmtp.group.add_member', wallet: '0x00000000000000000000000000000000000000aa' },
        },
      })
      const authorizedRes = createMockRes()
      await handler(authorizedReq, authorizedRes)
      expect(authorizedRes.statusCode).toBe(200)
      expect(authorizedRes.body?.data?.trustZone).toBe('queue_messaging_monitoring')
      expect(executeKeeprActionMock).toHaveBeenCalledTimes(1)
    } finally {
      restoreZoneEnv()
    }
  })

  it('derives trust zone from the effective action payload, not only the raw actionType field', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_KEY_FINANCIAL_EXECUTION: 'zone-financial-secret',
    })
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'strategy.ajna.rebucket',
      details: {},
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          id: 11,
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-strategy',
          actionType: 'monitor.healthcheck',
          action: {
            action: 'strategy.ajna.rebucket',
            authAddress: '0x00000000000000000000000000000000000000cc',
            targetBucket: 1200,
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(executeKeeprActionMock).not.toHaveBeenCalled()
    } finally {
      restoreZoneEnv()
    }
  })

  it('blocks execution when the resolved trust zone is kill-switched', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION: 'true',
    })
    executeKeeprActionMock.mockResolvedValue({
      success: true,
      retryable: false,
      actionType: 'strategy.ajna.rebucket',
      details: {},
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          id: 11,
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-strategy',
          actionType: 'strategy.ajna.rebucket',
          action: {
            action: 'strategy.ajna.rebucket',
            authAddress: '0x00000000000000000000000000000000000000cc',
            targetBucket: 1200,
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body?.success).toBe(false)
      expect(String(res.body?.error ?? '')).toContain('Trust zone')
      expect(executeKeeprActionMock).not.toHaveBeenCalled()
    } finally {
      restoreZoneEnv()
    }
  })
})

