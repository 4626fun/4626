import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/agents/access-proof/_request.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  readJsonBodyMock,
  setCorsMock,
  setNoStoreMock,
  guardAgentApiRequestMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  issueAgentAccessProofRequestMock,
  resolveMembershipForRoomMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  readJsonBodyMock: vi.fn(async () => ({})),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  guardAgentApiRequestMock: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  issueAgentAccessProofRequestMock: vi.fn(),
  resolveMembershipForRoomMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: handleOptionsMock,
  readBoundedJsonObjectBody: readJsonBodyMock,
  readJsonBody: readJsonBodyMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardAgentApiRequestMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    agentAccessProofRequest: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/agent/agentAccessProof.js', () => ({
  issueAgentAccessProofRequest: issueAgentAccessProofRequestMock,
}))

vi.mock('../../server/_lib/agent/agentAccessResolver.js', () => ({
  resolveMembershipForRoom: resolveMembershipForRoomMock,
}))

describe('v1/agents/access-proof/request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })
    readJsonBodyMock.mockResolvedValue({
      wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      roomKey: 'xmtp:group_123',
    })
    resolveMembershipForRoomMock.mockResolvedValue({
      type: 'xmtp',
      shareToken: '0x1111111111111111111111111111111111111111',
      vault: '0x2222222222222222222222222222222222222222',
      roomKey: 'xmtp:group_123',
      qualified: true,
      minBalance: '1',
      actualBalance: '4',
      accessTokenRequired: true,
      statusReason: 'qualified',
    })
    issueAgentAccessProofRequestMock.mockResolvedValue({
      schema: '4626-agent-access-proof-request-v1',
      wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      roomKey: 'xmtp:group_123',
      nonce: 'nonce-12345678',
      issuedAt: '2026-03-16T18:00:00.000Z',
      expiresAt: '2026-03-16T18:10:00.000Z',
      message: '4626 Access Proof',
    })
  })

  it('returns 429 when request rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('rejects malformed request body payloads', async () => {
    readJsonBodyMock.mockResolvedValueOnce({ bad: true })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('rejects non-object request body payloads', async () => {
    readJsonBodyMock.mockResolvedValueOnce(['bad'])

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('returns proof request payload for qualified memberships', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.schema).toBe('4626-agent-access-proof-request-v1')
    expect(issueAgentAccessProofRequestMock).toHaveBeenCalledTimes(1)
  })
})
