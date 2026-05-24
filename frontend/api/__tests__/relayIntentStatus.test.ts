import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock, fetchRelayIntentStatusMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  fetchRelayIntentStatusMock: vi.fn(async () => ({ status: 'waiting' })),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: { relayIntentStatus: { windowMs: 60_000, maxRequests: 300 } },
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getClientIp: vi.fn(() => '203.0.113.42'),
  logger: { warn: vi.fn() },
}))

vi.mock('../../server/_lib/relay/fetchRelayIntentStatus.js', () => ({
  fetchRelayIntentStatus: fetchRelayIntentStatusMock,
}))

describe('GET /api/relay/intent-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('proxies requestId status polls', async () => {
    const requestId = '0x' + 'aa'.repeat(32)
    const { default: handler } = await import('../_handlers/relay/_intent-status.js')
    const req = createMockReq({
      method: 'GET',
      query: { requestId },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(fetchRelayIntentStatusMock).toHaveBeenCalledWith({ requestId })
  })

  it('rejects missing and duplicate query params', async () => {
    const { default: handler } = await import('../_handlers/relay/_intent-status.js')
    const missing = createMockRes()
    await handler(createMockReq({ method: 'GET', query: {} }), missing)
    expect(missing.statusCode).toBe(400)

    const duplicate = createMockRes()
    await handler(
      createMockReq({
        method: 'GET',
        query: {
          requestId: '0x' + 'aa'.repeat(32),
          orderId: '0x' + 'bb'.repeat(32),
        },
      }),
      duplicate,
    )
    expect(duplicate.statusCode).toBe(400)
  })
})
