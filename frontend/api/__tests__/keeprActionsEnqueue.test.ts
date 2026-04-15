import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import handler from '../_handlers/keepr/actions/_enqueue.ts'

function buildAutomationRow(overrides: Record<string, unknown> = {}) {
  return {
    vaultAddress: '0x00000000000000000000000000000000000000bb',
    profileId: 42,
    canonicalCswAddress: '0x00000000000000000000000000000000000000cc',
    embeddedEoaAddress: '0x00000000000000000000000000000000000000dd',
    privyWalletId: 'wallet-ajna-owner',
    authorizationSource: 'owner_session',
    automationEnabled: true,
    automationScope: 'ajna_min_bucket_only',
    lastOwnerCheckAt: '2026-03-10T11:00:00.000Z',
    revokedAt: null,
    metadata: {},
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T11:00:00.000Z',
    ...overrides,
  }
}

const {
  enqueueKeeprActionMock,
  getKeeprVaultAutomationByVaultAddressMock,
  getDbMock,
  isDbConfiguredMock,
} = vi.hoisted(() => ({
  enqueueKeeprActionMock: vi.fn(),
  getKeeprVaultAutomationByVaultAddressMock: vi.fn(),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  enqueueKeeprAction: enqueueKeeprActionMock,
}))

vi.mock('../../server/_lib/keeprAutomation.js', () => ({
  getKeeprVaultAutomationByVaultAddress: getKeeprVaultAutomationByVaultAddressMock,
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

describe('keepr/actions/enqueue', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ KEEPR_API_KEY: 'test-keepr-key' })
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValue(buildAutomationRow())
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    isDbConfiguredMock.mockReturnValue(true)
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

  it.each([
    'strategy.ajna.rebucket',
    'ajna_rebucket',
    'ajnaRebucket',
  ])('rejects Ajna actions when canonical automation context is missing for %s', async (actionType) => {
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValueOnce(null)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType,
        action: {
          action: actionType,
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Ajna automation is not enabled for this vault')
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it('returns availability error when automation lookup is null because the DB handle is unavailable', async () => {
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValueOnce(null)
    getDbMock.mockResolvedValueOnce(null)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Ajna automation backend unavailable')
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it('rejects Ajna actions when the embedded signer context is missing', async () => {
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValueOnce(
      buildAutomationRow({ embeddedEoaAddress: null }),
    )

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Ajna automation is not enabled for this vault')
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['canonical CSW', buildAutomationRow({ canonicalCswAddress: 'not-an-address' })],
    ['embedded EOA', buildAutomationRow({ embeddedEoaAddress: 'not-an-address' })],
  ])('rejects Ajna actions when the stored %s address is malformed', async (_label, row) => {
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValueOnce(row)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Ajna automation is not enabled for this vault')
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['disabled', buildAutomationRow({ automationEnabled: false }), 'Ajna automation is disabled for this vault'],
    ['revoked', buildAutomationRow({ revokedAt: '2026-03-10T12:00:00.000Z' }), 'Ajna automation is disabled for this vault'],
    ['wrong scope', buildAutomationRow({ automationScope: 'vault' }), 'Ajna automation scope is invalid for this vault'],
  ])('rejects Ajna actions when automation context is %s', async (_label, row, expectedError) => {
    getKeeprVaultAutomationByVaultAddressMock.mockResolvedValueOnce(row)

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe(expectedError)
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })

  it('enqueues a valid nested Ajna rebucket action', async () => {
    enqueueKeeprActionMock.mockResolvedValue({ id: 42 })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x00000000000000000000000000000000000000bb',
        groupId: 'group-1',
        actionType: 'strategy.ajna.rebucket',
        dedupeKey: 'vault:0x...:auth:0x...:action:strategy.ajna.rebucket:band:1234',
        action: {
          action: 'strategy.ajna.rebucket',
          authAddress: '0x00000000000000000000000000000000000000cc',
          targetBucket: 1234,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.id).toBe(42)
    expect(res.body?.data?.trustZone).toBe('financial_execution')
    expect(getKeeprVaultAutomationByVaultAddressMock).toHaveBeenCalledWith(
      '0x00000000000000000000000000000000000000bb',
    )
    expect(enqueueKeeprActionMock).toHaveBeenCalledWith({
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-1',
      actionType: 'strategy.ajna.rebucket',
      dedupeKey: 'vault:0x...:auth:0x...:action:strategy.ajna.rebucket:band:1234',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: '0x00000000000000000000000000000000000000cc',
        targetBucket: 1234,
      },
    })
  })

  it('enforces optional zone keys when configured', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING: 'zone-queue-secret',
    })
    enqueueKeeprActionMock.mockResolvedValue({ id: 77 })

    try {
      const unauthorizedReq = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-zone',
          actionType: 'xmtp.group.add_member',
          action: { action: 'xmtp.group.add_member', wallet: '0x00000000000000000000000000000000000000aa' },
        },
      })
      const unauthorizedRes = createMockRes()
      await handler(unauthorizedReq, unauthorizedRes)
      expect(unauthorizedRes.statusCode).toBe(401)
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()

      const authorizedReq = createMockReq({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-keepr-key',
          'x-keepr-zone-key': 'zone-queue-secret',
        },
        body: {
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
      expect(enqueueKeeprActionMock).toHaveBeenCalledTimes(1)
    } finally {
      restoreZoneEnv()
    }
  })

  it('derives trust zone from the effective action payload, not only the raw actionType field', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_KEY_FINANCIAL_EXECUTION: 'zone-financial-secret',
    })
    enqueueKeeprActionMock.mockResolvedValue({ id: 88 })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-1',
          actionType: 'monitor.healthcheck',
          action: {
            action: 'strategy.ajna.rebucket',
            authAddress: '0x00000000000000000000000000000000000000cc',
            targetBucket: 1234,
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    } finally {
      restoreZoneEnv()
    }
  })

  it('blocks writes when the resolved trust zone is kill-switched', async () => {
    const restoreZoneEnv = applyEnv({
      KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION: 'true',
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-keepr-key' },
        body: {
          vaultAddress: '0x00000000000000000000000000000000000000bb',
          groupId: 'group-1',
          actionType: 'strategy.ajna.rebucket',
          action: {
            action: 'strategy.ajna.rebucket',
            authAddress: '0x00000000000000000000000000000000000000cc',
            targetBucket: 1234,
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body?.success).toBe(false)
      expect(String(res.body?.error ?? '')).toContain('Trust zone')
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    } finally {
      restoreZoneEnv()
    }
  })
})

