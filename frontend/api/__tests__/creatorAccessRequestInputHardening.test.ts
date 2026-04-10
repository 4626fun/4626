import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/creator-access/_request.ts'
import { createMockReq, createMockRes, withAuthHeader } from './helpers'

const {
  ensureCreatorAccessSchemaMock,
  getDbMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  ensureCreatorAccessSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 })),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  ensureCreatorAccessSchema: ensureCreatorAccessSchemaMock,
  getDb: getDbMock,
  isDbConfigured: () => true,
  getDbInitError: () => null,
}))

vi.mock('../../server/_lib/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: () => false,
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    creatorQuickstart: { windowMs: 60_000, maxRequests: 20 },
  },
}))

describe('creator access request input hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 })
    getDbMock.mockResolvedValue({
      query: vi.fn(async (query: string) => {
        const normalized = query.toLowerCase().replace(/\s+/g, ' ')
        if (normalized.includes('from allowlist')) return { rows: [] }
        if (normalized.includes('insert into access_requests')) return { rows: [{ id: 42 }] }
        return { rows: [] }
      }),
    })
  })

  it('rejects malformed coin input', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader(),
      body: { coin: 'not-an-address' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid coin address')
  })

  it('accepts request when coin is omitted', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader(),
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('pending')
    expect(res.body?.data?.requestId).toBe(42)
  })
})

