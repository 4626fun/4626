import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock, readRequestPrincipalAddressMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
  readRequestPrincipalAddressMock: vi.fn(() => '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>(
    '../../packages/server-core/src/index.js',
  )
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    getClientIp: vi.fn(() => '198.51.100.77'),
    rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
    readRequestPrincipalAddress: readRequestPrincipalAddressMock,
    RATE_LIMITS: {
      general: { windowMs: 60_000, maxRequests: 1 },
    },
  }
})

import checkApprovalHandler from '../_handlers/uniswap/_checkApproval.ts'
import checkDelegationHandler from '../_handlers/uniswap/_checkDelegation.ts'
import liquidityHandler from '../_handlers/uniswap/_liquidity.ts'
import orderHandler from '../_handlers/uniswap/_order.ts'
import planHandler from '../_handlers/uniswap/_plan.ts'
import poolHistoryHandler from '../_handlers/uniswap/_poolHistory.ts'
import queryHandler from '../_handlers/uniswap/_query.ts'
import quoteHandler from '../_handlers/uniswap/_quote.ts'
import swapHandler from '../_handlers/uniswap/_swap.ts'
import swap5792Handler from '../_handlers/uniswap/_swap5792.ts'
import swap7702Handler from '../_handlers/uniswap/_swap7702.ts'

describe('uniswap endpoint rate-limit hardening', () => {
  it('returns 429 + Retry-After for /uniswap/query when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await queryHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/liquidity when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await liquidityHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/order when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await orderHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/checkDelegation when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await checkDelegationHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/swap5792 when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await swap5792Handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/swap7702 when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await swap7702Handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/plan when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await planHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/swap when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await swapHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/quote when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await quoteHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/checkApproval when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await checkApprovalHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /uniswap/poolHistory when limited', async () => {
    const req = createMockReq({ method: 'GET', query: { token: '0x1111111111111111111111111111111111111111' } })
    const res = createMockRes()
    await poolHistoryHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
