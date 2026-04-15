import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const AUCTION = '0x9999999999999999999999999999999999999999'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/auth/_shared.js', () => ({
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
    auctionRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

describe('v1 auction recentBids handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
  })

  it('registers static and dynamic recentBids routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')

    await expect(getV1ApiHandler('auction/recentBids')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`auction/${AUCTION}/recentBids`)).resolves.toBeTypeOf('function')
  })

  it('returns 429 when auction recentBids rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const mod = await import('../_handlers/v1/auction/_recentBids.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { auction: AUCTION },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
