import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: vi.fn(async () => ({})),
  ensureCreatorAccessSchema: vi.fn(async () => undefined),
  getDb: vi.fn(async () => null),
  isDbConfigured: vi.fn(() => true),
  getSessionAddress: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  isAdminAddress: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(() => null),
  ensureWaitlistSchema: vi.fn(async () => undefined),
  logAdminAction: vi.fn(async () => undefined),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readBoundedJsonObjectBody: mocks.readBoundedJsonObjectBody,
  ensureCreatorAccessSchema: mocks.ensureCreatorAccessSchema,
  getDb: mocks.getDb,
  isDbConfigured: mocks.isDbConfigured,
  getSessionAddress: mocks.getSessionAddress,
  isAdminAddress: mocks.isAdminAddress,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  checkDurableRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
}))

vi.mock('../../server/_lib/db/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: mocks.isSupabaseAdminConfigured,
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: mocks.ensureWaitlistSchema,
}))

vi.mock('../../server/_lib/admin/adminAudit.js', () => ({
  logAdminAction: mocks.logAdminAction,
}))

vi.mock('../../server/_lib/messaging/creatorXmtpAgents.js', () => ({
  enableCswAgent: vi.fn(async () => null),
  getOrCreateCreatorXmtpAgent: vi.fn(async () => null),
}))

import allowlistHandler from '../_handlers/admin/creator-access/_allowlist.ts'
import approveCreatorHandler from '../_handlers/admin/creator-access/_approve.ts'
import denyCreatorHandler from '../_handlers/admin/creator-access/_deny.ts'
import revokeCreatorHandler from '../_handlers/admin/creator-access/_revoke.ts'
import waitlistDeleteHandler from '../_handlers/admin/waitlist/_delete.ts'
import waitlistDenyHandler from '../_handlers/admin/waitlist/_deny.ts'

describe('admin endpoint rate-limit hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    mocks.getSessionAddress.mockReturnValue('0x00000000000000000000000000000000000000aa')
    mocks.isAdminAddress.mockReturnValue(true)
  })

  it('returns 429 + Retry-After for /admin/creator-access/allowlist', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await allowlistHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 429 + Retry-After for /admin/creator-access/approve', async () => {
    const req = createMockReq({ method: 'POST', body: { requestId: 1 } })
    const res = createMockRes()
    await approveCreatorHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.readBoundedJsonObjectBody).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 429 + Retry-After for /admin/creator-access/deny', async () => {
    const req = createMockReq({ method: 'POST', body: { requestId: 1 } })
    const res = createMockRes()
    await denyCreatorHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.readBoundedJsonObjectBody).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 429 + Retry-After for /admin/creator-access/revoke', async () => {
    const req = createMockReq({ method: 'POST', body: { address: '0x0000000000000000000000000000000000000001' } })
    const res = createMockRes()
    await revokeCreatorHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.readBoundedJsonObjectBody).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 429 + Retry-After for /admin/waitlist/deny', async () => {
    const req = createMockReq({ method: 'POST', body: { id: 1 } })
    const res = createMockRes()
    await waitlistDenyHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.readBoundedJsonObjectBody).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 429 + Retry-After for /admin/waitlist/delete', async () => {
    const req = createMockReq({ method: 'POST', body: { id: 1 } })
    const res = createMockRes()
    await waitlistDeleteHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
    expect(mocks.readBoundedJsonObjectBody).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })
})
