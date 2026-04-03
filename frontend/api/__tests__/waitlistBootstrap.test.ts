import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_bootstrap.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  upsertAccountMock,
  buildAccountsMePayloadMock,
  assertNoEmailPrivyCollisionMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  upsertAccountMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
  assertNoEmailPrivyCollisionMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  upsertAccount: upsertAccountMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
}))

vi.mock('../../server/_lib/identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: assertNoEmailPrivyCollisionMock,
  isIdentityRecoveryRequiredError: (error: any) => error?.code === 'IDENTITY_RECOVERY_REQUIRED',
}))

describe('POST /api/waitlist/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    assertNoEmailPrivyCollisionMock.mockResolvedValue(undefined)
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user', email: { address: 'user@example.com' } },
    })
    buildAccountsMePayloadMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      email: 'user@example.com',
      linkedMethods: { email: ['user@example.com'] },
      accountSignals: { linked: false, canonicalCswAddress: null, creatorCoin: null, zoraHandle: null, lastResolvedAt: null },
      score: { points: 0, tier: 0 },
    })
  })

  it('prefers the authenticated Privy email over the submitted body email', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'victim@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(upsertAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        emailVerified: true,
      }),
    )
  })

  it('returns deterministic recovery-required payload on email collision without a transport error status', async () => {
    const error = Object.assign(new Error('collision'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
    })
    assertNoEmailPrivyCollisionMock.mockRejectedValueOnce(error)
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(false)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_EMAIL_BOUND')
    expect(res.body?.recoveryRequired).toBe(true)
  })

  it('returns requiresPrivyAuth plus existing waitlist entry id before auth', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select id from profiles where email =')) {
          return { rows: [{ id: 42 }] }
        }
        return { rows: [] }
      }),
    })

    const req = createMockReq({
      method: 'POST',
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      requiresPrivyAuth: true,
      email: 'user@example.com',
      waitlistEntryId: 42,
    })
  })

  it('does not upsert a canonical account email until Privy email is verified', async () => {
    verifyPrivyForAccountsMock.mockResolvedValueOnce({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user', email: null },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertAccountMock).not.toHaveBeenCalled()
  })

  it('returns 401 for explicit session email mismatch errors', async () => {
    verifyPrivyForAccountsMock.mockRejectedValueOnce(new Error('Email does not match authenticated user'))

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('Session email mismatch. Please sign in again.')
  })
})
