import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_preprovision.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  isDbConfiguredMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readRequestPrincipalAddressMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn(() => 'waitlist-preprovision:test'),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  isCswOwner: vi.fn(async () => false),
}))

vi.mock('../../server/_lib/waitlistPreprovision.js', () => ({
  preprovisionWaitlistUser: vi.fn(async () => null),
}))

describe('waitlist/preprovision rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 15_000,
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Too many requests')
    expect(String(res.getHeader('Retry-After') ?? '')).not.toBe('')
    expect(getDbMock).not.toHaveBeenCalled()
  })
})
