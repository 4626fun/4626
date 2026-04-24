import { beforeEach, describe, expect, it, vi } from 'vitest'

import linkHandler from '../_handlers/accounts/_link.ts'
import unlinkHandler from '../_handlers/accounts/_unlink.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  syncEmailIdentityMock,
  recordProviderLinkMock,
  recordProviderUnlinkMock,
  buildAccountsMePayloadMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  recordProviderLinkMock: vi.fn(),
  recordProviderUnlinkMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/identity/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  syncEmailIdentity: syncEmailIdentityMock,
  recordProviderLink: recordProviderLinkMock,
  recordProviderUnlink: recordProviderUnlinkMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
}))

vi.mock('../../server/_lib/identity/identityRecovery.js', () => ({
  isIdentityRecoveryRequiredError: () => false,
}))

describe('accounts link/unlink telegram provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user' },
    })
    ensureAccountsIdentitySchemaMock.mockResolvedValue(undefined)
    syncEmailIdentityMock.mockResolvedValue(undefined)
    recordProviderLinkMock.mockResolvedValue(undefined)
    recordProviderUnlinkMock.mockResolvedValue(undefined)
    buildAccountsMePayloadMock.mockResolvedValue({
      privyUserId: 'did:privy:test-user',
      email: 'user@example.com',
      appAccessStatus: null,
      linkedMethods: { telegram: ['akita_telegram'] },
      accountSignals: {
        linked: false,
        canonicalCswAddress: null,
        baseSubAccount: {
          address: null,
          registered: false,
          isDistinctFromCsw: false,
        },
        executionTrack: 'none-yet',
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
        creatorCoin: null,
        zoraHandle: null,
        lastResolvedAt: null,
      },
      score: { points: 0, tier: 0 },
    })
  })

  it('accepts telegram in /api/accounts/link', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { provider: 'telegram' },
    })
    const res = createMockRes()

    await linkHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(recordProviderLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'telegram',
      }),
    )
  })

  it('accepts telegram in /api/accounts/unlink', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { provider: 'telegram' },
    })
    const res = createMockRes()

    await unlinkHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(recordProviderUnlinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'telegram',
      }),
    )
  })

  it('returns 409 when explicit email link is not verified in Privy yet', async () => {
    recordProviderLinkMock.mockRejectedValueOnce(new Error('Email is not verified in Privy yet.'))

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: { provider: 'email' },
    })
    const res = createMockRes()

    await linkHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('Email is not verified in Privy yet.')
  })

  it('rejects oversized link value payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {
        provider: 'telegram',
        value: 'x'.repeat(257),
      },
    })
    const res = createMockRes()

    await linkHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid link value')
    expect(recordProviderLinkMock).not.toHaveBeenCalled()
  })

  it('rejects oversized unlink value payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'test-token' },
      body: {
        provider: 'telegram',
        value: 'x'.repeat(257),
      },
    })
    const res = createMockRes()

    await unlinkHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid unlink value')
    expect(recordProviderUnlinkMock).not.toHaveBeenCalled()
  })
})
