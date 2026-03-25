import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/telegram/_link-ready.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  dbSqlMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  dbSqlMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
}))

describe('POST /api/telegram/link/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: dbSqlMock })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
    ensureAccountsIdentitySchemaMock.mockResolvedValue(undefined)
    syncEmailIdentityMock.mockResolvedValue(undefined)
    dbSqlMock.mockResolvedValue({
      rows: [
        {
          email: 'user@example.com',
          email_verified: true,
          canonical_csw_address: '0x1234567890abcdef1234567890abcdef12345678',
        },
      ],
    })
  })

  it('returns ready once the verified email matches the active Privy account', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        email: ' USER@EXAMPLE.COM ',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({
      ready: true,
      account: {
        privyUserId: 'did:privy:test-user',
        email: 'user@example.com',
        emailVerified: true,
        canonicalCswAddress: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })
  })

  it('returns not ready when the verified email does not match yet', async () => {
    dbSqlMock.mockResolvedValueOnce({
      rows: [
        {
          email: 'other@example.com',
          email_verified: true,
          canonical_csw_address: null,
        },
      ],
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        email: 'user@example.com',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      ready: false,
      account: null,
    })
  })

  it('returns not ready when the email is still unverified', async () => {
    dbSqlMock.mockResolvedValueOnce({
      rows: [
        {
          email: 'user@example.com',
          email_verified: false,
          canonical_csw_address: null,
        },
      ],
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        email: 'user@example.com',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      ready: false,
      account: null,
    })
  })
})
