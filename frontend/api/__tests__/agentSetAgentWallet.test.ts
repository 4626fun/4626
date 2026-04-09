import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/agents/identity/_setAgentWallet.ts'
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
  resolveCanonicalSmartWalletAddressMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  readJsonBodyMock: vi.fn(async () => ({})),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  guardAgentApiRequestMock: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  resolveCanonicalSmartWalletAddressMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: handleOptionsMock,
  readJsonBody: readJsonBodyMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardAgentApiRequestMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    agentIdentitySetWallet: { windowMs: 60_000, maxRequests: 30 },
  },
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: resolveCanonicalSmartWalletAddressMock,
}))

describe('v1/agents/identity/set-agent-wallet', () => {
  const OWNER = '0x2222222222222222222222222222222222222222'
  const NEW_WALLET = '0x1111111111111111111111111111111111111111'

  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })
    resolveCanonicalSmartWalletAddressMock.mockResolvedValue(OWNER.toLowerCase())
    readJsonBodyMock.mockResolvedValue({
      action: 'prepare',
      agentId: '123',
      ownerAddress: OWNER,
      newWallet: NEW_WALLET,
      chainId: 8453,
    })
  })

  it('returns 429 when request rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('rejects invalid agent ids', async () => {
    readJsonBodyMock.mockResolvedValueOnce({
      action: 'prepare',
      agentId: 'abc',
      ownerAddress: OWNER,
      newWallet: NEW_WALLET,
      chainId: 8453,
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('agentId')
  })

  it('returns typed data for prepare flow', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.typedData?.primaryType).toBe('AgentWalletSet')
    expect(res.body?.data?.typedData?.message?.agentId).toBe('123')
  })
})
