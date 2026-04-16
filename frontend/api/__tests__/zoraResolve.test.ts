import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_resolve.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  resolveAndPersistZoraSignalsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  resolveAndPersistZoraSignalsMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/identity/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  resolveAndPersistZoraSignals: resolveAndPersistZoraSignalsMock,
}))

describe('POST /api/zora/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
    resolveAndPersistZoraSignalsMock.mockResolvedValue({
      zoraLinked: true,
      canonicalCswAddress: '0x2222222222222222222222222222222222222222',
      creatorCoin: {
        address: '0x3333333333333333333333333333333333333333',
        name: 'Creator Coin',
        symbol: 'COIN',
      },
      zoraHandle: 'akita',
      lastResolvedAt: '2026-03-04T00:00:00.000Z',
    })
  })

  it('returns canonical CSW + creator coin summary', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({
      canonicalCswAddress: '0x2222222222222222222222222222222222222222',
      creatorCoin: {
        address: '0x3333333333333333333333333333333333333333',
        name: 'Creator Coin',
        symbol: 'COIN',
      },
      zoraHandle: 'akita',
    })
    expect(resolveAndPersistZoraSignalsMock).toHaveBeenCalledTimes(1)
  })
})

