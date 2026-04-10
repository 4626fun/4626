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
  getClientIp: vi.fn(() => '203.0.113.66'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    agentsRead: { windowMs: 60_000, maxRequests: 1 },
    agentsWrite: { windowMs: 60_000, maxRequests: 1 },
    specRead: { windowMs: 60_000, maxRequests: 1 },
    cswLink: { windowMs: 60_000, maxRequests: 1 },
    adminAction: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import lensAgentRegistrationHandler from '../_handlers/lens/_agent-registration.ts'
import lensFeedbackPayloadHandler from '../_handlers/lens/_feedback-payload.ts'
import lensReputationGraphHandler from '../_handlers/lens/_reputation-graph.ts'
import zoraRefreshHandler from '../_handlers/zora/_refresh.ts'
import zoraResolveHandler from '../_handlers/zora/_resolve.ts'
import zoraLinkStatusHandler from '../_handlers/zora/link/_status.ts'
import zoraTrendReserveHandler from '../_handlers/zora/_trendReserve.ts'
import zoraTrendSentinelProcessHandler from '../_handlers/zora/_trendSentinelProcess.ts'

describe('lens/zora endpoint rate-limit hardening', () => {
  it('returns 429 for /lens/agent-registration when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await lensAgentRegistrationHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for GET /lens/feedback-payload when limited', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await lensFeedbackPayloadHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for POST /lens/reputation-graph when limited', async () => {
    const req = createMockReq({ method: 'POST', body: { agentId: 1 } })
    const res = createMockRes()
    await lensReputationGraphHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /zora/refresh when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await zoraRefreshHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /zora/resolve when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await zoraResolveHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /zora/link/status when limited', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await zoraLinkStatusHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /zora/trendReserve when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await zoraTrendReserveHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('returns 429 for /zora/trendSentinelProcess when limited', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await zoraTrendSentinelProcessHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })
})
