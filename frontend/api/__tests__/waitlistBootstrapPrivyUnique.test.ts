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
    zora: {
      linked: false,
      canonicalCswAddress: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: null,
    },
    score: { points: 0, tier: 0 },
  })),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  upsertAccount: upsertAccountMock,
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
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
})
