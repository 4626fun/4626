import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const VAULT = '0x7777777777777777777777777777777777777777'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  requireWorkspacePermission: vi.fn(),
  resolveWorkspaceTasks: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    workspaceRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

vi.mock('../../server/_lib/workspace/auth.js', () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
}))

vi.mock('../../server/_lib/workspace/service.js', () => ({
  resolveWorkspaceTasks: mocks.resolveWorkspaceTasks,
}))

describe('workspace tasks handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    mocks.requireWorkspacePermission.mockResolvedValue({
      ok: true,
      role: 'OPERATOR',
      principalAddress: '0x9999999999999999999999999999999999999999',
      vault: {
        groupId: 'group-1',
      },
      profileId: null,
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: null,
      signerRole: null,
    })
    mocks.resolveWorkspaceTasks.mockResolvedValue({
      tasks: [
        {
          id: 12,
          title: 'Review rebalance',
          vaultAddress: VAULT,
        },
      ],
      approvals: [
        {
          id: 34,
          actionType: 'strategy.owner.emergencyUnwind',
          status: 'pending',
          vaultAddress: VAULT,
        },
      ],
      generatedAt: new Date().toISOString(),
    })
  })

  it('passes task/approval filters to service', async () => {
    const mod = await import('../_handlers/v1/workspace/_tasks.ts')
    const req = createMockReq({
      method: 'GET',
      query: {
        vault: VAULT,
        taskStatus: 'pending',
        approvalStatus: 'pending',
      },
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(mocks.resolveWorkspaceTasks).toHaveBeenCalledWith({
      vaultAddress: VAULT,
      taskStatus: 'pending',
      approvalStatus: 'pending',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.actorRole).toBe('OPERATOR')
    expect(res.body?.data?.tasks?.[0]?.id).toBe(12)
  })

  it('returns 429 when workspace tasks rate limit is exceeded', async () => {
    const mod = await import('../_handlers/v1/workspace/_tasks.ts')
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'GET',
      query: { vault: VAULT },
    })
    const res = createMockRes()
    await mod.default(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
