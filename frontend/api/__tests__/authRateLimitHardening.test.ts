import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '../../@4626/server-core',
  )
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    checkDurableRateLimit: checkRateLimitMock,
    getClientIp: vi.fn(() => '203.0.113.11'),
    rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
    RATE_LIMITS: {
      ...(actual as any).RATE_LIMITS,
      authRead: { windowMs: 60_000, maxRequests: 1 },
      authWrite: { windowMs: 60_000, maxRequests: 1 },
      authPrivy: { windowMs: 60_000, maxRequests: 1 },
      authAgentWrite: { windowMs: 60_000, maxRequests: 1 },
    },
  }
})

import nonceHandler from '../_handlers/auth/_nonce.ts'
import verifyHandler from '../_handlers/auth/_verify.ts'
import privyHandler from '../_handlers/auth/_privy.ts'
import logoutHandler from '../_handlers/auth/_logout.ts'
import meHandler from '../_handlers/auth/_me.ts'
import agentNonceHandler from '../_handlers/auth/_agent-nonce.ts'
import agentVerifyHandler from '../_handlers/auth/_agent-verify.ts'

describe('auth endpoint rate-limit hardening', () => {
  it('returns 429 for /auth/nonce when limited', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await nonceHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/verify when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { message: 'm', signature: 's' } })
    const res = createMockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/privy when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await privyHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/logout when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await logoutHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/me when limited', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await meHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/agent-nonce when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { agentId: 2205, ownerAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5' } })
    const res = createMockRes()
    await agentNonceHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 for /auth/agent-verify when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { message: 'm', signature: 's' } })
    const res = createMockRes()
    await agentVerifyHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
