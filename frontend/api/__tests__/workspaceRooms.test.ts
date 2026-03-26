import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const VAULT = '0x8888888888888888888888888888888888888888'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  requireWorkspacePermission: vi.fn(),
  resolveWorkspaceRooms: vi.fn(),
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
  resolveWorkspaceRooms: mocks.resolveWorkspaceRooms,
}))

describe('workspace rooms handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.requireWorkspacePermission.mockResolvedValue({
      ok: true,
      role: 'ADMIN',
      principalAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vault: {
        groupId: 'group-rooms',
      },
      profileId: null,
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: null,
      signerRole: null,
    })
    mocks.resolveWorkspaceRooms.mockResolvedValue({
      telegram: {
        linked: true,
        chatId: '-100123',
        roomChatId: '-100456',
        enabled: true,
        minSharesRaw: '1',
        graceHours: 24,
        memberCount: 12,
        recentSummaries: [],
      },
      xmtp: {
        linked: true,
        agentAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        agentType: 'eoa',
        conversationId: 'group-rooms',
        recentMessages: [],
      },
      generatedAt: new Date().toISOString(),
    })
  })

  it('returns rooms payload', async () => {
    const mod = await import('../_handlers/v1/workspace/_rooms.ts')
    const req = createMockReq({
      method: 'GET',
      query: { vault: VAULT },
    })
    const res = createMockRes()
    await mod.default(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.telegram?.linked).toBe(true)
    expect(res.body?.data?.xmtp?.linked).toBe(true)
    expect(res.body?.data?.actorRole).toBe('ADMIN')
  })
})
