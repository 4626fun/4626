import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/accounts/_me.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  buildAccountsMePayloadMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
}))

describe('GET /api/accounts/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
    buildAccountsMePayloadMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      email: 'user@example.com',
      linkedMethods: { email: ['user@example.com'] },
      accountSignals: { linked: false, canonicalCswAddress: null, creatorCoin: null, zoraHandle: null, lastResolvedAt: null },
      score: { points: 10, tier: 1 },
    })
  })

  it('returns normalized account state', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.privyUserId).toBe('did:privy:test-user')
    expect(res.body?.data?.linkedMethods?.email).toEqual(['user@example.com'])
    expect(buildAccountsMePayloadMock).toHaveBeenCalled()
  })

  it('preserves explicit emailVerified=false state from account payload', async () => {
    buildAccountsMePayloadMock.mockResolvedValueOnce({
      privyUserId: 'did:privy:test-user',
      email: 'user@example.com',
      emailVerified: false,
      linkedMethods: { email: ['user@example.com'], telegram: ['akita'] },
      accountSignals: { linked: false, canonicalCswAddress: null, creatorCoin: null, zoraHandle: null, lastResolvedAt: null },
      score: { points: 10, tier: 1 },
    })

    const req = createMockReq({
      method: 'GET',
      headers: { 'x-privy-token': 'test-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.emailVerified).toBe(false)
    expect(res.body?.data?.linkedMethods?.telegram).toEqual(['akita'])
  })
})
