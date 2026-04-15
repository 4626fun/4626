import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/workspace/_actions.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  guardAgentApiRequestMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readJsonBodyMock,
} = vi.hoisted(() => ({
  guardAgentApiRequestMock: vi.fn(async () => ({
    ok: true,
    ip: '127.0.0.1',
    auth: { type: 'session', address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  readJsonBodyMock: vi.fn(async () => ({})),
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardAgentApiRequestMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    workspaceActions: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/auth/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/auth/_shared.js')>('../../server/auth/_shared.js')
  return {
    ...actual,
    readBoundedJsonObjectBody: readJsonBodyMock,
    readJsonBody: readJsonBodyMock,
  }
})

describe('POST /api/v1/workspace/actions hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })
    readJsonBodyMock.mockResolvedValue({})
  })

  it('returns 429 when workspace action rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('uses tightened body cap and returns 400 when action is missing', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { vault: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(readJsonBodyMock).toHaveBeenCalledWith(req, { maxBytes: 65_536 })
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('action is required')
  })
})
