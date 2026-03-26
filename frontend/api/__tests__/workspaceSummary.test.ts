import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const VAULT = '0x5555555555555555555555555555555555555555'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  requireWorkspacePermission: vi.fn(),
  resolveWorkspaceSummary: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/workspace/auth.js', () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
}))

vi.mock('../../server/_lib/workspace/service.js', () => ({
  resolveWorkspaceSummary: mocks.resolveWorkspaceSummary,
}))

describe('workspace summary handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.requireWorkspacePermission.mockResolvedValue({
      ok: true,
      role: 'OWNER',
      principalAddress: '0x9999999999999999999999999999999999999999',
      vault: {
        groupId: 'group-1',
      },
      profileId: null,
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: null,
      signerRole: null,
    })
    mocks.resolveWorkspaceSummary.mockResolvedValue({
      vaultAddress: VAULT,
      groupId: 'group-1',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      creatorCoinAddress: '0x2222222222222222222222222222222222222222',
      settlement: { graduatedAt: null, settledAt: null, settlementStage: null },
      metrics: {
        strategyCount: 2,
        activeStrategyCount: 2,
        configuredTargetCount: 2,
        openAlerts: 1,
        pendingTasks: 3,
        pendingApprovals: 1,
      },
      rooms: {
        telegram: {
          linked: true,
          chatId: '-100123',
          roomChatId: '-100456',
          enabled: true,
          memberCount: 24,
        },
        xmtp: {
          linked: true,
          agentAddress: '0x3333333333333333333333333333333333333333',
          agentType: 'eoa',
          conversationId: 'group-1',
        },
      },
      latestAlerts: [],
      latestActivity: [],
      automation: {
        enabled: true,
        scope: 'vault',
        canonicalCswAddress: null,
        embeddedEoaAddress: null,
      },
      generatedAt: new Date().toISOString(),
    })
  })

  it('registers static and dynamic workspace summary routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    await expect(getV1ApiHandler('workspace/summary')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`workspace/${VAULT}/summary`)).resolves.toBeTypeOf('function')
  })

  it('returns 400 when vault is missing', async () => {
    const mod = await import('../_handlers/v1/workspace/_summary.ts')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await mod.default(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('returns workspace summary payload', async () => {
    const mod = await import('../_handlers/v1/workspace/_summary.ts')
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()

    await mod.default(req, res)

    expect(mocks.requireWorkspacePermission).toHaveBeenCalled()
    expect(mocks.resolveWorkspaceSummary).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.vaultAddress).toBe(VAULT)
    expect(res.body?.data?.actorRole).toBe('OWNER')
  })
})
