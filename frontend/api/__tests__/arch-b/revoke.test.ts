/**
 * Tests for POST /api/arch-b/revoke
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from '../helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: vi.fn(async () => ({})),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  resolveAuthorizedRequestPrincipal: vi.fn(),
  revokeCommandIssuerContext: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readBoundedJsonObjectBody: mocks.readBoundedJsonObjectBody,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  resolveAuthorizedRequestPrincipal: mocks.resolveAuthorizedRequestPrincipal,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
}))

vi.mock('@4626/server-core/identity', () => ({
  revokeCommandIssuerContext: mocks.revokeCommandIssuerContext,
}))

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const PROFILE_ID = 7
const PRINCIPAL_ADDRESS = '0xdddddddddddddddddddddddddddddddddddddddd'

const AUTHORIZED_PRINCIPAL = {
  address: PRINCIPAL_ADDRESS,
  source: 'session' as const,
  authSource: 'session' as const,
  profileId: PROFILE_ID,
  canonicalSmartWalletAddress: '0xaaaa000000000000000000000000000000000000',
  activeOwnerWalletAddress: null,
  signerRole: 'canonical_smart_wallet' as const,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/arch-b/revoke', () => {
  let handler: (typeof import('../../_handlers/arch-b/_revoke.js'))['default']

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(AUTHORIZED_PRINCIPAL)
    mocks.revokeCommandIssuerContext.mockResolvedValue({ ok: true })

    const mod = await import('../../_handlers/arch-b/_revoke.ts')
    handler = mod.default
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('Sign in required')
  })

  it('returns 200 on happy path with default reason', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profileId).toBe(PROFILE_ID)
    expect(res.body.data.reason).toBe('user_revoked')
    expect(typeof res.body.data.revokedAt).toBe('string')
    expect(mocks.revokeCommandIssuerContext).toHaveBeenCalledWith(
      PROFILE_ID,
      'user_revoked',
    )
  })

  it('returns 200 with custom reason', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({ reason: 'changing_wallet' })
    const req = createMockReq({ method: 'POST', body: { reason: 'changing_wallet' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.reason).toBe('changing_wallet')
  })

  it('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 500 when revokeCommandIssuerContext returns false', async () => {
    mocks.revokeCommandIssuerContext.mockResolvedValue(false)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('revoke_failed')
  })
})
