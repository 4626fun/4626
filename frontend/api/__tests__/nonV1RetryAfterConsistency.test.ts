import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  getDb: vi.fn(async () => null),
  getClientIp: vi.fn(() => '198.51.100.101'),
  checkRateLimit: vi.fn(() => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  readRequestPrincipalAddress: vi.fn(() => '0x1111111111111111111111111111111111111111'),
  makeSessionToken: vi.fn(() => 'session-token'),
  setCookie: vi.fn(),
  ensureCreatorAccessSchema: vi.fn(),
  isDbConfigured: vi.fn(() => false),
  getSessionAddress: vi.fn(() => '0x1111111111111111111111111111111111111111'),
  isAdminAddress: vi.fn(() => true),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readJsonBody: mocks.readJsonBody,
  getDb: mocks.getDb,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  readRequestPrincipalAddress: mocks.readRequestPrincipalAddress,
  makeSessionToken: mocks.makeSessionToken,
  setCookie: mocks.setCookie,
  COOKIE_SESSION: 'session',
  ensureCreatorAccessSchema: mocks.ensureCreatorAccessSchema,
  isDbConfigured: mocks.isDbConfigured,
  getSessionAddress: mocks.getSessionAddress,
  isAdminAddress: mocks.isAdminAddress,
  RATE_LIMITS: {
    adminAction: { windowMs: 60_000, maxRequests: 1 },
  },
}))

vi.mock('../../server/auth/_handoff.js', () => ({
  ensureHandoffSchema: vi.fn(),
  createHandoffCode: vi.fn(),
  consumeHandoffCode: vi.fn(),
}))

vi.mock('../../server/_lib/db/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(() => null),
}))

import handoffCreateHandler from '../_handlers/auth/_handoff-create.ts'
import handoffRedeemHandler from '../_handlers/auth/_handoff-redeem.ts'
import allowlistHandler from '../_handlers/admin/creator-access/_allowlist.ts'

describe('non-v1 Retry-After consistency (remaining paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 + Retry-After for /auth/handoff-create', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handoffCreateHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /auth/handoff-redeem', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handoffRedeemHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /admin/creator-access/allowlist', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await allowlistHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
