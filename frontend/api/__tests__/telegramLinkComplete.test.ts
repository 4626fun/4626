import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  ensureAccountsIdentitySchemaMock,
  ensureTelegramTradingSchemaMock,
  verifyPrivyForAccountsMock,
  syncEmailIdentityMock,
  syncUserWalletsMock,
  buildAccountsMePayloadMock,
  recordProviderLinkMock,
  readTelegramMiniAppSessionMock,
  readTelegramLinkStartTokenStatusMock,
  claimTelegramLinkStartTokenMock,
  readTelegramLinkStartTokenClaimMock,
  finalizeTelegramLinkStartTokenConsumptionMock,
  getTelegramLinkByUserIdMock,
  runTelegramMergePreflightMock,
  upsertTelegramUserLinkMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  ensureTelegramTradingSchemaMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  syncEmailIdentityMock: vi.fn(),
  syncUserWalletsMock: vi.fn(),
  buildAccountsMePayloadMock: vi.fn(),
  recordProviderLinkMock: vi.fn(),
  readTelegramMiniAppSessionMock: vi.fn(),
  readTelegramLinkStartTokenStatusMock: vi.fn(),
  claimTelegramLinkStartTokenMock: vi.fn(),
  readTelegramLinkStartTokenClaimMock: vi.fn(),
  finalizeTelegramLinkStartTokenConsumptionMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  runTelegramMergePreflightMock: vi.fn(),
  upsertTelegramUserLinkMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

vi.mock('../../server/_lib/identityRecovery.js', () => ({
  isIdentityRecoveryRequiredError: (error: any) => error?.code === 'IDENTITY_RECOVERY_REQUIRED',
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  syncEmailIdentity: syncEmailIdentityMock,
  buildAccountsMePayload: buildAccountsMePayloadMock,
  recordProviderLink: recordProviderLinkMock,
}))

vi.mock('../../server/_lib/telegramTrading.js', () => ({
  ensureTelegramTradingSchema: ensureTelegramTradingSchemaMock,
  readTelegramMiniAppSession: readTelegramMiniAppSessionMock,
  readTelegramLinkStartTokenStatus: readTelegramLinkStartTokenStatusMock,
  claimTelegramLinkStartToken: claimTelegramLinkStartTokenMock,
  readTelegramLinkStartTokenClaim: readTelegramLinkStartTokenClaimMock,
  finalizeTelegramLinkStartTokenConsumption: finalizeTelegramLinkStartTokenConsumptionMock,
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
  runTelegramMergePreflight: runTelegramMergePreflightMock,
  upsertTelegramUserLink: upsertTelegramUserLinkMock,
}))

describe('POST /api/telegram/link/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    ensureWaitlistSchemaMock.mockResolvedValue(undefined)
    ensureAccountsIdentitySchemaMock.mockResolvedValue(undefined)
    ensureTelegramTradingSchemaMock.mockResolvedValue(undefined)
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:user-1',
      privyUser: { id: 'did:privy:user-1', linkedAccounts: [{ type: 'telegram', telegramUserId: '42' }] },
    })
    syncEmailIdentityMock.mockResolvedValue(undefined)
    syncUserWalletsMock.mockResolvedValue({
      profileId: 11,
      canonicalSmartWallet: null,
      activeOwnerWallet: null,
      canonicalSolanaWallet: null,
      operationalSolanaWallet: null,
      embeddedEoa: null,
      connectedWallets: [],
      primaryWalletAddress: null,
    })
    buildAccountsMePayloadMock.mockResolvedValue({
      privyUserId: 'did:privy:user-1',
      email: 'user@example.com',
      emailVerified: true,
      appAccessStatus: 'approved',
      linkedMethods: { email: ['user@example.com'], telegram: ['42'] },
      accountSignals: {
        linked: true,
        canonicalCswAddress: null,
        creatorCoin: null,
        zoraHandle: null,
        lastResolvedAt: '2026-03-23T00:00:00.000Z',
      },
      score: { points: 15, tier: 1 },
    })
    recordProviderLinkMock.mockResolvedValue(undefined)
    readTelegramMiniAppSessionMock.mockResolvedValue({
      ok: true,
      session: {
        telegramUserId: '42',
        telegramUsername: 'akita',
        chatId: '-100123',
        chatType: 'group',
        chatInstance: 'instance-1',
        initDataHash: 'a'.repeat(64),
        authDate: 1_710_000_000,
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-03-23T00:00:00.000Z',
        lastUsedAt: '2026-03-23T00:00:00.000Z',
        revokedAt: null,
      },
    })
    readTelegramLinkStartTokenStatusMock.mockReturnValue({
      ok: true,
      payload: {
        telegramUserId: '42',
        chatId: '-100123',
        issuedAt: '2026-03-23T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    })
    claimTelegramLinkStartTokenMock.mockResolvedValue({
      ok: true,
      payload: {
        telegramUserId: '42',
        chatId: '-100123',
        issuedAt: '2026-03-23T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      state: 'claimed',
    })
    readTelegramLinkStartTokenClaimMock.mockResolvedValue(null)
    finalizeTelegramLinkStartTokenConsumptionMock.mockResolvedValue('consumed')
    getTelegramLinkByUserIdMock.mockResolvedValue(null)
    runTelegramMergePreflightMock.mockResolvedValue({ ok: true })
    upsertTelegramUserLinkMock.mockResolvedValue({
      telegramUserId: '42',
      telegramUsername: 'akita',
      profileId: 11,
      privyUserId: 'did:privy:user-1',
      canonicalCswAddress: null,
      ownerVerified: false,
      linkStatus: 'pending_wallet_setup',
      linkedAt: '2026-03-23T00:00:00.000Z',
      lastVerifiedAt: '2026-03-23T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
  })

  it('completes link binding for a verified session', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        sessionToken: 'mini-session-token',
        linkToken: 'link-token-123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(recordProviderLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'telegram',
        value: '42',
      }),
    )
    expect(finalizeTelegramLinkStartTokenConsumptionMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.link?.telegramUserId).toBe('42')
  })

  it('returns idempotent success when the same Privy user already owns the Telegram link and token is already consumed', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '42',
      telegramUsername: 'akita',
      profileId: 11,
      privyUserId: 'did:privy:user-1',
      canonicalCswAddress: null,
      ownerVerified: false,
      linkStatus: 'pending_wallet_setup',
      linkedAt: '2026-03-23T00:00:00.000Z',
      lastVerifiedAt: '2026-03-23T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    claimTelegramLinkStartTokenMock.mockResolvedValueOnce({
      ok: false,
      reason: 'consumed',
    })
    readTelegramLinkStartTokenClaimMock.mockResolvedValueOnce({
      telegramUserId: '42',
      chatId: '-100123',
      privyUserId: 'did:privy:user-1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      consumedAt: '2026-03-23T00:01:00.000Z',
      createdAt: '2026-03-23T00:00:00.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        sessionToken: 'mini-session-token',
        linkToken: 'link-token-123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertTelegramUserLinkMock).toHaveBeenCalledTimes(1)
    expect(finalizeTelegramLinkStartTokenConsumptionMock).not.toHaveBeenCalled()
  })

  it('rejects cross-user token claims', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    claimTelegramLinkStartTokenMock.mockResolvedValueOnce({
      ok: false,
      reason: 'claimed_by_other_user',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        sessionToken: 'mini-session-token',
        linkToken: 'link-token-123',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED')
  })

  it('returns an explicit error when the Telegram mini app session is expired', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    readTelegramMiniAppSessionMock.mockResolvedValueOnce({
      ok: false,
      reason: 'expired',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        sessionToken: 'mini-session-token',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.code).toBe('EXPIRED_TELEGRAM_SESSION')
  })

  it('returns recovery required when merge preflight detects another account', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    runTelegramMergePreflightMock.mockResolvedValueOnce({
      ok: false,
      reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY',
      existingPrivyUserId: 'did:privy:other-user',
      existingProfileId: 22,
      existingLinkStatus: 'active',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer privy-token' },
      body: {
        sessionToken: 'mini-session-token',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED')
  })
})
