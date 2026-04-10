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
  getClientIp: vi.fn(() => '203.0.113.19'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    telegramLinkWrite: { windowMs: 60_000, maxRequests: 1 },
    telegramLinkRead: { windowMs: 60_000, maxRequests: 1 },
    telegramAdminWrite: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import linkCompleteHandler from '../_handlers/telegram/_link-complete.ts'
import linkReadyHandler from '../_handlers/telegram/_link-ready.ts'
import miniAppSessionHandler from '../_handlers/telegram/_miniapp-session.ts'
import unlinkHandler from '../_handlers/telegram/_unlink.ts'
import botConfigHandler from '../_handlers/telegram/_bot-config.ts'
import holderRecheckHandler from '../_handlers/telegram/_holder-recheck.ts'

describe('telegram endpoint rate-limit hardening', () => {
  it('returns 429 for /telegram/link-complete when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { sessionToken: 'session' } })
    const res = createMockRes()
    await linkCompleteHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /telegram/link-ready when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { email: 'user@example.com' } })
    const res = createMockRes()
    await linkReadyHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /telegram/miniapp-session when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { initData: 'fake-init-data' } })
    const res = createMockRes()
    await miniAppSessionHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /telegram/unlink when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { telegramUserId: '123' } })
    const res = createMockRes()
    await unlinkHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /telegram/bot-config when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await botConfigHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /telegram/holder-recheck when limited', async () => {
    const req = createMockReq({ method: 'POST', query: {} })
    const res = createMockRes()
    await holderRecheckHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })
})
