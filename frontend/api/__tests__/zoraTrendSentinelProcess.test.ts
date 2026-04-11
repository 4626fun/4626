import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_trendSentinelProcess.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  runTrendLaunchSentinelProcessMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
} = vi.hoisted(() => ({
  runTrendLaunchSentinelProcessMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((scope: string, ip: string) => `${scope}:${ip}`),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  readBoundedJsonObjectBody: vi.fn(async (req: any, opts?: { maxBytes?: number }) => {
    const body = req.body
    if (typeof body === 'string') {
      if (typeof opts?.maxBytes === 'number' && body.length > opts.maxBytes) throw new Error('body_too_large')
      return null
    }
    return body ?? null
  }),
  RATE_LIMITS: {
    adminAction: { limit: 10, windowMs: 60_000 },
  },
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/zora/trendLaunchSentinel.js', () => ({
  runTrendLaunchSentinelProcess: runTrendLaunchSentinelProcessMock,
}))

describe('POST /api/zora/trendSentinelProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TREND_SENTINEL_SECRET = 'test-secret'
  })

  it('rejects unauthorized requests', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
    expect(String(res.getHeader('cache-control') ?? '')).toBe('no-store')
  })

  it('rejects oversized request payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: 'x'.repeat(20_000),
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(413)
    expect(String(res.body?.error ?? '')).toContain('Request body too large')
  })

  it('runs sentinel when authorized', async () => {
    runTrendLaunchSentinelProcessMock.mockResolvedValueOnce({
      status: 'secured',
      securedTicker: 'AI',
      txHash: '0xtx',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: { maxRuntimeMs: 10_000, tickers: ['AI', '67'] },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('secured')
    expect(runTrendLaunchSentinelProcessMock).toHaveBeenCalledTimes(1)
  })
})
