import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { coreCheckRateLimitMock, libCheckRateLimitMock } = vi.hoisted(() => ({
  coreCheckRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
  libCheckRateLimitMock: vi.fn(() => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '@4626/server-core',
  )
  return {
    ...actual,
    checkRateLimit: coreCheckRateLimitMock,
    checkDurableRateLimit: coreCheckRateLimitMock,
    getClientIp: vi.fn(() => '198.51.100.99'),
    rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
    RATE_LIMITS: {
      general: { windowMs: 60_000, maxRequests: 1 },
      exploreRead: { windowMs: 60_000, maxRequests: 1 },
    },
  }
})

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: libCheckRateLimitMock,
  getClientIp: vi.fn(() => '198.51.100.99'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    cswLink: { windowMs: 60_000, maxRequests: 1 },
    adminAction: { windowMs: 60_000, maxRequests: 1 },
  },
}))

vi.mock('../../server/zora/_shared.js', () => ({
  DEFAULT_CHAIN_ID: 8453,
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setCache: vi.fn(),
  requireServerKey: vi.fn(() => 'test-zora-server-key'),
  getNumberQuery: vi.fn(() => null),
  getStringQuery: vi.fn(() => 'test-identifier'),
  isAddressLike: vi.fn(() => true),
}))

import profileCoinsHandler from '../_handlers/zora/_profileCoins.ts'
import refreshHandler from '../_handlers/zora/_refresh.ts'
import resolveHandler from '../_handlers/zora/_resolve.ts'
import topCreatorsHandler from '../_handlers/zora/_topCreators.ts'
import trendReserveHandler from '../_handlers/zora/_trendReserve.ts'
import trendSentinelProcessHandler from '../_handlers/zora/_trendSentinelProcess.ts'
import linkStatusHandler from '../_handlers/zora/link/_status.ts'

describe('zora endpoint rate-limit hardening', () => {
  it('returns 429 + Retry-After for /zora/refresh when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/resolve when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await resolveHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/link/status when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await linkStatusHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/topCreators when limited', async () => {
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await topCreatorsHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/trendReserve when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await trendReserveHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/trendSentinelProcess when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await trendSentinelProcessHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /zora/profileCoins when limited', async () => {
    const req = createMockReq({ method: 'GET', query: { identifier: 'akita' } })
    const res = createMockRes()
    await profileCoinsHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
