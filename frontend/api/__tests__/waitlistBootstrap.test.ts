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
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  upsertAccountMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
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

describe('POST /api/waitlist/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user', email: { address: 'user@example.com' } },
    })
    buildAccountsMePayloadMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      email: 'user@example.com',
      linkedMethods: { email: ['user@example.com'] },
      zora: { linked: false, canonicalCswAddress: null, creatorCoin: null, zoraHandle: null, lastResolvedAt: null },
      score: { points: 0, tier: 0 },
    })
  })

  it('rejects body email when it does not match authenticated privy email', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'victim@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(upsertAccountMock).not.toHaveBeenCalled()
  })
})
