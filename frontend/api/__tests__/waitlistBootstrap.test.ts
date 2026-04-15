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
  upsertLinkedMethodMock,
  buildAccountsMePayloadMock,
  assertNoEmailPrivyCollisionMock,
  classifyLinkedAccountsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  upsertAccountMock: vi.fn(),
  upsertLinkedMethodMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
  assertNoEmailPrivyCollisionMock: vi.fn(),
  classifyLinkedAccountsMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
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
  upsertLinkedMethod: upsertLinkedMethodMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
}))

vi.mock('../../server/_lib/walletMapping.js', () => ({
  classifyLinkedAccounts: classifyLinkedAccountsMock,
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
    classifyLinkedAccountsMock.mockReturnValue({
      embeddedEoa: { address: '0xabc1230000000000000000000000000000000000', chainType: 'evm', clientType: 'privy' },
      activeOwnerWallet: null,
      canonicalSmartWallet: null,
      canonicalSolanaWallet: null,
      operationalSolanaWallet: null,
      allWallets: [{ address: '0xabc1230000000000000000000000000000000000', walletType: 'embedded_eoa', provider: 'privy', chain: 'evm', clientType: 'privy' }],
      primaryWalletAddress: '0xabc1230000000000000000000000000000000000',
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

  it('rebinds the canonical email profile when a placeholder privy profile collides on email', async () => {
    const duplicateEmailError = new Error('duplicate key value violates unique constraint "waitlist_signups_email_key"')
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.startsWith('update profiles') && text.includes('set email = coalesce')) {
          throw duplicateEmailError
        }
        if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
          return { rows: [{ id: 42 }] }
        }
        if (text.startsWith('update profiles') && text.includes('set privy_user_id =') && text.includes('where id =')) {
          return { rows: [] }
        }
        if (text.includes('from profiles') && text.includes('where privy_user_id =') && text.includes('and id <>')) {
          return { rows: [{ id: 99 }] }
        }
        if (text.startsWith('insert into points') && text.includes('select')) {
          return { rows: [] }
        }
        if (text.startsWith('delete from points')) {
          return { rows: [] }
        }
        if (text.startsWith('update profiles') && text.includes('set privy_user_id = null')) {
          return { rows: [] }
        }
        return { rows: [] }
      }),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(upsertAccountMock).toHaveBeenCalled()
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

  it('adopts a wallet-owned email profile when sync hits a privy-user collision', async () => {
    const recoveryError = Object.assign(new Error('collision'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      email: 'user@example.com',
      requestedPrivyUserId: 'did:privy:test-user',
      existingPrivyUserId: 'did:privy:old-user',
    })
    syncEmailIdentityMock.mockRejectedValueOnce(recoveryError).mockResolvedValueOnce(undefined)
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
          return {
            rows: [
              {
                id: 42,
                privy_user_id: 'did:privy:old-user',
                primary_wallet: '0xAbC1230000000000000000000000000000000000',
                solana_wallet: null,
                canonical_solana_wallet: null,
                operational_solana_wallet: null,
                embedded_wallet: null,
                base_sub_account: null,
                csw_address: null,
                primary_smart_wallet: null,
                primary_embedded_eoa: null,
              },
            ],
          }
        }
        if (text.includes('update profiles') && text.includes('returning id')) {
          return { rows: [{ id: 42 }] }
        }
        if (text.includes('from profile_wallets') && text.includes('where profile_id =')) {
          return { rows: [] }
        }
        return { rows: [] }
      }),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(syncEmailIdentityMock).toHaveBeenCalledTimes(2)
    expect(upsertLinkedMethodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        privyUserId: 'did:privy:test-user',
        type: 'email',
        value: 'user@example.com',
        verified: true,
      }),
    )
  })

  it('does not adopt when the recovery error belongs to a different email', async () => {
    const recoveryError = Object.assign(new Error('collision'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      email: 'other@example.com',
      requestedPrivyUserId: 'did:privy:test-user',
      existingPrivyUserId: 'did:privy:old-user',
    })
    syncEmailIdentityMock.mockRejectedValueOnce(recoveryError)
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
          return {
            rows: [
              {
                id: 42,
                primary_wallet: '0xAbC1230000000000000000000000000000000000',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

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
    expect(syncEmailIdentityMock).toHaveBeenCalledTimes(1)
    expect(upsertLinkedMethodMock).not.toHaveBeenCalled()
  })

  it('does not adopt when the collision belongs to a different privy user than the current request', async () => {
    const recoveryError = Object.assign(new Error('collision'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      email: 'user@example.com',
      requestedPrivyUserId: 'did:privy:someone-else',
      existingPrivyUserId: 'did:privy:old-user',
    })
    syncEmailIdentityMock.mockRejectedValueOnce(recoveryError)
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
          return {
            rows: [
              {
                id: 42,
                primary_wallet: '0xAbC1230000000000000000000000000000000000',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

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
    expect(syncEmailIdentityMock).toHaveBeenCalledTimes(1)
    expect(upsertLinkedMethodMock).not.toHaveBeenCalled()
  })

  it('does not adopt when the stored profile owner changed after the collision was detected', async () => {
    const recoveryError = Object.assign(new Error('collision'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
      email: 'user@example.com',
      requestedPrivyUserId: 'did:privy:test-user',
      existingPrivyUserId: 'did:privy:old-user',
    })
    syncEmailIdentityMock.mockRejectedValueOnce(recoveryError)
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
          return {
            rows: [
              {
                id: 42,
                privy_user_id: 'did:privy:new-owner',
                primary_wallet: '0xAbC1230000000000000000000000000000000000',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    })

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
    expect(syncEmailIdentityMock).toHaveBeenCalledTimes(1)
    expect(upsertLinkedMethodMock).not.toHaveBeenCalled()
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

  it('rejects non-string email payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: { bad: true } as unknown as string },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid email')
  })

  it('rejects non-string referral code payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { referralCode: 42 as unknown as string },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid referral code')
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
