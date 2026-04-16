import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_bootstrap.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  upsertAccountMock,
  verifyPrivyForAccountsMock,
  buildAccountsMePayloadMock,
  assertNoEmailPrivyCollisionMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  ensureAccountsIdentitySchemaMock: vi.fn(async () => {}),
  syncEmailIdentityMock: vi.fn(async () => {}),
  upsertAccountMock: vi.fn(async () => {}),
  verifyPrivyForAccountsMock: vi.fn(async () => ({
    privyUserId: 'did:privy:test-user',
    privyUser: {
      id: 'did:privy:test-user',
      email: { address: 'user@example.com' },
      linkedAccounts: [],
    },
  })),
  buildAccountsMePayloadMock: vi.fn(async () => ({
    privyUserId: 'did:privy:test-user',
    email: 'user@example.com',
    appAccessStatus: null,
    linkedMethods: {},
    accountSignals: {
      linked: false,
      canonicalCswAddress: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: null,
    },
    score: { points: 0, tier: 0 },
  })),
  assertNoEmailPrivyCollisionMock: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/identity/accountsIdentity.js', () => ({
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  upsertAccount: upsertAccountMock,
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
}))

vi.mock('../../server/_lib/identity/identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: assertNoEmailPrivyCollisionMock,
  isIdentityRecoveryRequiredError: (error: any) => error?.code === 'IDENTITY_RECOVERY_REQUIRED',
}))

describe('waitlist bootstrap privy profile upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('recovers from profiles_privy_user_id_unique conflict by updating existing privy row', async () => {
    let updateByPrivyCalls = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('update profiles') && text.includes('where privy_user_id')) {
          updateByPrivyCalls += 1
          return { rows: updateByPrivyCalls > 1 ? [{ id: 42 }] : [] }
        }
        if (text.includes('insert into profiles')) {
          throw new Error('duplicate key value violates unique constraint "profiles_privy_user_id_unique"')
        }
        return { rows: [] }
      }),
    }
    getDbMock.mockResolvedValue(db as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { email: 'new-email@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.requiresPrivyAuth).toBe(false)
    expect(updateByPrivyCalls).toBe(2)
    expect(db.sql).toHaveBeenCalled()
  })

  it('prefers authenticated Privy email over pre-auth submitted email', async () => {
    verifyPrivyForAccountsMock.mockResolvedValueOnce({
      privyUserId: 'did:privy:test-user',
      privyUser: {
        id: 'did:privy:test-user',
        email: { address: 'privy@example.com' },
        linkedAccounts: [],
      },
    })

    const seenValues: any[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('update profiles') && text.includes('where privy_user_id')) {
          seenValues.push(...values)
          return { rows: [] }
        }
        if (text.includes('insert into profiles')) {
          seenValues.push(...values)
          return { rows: [] }
        }
        return { rows: [] }
      }),
    }
    getDbMock.mockResolvedValue(db as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { email: 'submitted@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(seenValues).toContain('privy@example.com')
    expect(seenValues).not.toContain('submitted@example.com')
  })

  it('maps Privy email mismatch to a re-auth error', async () => {
    verifyPrivyForAccountsMock.mockRejectedValueOnce(new Error('Email does not match authenticated user'))
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) } as any)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { email: 'submitted@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
    expect(res.body?.error).toBe('Session email mismatch. Please sign in again.')
  })
})
