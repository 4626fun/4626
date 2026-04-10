import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
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
import walletPrepareAddPrivyOwnerHandler from '../_handlers/wallet/_prepare-add-privy-owner.ts'
import walletPrepareAddRabbyOwnerHandler from '../_handlers/wallet/_prepare-add-rabby-owner.ts'
import walletConfirmOwnerHandler from '../_handlers/wallet/_confirm-owner.ts'

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

  it('returns 429 for /wallet/prepare-add-privy-owner when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await walletPrepareAddPrivyOwnerHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /wallet/prepare-add-rabby-owner when limited', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        rabbyAddress: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
        confirmedAdvanced: true,
      },
    })
    const res = createMockRes()
    await walletPrepareAddRabbyOwnerHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /wallet/confirm-owner when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await walletConfirmOwnerHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
