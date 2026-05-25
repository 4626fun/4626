import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '198.51.100.42'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    cswLink: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import accountsLinkHandler from '../_handlers/accounts/_link.ts'
import accountsUnlinkHandler from '../_handlers/accounts/_unlink.ts'
import walletSyncHandler from '../_handlers/wallet/_sync.ts'

describe('accounts/wallet endpoint rate-limit hardening', () => {
  it('returns 429 for /accounts/link when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { provider: 'telegram' } })
    const res = createMockRes()
    await accountsLinkHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /accounts/unlink when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { provider: 'telegram' } })
    const res = createMockRes()
    await accountsUnlinkHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /wallet/sync when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await walletSyncHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
