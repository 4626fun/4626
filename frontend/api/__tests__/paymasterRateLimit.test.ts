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
  getClientIp: vi.fn(() => '198.51.100.99'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    paymasterRpc: { windowMs: 60_000, maxRequests: 1 },
  },
}))

import handler from '../_handlers/paymaster/_paymaster.ts'

describe('paymaster endpoint rate-limit hardening', () => {
  it('returns a JSON-RPC rate-limit error when limiter rejects', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: [],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.error?.code).toBe(-32005)
    expect(res.body?.error?.message).toBe('Rate limit exceeded')
  })
})
