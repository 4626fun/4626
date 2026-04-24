import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/v2/session/_create.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readDeployAuthFromRequestMock,
  isDbConfiguredMock,
  checkRateLimitMock,
  checkDurableRateLimitMock,
  rateLimitKeyMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readDeployAuthFromRequestMock: vi.fn(() => ({
    address: '0x0000000000000000000000000000000000000001',
    type: 'session' as const,
  })),
  isDbConfiguredMock: vi.fn(() => true),
  checkRateLimitMock: vi.fn(() => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  checkDurableRateLimitMock: vi.fn(async () => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  isDbConfigured: isDbConfiguredMock,
  getDb: vi.fn(),
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkDurableRateLimitMock,
  RATE_LIMITS: { deployCreate: { windowMs: 60_000, maxRequests: 3 } },
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/auth/deployAuth.js', () => ({
  readDeployAuthFromRequest: readDeployAuthFromRequestMock,
}))

describe('deploy session create rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
    readDeployAuthFromRequestMock.mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      type: 'session',
    })
    checkRateLimitMock.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
    checkDurableRateLimitMock.mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 })
  })

  it('uses a dedicated preflight rate limit bucket when preflightOnly=true', async () => {
    const req = createMockReq({ method: 'POST', body: { preflightOnly: true } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many deploy preflight checks')
    expect(rateLimitKeyMock).toHaveBeenCalledWith('deploy-preflight', '0x0000000000000000000000000000000000000001')
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      'deploy-preflight:0x0000000000000000000000000000000000000001',
      { windowMs: 60_000, maxRequests: 20 },
    )
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('keeps create requests on the deployCreate rate limit bucket', async () => {
    const req = createMockReq({ method: 'POST', body: { preflightOnly: false } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many deploy attempts')
    expect(rateLimitKeyMock).toHaveBeenCalledWith('deploy', '0x0000000000000000000000000000000000000001')
    expect(checkDurableRateLimitMock).toHaveBeenCalledWith(
      'deploy:0x0000000000000000000000000000000000000001',
      { windowMs: 60_000, maxRequests: 3 },
      { failClosed: true },
    )
  })
})
