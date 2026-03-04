import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_csw-proof.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readJsonBodyMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn(() => 'waitlist-csw-proof:test'),
  readJsonBodyMock: vi.fn(async () => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: readJsonBodyMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

describe('waitlist/csw-proof rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 429 on GET when challenge issuance is rate limited', async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 10_000,
    })

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Too many requests')
    expect(String(res.getHeader('Retry-After') ?? '')).not.toBe('')
  })

  it('returns 429 on POST before reading body when verification is rate limited', async () => {
    checkRateLimitMock.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 10_000,
    })

    const req = createMockReq({ method: 'POST', body: { challengeToken: 'x', cswAddress: '0x0', signature: '0x0' } })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Too many requests')
    expect(String(res.getHeader('Retry-After') ?? '')).not.toBe('')
    expect(readJsonBodyMock).not.toHaveBeenCalled()
  })
})
