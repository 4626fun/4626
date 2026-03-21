import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq as createBaseMockReq, createMockRes } from './helpers'

const TELEGRAM_LINK_SECRET = 'test-link-secret'

type MockReqOptions = Parameters<typeof createBaseMockReq>[0]

function createMockReq(options: MockReqOptions = {}) {
  return createBaseMockReq({
    ...options,
    headers: {
      'x-telegram-link-secret': TELEGRAM_LINK_SECRET,
      ...(options.headers ?? {}),
    },
  })
}

const {
  getDbMock,
  dbSqlMock,
  ensureWaitlistSchemaMock,
  ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserIdMock,
  getTelegramLinkStatusMock,
  revokeTelegramLinkMock,
  getTelegramPortfolioSummaryMock,
  getTelegramFunnelMetricsMock,
  isTelegramFunnelEventsEnabledForChatMock,
  isTelegramFunnelMetricsEnabledMock,
  isTelegramFunnelMetricsEnabledForChatMock,
  logTelegramFunnelEventMock,
  createTelegramLinkStartTokenMock,
  claimTelegramLinkStartTokenMock,
  claimTelegramMiniAppReplayNonceMock,
  consumeTelegramLinkStartTokenMock,
  createTelegramMiniAppSessionMock,
  readTelegramMiniAppSessionMock,
  readTelegramLinkStartTokenStatusMock,
  readTelegramLinkStartTokenMock,
  upsertTelegramUserLinkMock,
  runTelegramMergePreflightMock,
  listTelegramScopedVaultsMock,
  listTelegramAuctionsMock,
  listTelegramSignalsMock,
  loadCanonicalDelegationStateMock,
  verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchemaMock,
  upsertAccountMock,
  assertNoEmailPrivyCollisionMock,
  setTelegramMyCommandsMock,
  setTelegramChatMenuButtonMock,
  resolveTelegramBotTokenMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  dbSqlMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  ensureTelegramTradingSchemaMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  getTelegramLinkStatusMock: vi.fn(),
  revokeTelegramLinkMock: vi.fn(),
  getTelegramPortfolioSummaryMock: vi.fn(),
  getTelegramFunnelMetricsMock: vi.fn(),
  isTelegramFunnelEventsEnabledForChatMock: vi.fn(),
  isTelegramFunnelMetricsEnabledMock: vi.fn(),
  isTelegramFunnelMetricsEnabledForChatMock: vi.fn(),
  logTelegramFunnelEventMock: vi.fn(),
  createTelegramLinkStartTokenMock: vi.fn(),
  claimTelegramLinkStartTokenMock: vi.fn(),
  claimTelegramMiniAppReplayNonceMock: vi.fn(),
  consumeTelegramLinkStartTokenMock: vi.fn(),
  createTelegramMiniAppSessionMock: vi.fn(),
  readTelegramMiniAppSessionMock: vi.fn(),
  readTelegramLinkStartTokenStatusMock: vi.fn(),
  readTelegramLinkStartTokenMock: vi.fn(),
  upsertTelegramUserLinkMock: vi.fn(),
  runTelegramMergePreflightMock: vi.fn(),
  listTelegramScopedVaultsMock: vi.fn(),
  listTelegramAuctionsMock: vi.fn(),
  listTelegramSignalsMock: vi.fn(),
  loadCanonicalDelegationStateMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  upsertAccountMock: vi.fn(),
  assertNoEmailPrivyCollisionMock: vi.fn(),
  setTelegramMyCommandsMock: vi.fn(),
  setTelegramChatMenuButtonMock: vi.fn(),
  resolveTelegramBotTokenMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/telegramTrading.js', () => ({
  ensureTelegramTradingSchema: ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
  getTelegramLinkStatus: getTelegramLinkStatusMock,
  revokeTelegramLink: revokeTelegramLinkMock,
  getTelegramPortfolioSummary: getTelegramPortfolioSummaryMock,
  getTelegramFunnelMetrics: getTelegramFunnelMetricsMock,
  isTelegramFunnelEventsEnabledForChat: isTelegramFunnelEventsEnabledForChatMock,
  isTelegramFunnelMetricsEnabled: isTelegramFunnelMetricsEnabledMock,
  isTelegramFunnelMetricsEnabledForChat: isTelegramFunnelMetricsEnabledForChatMock,
  logTelegramFunnelEvent: logTelegramFunnelEventMock,
  createTelegramLinkStartToken: createTelegramLinkStartTokenMock,
  claimTelegramLinkStartToken: claimTelegramLinkStartTokenMock,
  claimTelegramMiniAppReplayNonce: claimTelegramMiniAppReplayNonceMock,
  consumeTelegramLinkStartToken: consumeTelegramLinkStartTokenMock,
  createTelegramMiniAppSession: createTelegramMiniAppSessionMock,
  readTelegramMiniAppSession: readTelegramMiniAppSessionMock,
  readTelegramLinkStartTokenStatus: readTelegramLinkStartTokenStatusMock,
  readTelegramLinkStartToken: readTelegramLinkStartTokenMock,
  upsertTelegramUserLink: upsertTelegramUserLinkMock,
  runTelegramMergePreflight: runTelegramMergePreflightMock,
  listTelegramScopedVaults: listTelegramScopedVaultsMock,
  listTelegramAuctions: listTelegramAuctionsMock,
  listTelegramSignals: listTelegramSignalsMock,
}))

vi.mock('../../server/_lib/canonicalCswDelegation.js', () => ({
  loadCanonicalDelegationState: loadCanonicalDelegationStateMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaMock,
  upsertAccount: upsertAccountMock,
}))

vi.mock('../../server/_lib/identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: assertNoEmailPrivyCollisionMock,
  isIdentityRecoveryRequiredError: (error: unknown) =>
    Boolean(error) &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'IDENTITY_RECOVERY_REQUIRED' &&
    (error as { reason?: unknown }).reason === 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
}))

vi.mock('../../server/_lib/telegramBotApi.js', () => ({
  setTelegramMyCommands: setTelegramMyCommandsMock,
  setTelegramChatMenuButton: setTelegramChatMenuButtonMock,
  resolveTelegramBotToken: resolveTelegramBotTokenMock,
}))

function buildTelegramMiniAppInitData(params: {
  botToken: string
  authDate: number
  userId: string
  username?: string
}): string {
  const payload = new URLSearchParams()
  payload.set('auth_date', String(params.authDate))
  payload.set(
    'user',
    JSON.stringify({
      id: Number(params.userId),
      first_name: 'Akita',
      username: params.username ?? 'akita',
    }),
  )
  const pairs = Array.from(payload.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
  const dataCheckString = pairs.join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(params.botToken, 'utf8').digest()
  const hash = createHmac('sha256', secret).update(dataCheckString, 'utf8').digest('hex')
  payload.set('hash', hash)
  return payload.toString()
}

describe('telegram endpoint handlers', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      TELEGRAM_LINK_API_SECRET: TELEGRAM_LINK_SECRET,
      TELEGRAM_MINI_APP_URL: 'https://app.4626.fun',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_FUNNEL_METRICS_ENABLED: 'true',
      TELEGRAM_MINIAPP_SESSION_ENABLED: 'true',
    })
    dbSqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()
      if (query.includes('from profiles') && query.includes('where privy_user_id')) {
        return { rows: [] }
      }
      if (query.includes('insert into profiles')) {
        return { rows: [{ id: 11 }] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: dbSqlMock })
    ensureWaitlistSchemaMock.mockResolvedValue(undefined)
    ensureTelegramTradingSchemaMock.mockResolvedValue(undefined)
    ensureAccountsIdentitySchemaMock.mockResolvedValue(undefined)
    upsertAccountMock.mockResolvedValue(undefined)
    assertNoEmailPrivyCollisionMock.mockResolvedValue(undefined)
    getTelegramLinkStatusMock.mockImplementation(async (...args: any[]) => getTelegramLinkByUserIdMock(...args))
    isTelegramFunnelEventsEnabledForChatMock.mockReturnValue(true)
    isTelegramFunnelMetricsEnabledMock.mockReturnValue(true)
    isTelegramFunnelMetricsEnabledForChatMock.mockReturnValue(true)
    getTelegramFunnelMetricsMock.mockResolvedValue({
      windowHours: 24,
      since: '2026-03-12T00:00:00.000Z',
      chatId: '-100123',
      counts: {
        linkStart: 5,
        linkCompleteSuccess: 3,
        linkCompleteFailed: 1,
        inlineQueryAnswered: 20,
        inlineResultChosen: 8,
        inlinePmHandoff: 3,
        inlinePreparedSent: 2,
        tradeFlowStarted: 8,
        tradePreviewReady: 6,
        tradeConfirmed: 4,
        tradeConfirmFailed: 1,
      },
      conversion: {
        linkCompletionRatePct: 60,
        tradePreviewToConfirmRatePct: 66.67,
        inlineChosenRatePct: 40,
        inlineChosenToLinkStartRatePct: 62.5,
        inlineChosenToTradeFlowStartRatePct: 100,
      },
    })
    logTelegramFunnelEventMock.mockResolvedValue(undefined)
    createTelegramLinkStartTokenMock.mockReturnValue({
      token: 'token-abc',
      expiresAt: '2026-03-13T00:10:00.000Z',
    })
    claimTelegramLinkStartTokenMock.mockResolvedValue({
      ok: true,
      state: 'claimed',
      payload: {
        telegramUserId: '42',
        chatId: '-100123',
        issuedAt: '2026-03-13T00:00:00.000Z',
        expiresAt: '2026-03-13T00:10:00.000Z',
      },
    })
    claimTelegramMiniAppReplayNonceMock.mockResolvedValue(true)
    consumeTelegramLinkStartTokenMock.mockResolvedValue(true)
    createTelegramMiniAppSessionMock.mockResolvedValue({
      sessionToken: 'mini-session-token',
      expiresAt: '2026-03-13T00:10:00.000Z',
      session: {
        telegramUserId: '42',
        telegramUsername: 'akita',
        chatId: '-100123',
        chatType: null,
        chatInstance: null,
        initDataHash: 'a'.repeat(64),
        authDate: 1_710_000_000,
        expiresAt: '2026-03-13T00:10:00.000Z',
        createdAt: '2026-03-13T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
      },
    })
    readTelegramMiniAppSessionMock.mockResolvedValue({
      ok: true,
      session: {
        telegramUserId: '42',
        telegramUsername: 'akita',
        chatId: '-100123',
        chatType: null,
        chatInstance: null,
        initDataHash: 'a'.repeat(64),
        authDate: 1_710_000_000,
        expiresAt: '2026-03-13T00:10:00.000Z',
        createdAt: '2026-03-13T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
      },
    })
    readTelegramLinkStartTokenMock.mockReturnValue({
      telegramUserId: '42',
      chatId: '-100123',
      issuedAt: '2026-03-13T00:00:00.000Z',
      expiresAt: '2026-03-13T00:10:00.000Z',
    })
    readTelegramLinkStartTokenStatusMock.mockReturnValue({
      ok: true,
      payload: {
        telegramUserId: '42',
        chatId: '-100123',
        issuedAt: '2026-03-13T00:00:00.000Z',
        expiresAt: '2026-03-13T00:10:00.000Z',
      },
    })
    loadCanonicalDelegationStateMock.mockResolvedValue({
      profileId: 11,
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      canonicalSource: 'wallet_sync',
      privyIsOwner: true,
      privyEmbeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      lastCheckedAt: null,
    })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:11',
      privyUser: {
        id: 'did:privy:11',
        email: {
          address: 'akita@4626.fun',
          verified: true,
        },
      },
    })
    upsertTelegramUserLinkMock.mockResolvedValue({
      telegramUserId: '42',
      profileId: 11,
      privyUserId: 'did:privy:11',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:01.000Z',
      telegramUsername: 'akita',
      lastVerifiedAt: null,
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    runTelegramMergePreflightMock.mockResolvedValue({ ok: true })
    listTelegramScopedVaultsMock.mockResolvedValue([
      {
        vaultAddress: '0x00000000000000000000000000000000000000aa',
        creatorCoinAddress: '0x00000000000000000000000000000000000000bb',
        chainId: 8453,
        groupId: 'telegram:-100123',
        isSettled: false,
        ccaStrategyAddress: null,
      },
    ])
    listTelegramAuctionsMock.mockResolvedValue([])
    listTelegramSignalsMock.mockResolvedValue([])
    resolveTelegramBotTokenMock.mockReturnValue('test-bot-token')
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('POST /api/telegram/unlink validates telegramUserId', async () => {
    const { default: handler } = await import('../_handlers/telegram/_unlink.ts')
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('POST /api/telegram/unlink revokes an existing link', async () => {
    const { default: handler } = await import('../_handlers/telegram/_unlink.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '42',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      linkStatus: 'active',
    })
    revokeTelegramLinkMock.mockResolvedValueOnce({
      revoked: true,
      link: {
        telegramUserId: '42',
        canonicalCswAddress: '0x1111111111111111111111111111111111111111',
        linkStatus: 'revoked',
      },
    })

    const req = createMockReq({
      method: 'POST',
      body: { telegramUserId: '42' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(revokeTelegramLinkMock).toHaveBeenCalledTimes(1)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.revoked).toBe(true)
    expect(res.body?.data?.status).toBe('revoked')
  })

  it('GET /api/telegram/portfolio validates telegramUserId', async () => {
    const { default: handler } = await import('../_handlers/telegram/_portfolio.ts')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('GET /api/telegram/portfolio returns summary', async () => {
    const { default: handler } = await import('../_handlers/telegram/_portfolio.ts')
    getTelegramPortfolioSummaryMock.mockResolvedValueOnce({
      link: {
        telegramUserId: '42',
        linkStatus: 'active',
      },
      successfulActions: 3,
      buyCount: 1,
      sellCount: 1,
      bidCount: 1,
      recentActions: [],
    })

    const req = createMockReq({
      method: 'GET',
      query: { telegramUserId: '42' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(getTelegramPortfolioSummaryMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.successfulActions).toBe(3)
  })

  it('POST /api/telegram/miniapp/session verifies initData and issues session token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-session.ts')
    const req = createMockReq({
      method: 'POST',
      body: {
        initData: buildTelegramMiniAppInitData({
          botToken: 'test-bot-token',
          authDate: Math.floor(Date.now() / 1000),
          userId: '42',
        }),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(claimTelegramMiniAppReplayNonceMock).toHaveBeenCalledTimes(1)
    expect(createTelegramMiniAppSessionMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.sessionToken).toBe('mini-session-token')
  })

  it('POST /api/telegram/miniapp/session rejects invalid initData', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-session.ts')
    const req = createMockReq({
      method: 'POST',
      body: { initData: 'bad=payload' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('POST /api/telegram/miniapp/session rejects replayed initData', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-session.ts')
    claimTelegramMiniAppReplayNonceMock.mockResolvedValueOnce(false)
    const req = createMockReq({
      method: 'POST',
      body: {
        initData: buildTelegramMiniAppInitData({
          botToken: 'test-bot-token',
          authDate: Math.floor(Date.now() / 1000),
          userId: '42',
        }),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('replay')
  })

  it('POST /api/telegram/miniapp/link rejects invalid or expired token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    readTelegramLinkStartTokenStatusMock.mockReturnValueOnce({ ok: false, reason: 'invalid' })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'bad-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('POST /api/telegram/miniapp/link returns 410 for expired token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    readTelegramLinkStartTokenStatusMock.mockReturnValueOnce({ ok: false, reason: 'expired' })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'expired-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(410)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('expired')
  })

  it('POST /api/telegram/miniapp/link requires a mini app session token when enabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('session token')
  })

  it('POST /api/telegram/miniapp/link rejects mini app session user mismatch', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    readTelegramMiniAppSessionMock.mockResolvedValueOnce({
      ok: true,
      session: {
        telegramUserId: '999',
        telegramUsername: 'other',
        chatId: '-100123',
        chatType: null,
        chatInstance: null,
        initDataHash: 'a'.repeat(64),
        authDate: 1_710_000_000,
        expiresAt: '2026-03-13T00:10:00.000Z',
        createdAt: '2026-03-13T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
      },
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('mismatch')
  })

  it('POST /api/telegram/miniapp/link links telegram to canonical csw', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(loadCanonicalDelegationStateMock).toHaveBeenCalledTimes(1)
    expect(claimTelegramLinkStartTokenMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      token: 'token-abc',
      privyUserId: 'did:privy:11',
    })
    expect(consumeTelegramLinkStartTokenMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      token: 'token-abc',
      privyUserId: 'did:privy:11',
    })
    expect(upsertAccountMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      privyUserId: 'did:privy:11',
      email: 'akita@4626.fun',
      emailVerified: true,
    })
    expect(upsertTelegramUserLinkMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.linked).toBe(true)
    expect(res.body?.data?.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
  })

  it('POST /api/telegram/miniapp/link allows pending wallet setup after verified email', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    loadCanonicalDelegationStateMock.mockResolvedValueOnce(null)
    upsertTelegramUserLinkMock.mockResolvedValueOnce({
      telegramUserId: '42',
      profileId: 11,
      privyUserId: 'did:privy:11',
      canonicalCswAddress: null,
      ownerVerified: false,
      linkStatus: 'pending_wallet_setup',
      linkedAt: '2026-03-13T00:00:01.000Z',
      telegramUsername: 'akita',
      lastVerifiedAt: null,
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.linked).toBe(false)
    expect(res.body?.data?.linkStatus).toBe('pending_wallet_setup')
    expect(res.body?.data?.canonicalCswAddress).toBeNull()
  })

  it('POST /api/telegram/miniapp/link requires verified email before linking', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    verifyPrivyForAccountsMock.mockResolvedValueOnce({
      privyUserId: 'did:privy:11',
      privyUser: { id: 'did:privy:11' },
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.code).toBe('EMAIL_VERIFICATION_REQUIRED')
    expect(claimTelegramLinkStartTokenMock).toHaveBeenCalledTimes(1)
    expect(consumeTelegramLinkStartTokenMock).not.toHaveBeenCalled()
    expect(upsertTelegramUserLinkMock).not.toHaveBeenCalled()
  })

  it('POST /api/telegram/miniapp/link rejects tokens claimed by another 4626 session', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    claimTelegramLinkStartTokenMock.mockResolvedValueOnce({ ok: false, reason: 'claimed_by_other_user' })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('already in use by another 4626 session')
    expect(consumeTelegramLinkStartTokenMock).not.toHaveBeenCalled()
    expect(upsertTelegramUserLinkMock).not.toHaveBeenCalled()
  })

  it('POST /api/telegram/miniapp/link returns recovery-required on verified email collision', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    assertNoEmailPrivyCollisionMock.mockRejectedValueOnce(
      Object.assign(new Error('email collision'), {
        code: 'IDENTITY_RECOVERY_REQUIRED',
        reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
        email: 'akita@4626.fun',
      }),
    )
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_EMAIL_BOUND')
    expect(upsertTelegramUserLinkMock).not.toHaveBeenCalled()
  })

  it('POST /api/telegram/miniapp/link accepts browser requests without x-telegram-link-secret', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    const req = createBaseMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.linked).toBe(true)
  })

  it('POST /api/telegram/miniapp/link rejects linking when mini app sessions are disabled', async () => {
    const restoreSessionGate = applyEnv({
      TELEGRAM_MINIAPP_SESSION_ENABLED: 'false',
    })
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    try {
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(String(res.body?.error ?? '')).toContain('Telegram Mini App session is required')
    } finally {
      restoreSessionGate()
    }
  })

  it('POST /api/telegram/miniapp/link returns recovery-required on merge conflict', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-link.ts')
    runTelegramMergePreflightMock.mockResolvedValueOnce({
      ok: false,
      reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY',
      existingPrivyUserId: 'did:privy:other',
      existingProfileId: 999,
      existingLinkStatus: 'active',
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_TELEGRAM_BOUND')
    expect(upsertTelegramUserLinkMock).not.toHaveBeenCalled()
  })

  it('POST /api/telegram/merge-preflight returns ok when no collision exists', async () => {
    const { default: handler } = await import('../_handlers/telegram/_merge-preflight.ts')
    runTelegramMergePreflightMock.mockResolvedValueOnce({ ok: true })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { telegramUserId: '42' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ok).toBe(true)
  })

  it('POST /api/telegram/merge-preflight returns recovery-required on collision', async () => {
    const { default: handler } = await import('../_handlers/telegram/_merge-preflight.ts')
    runTelegramMergePreflightMock.mockResolvedValueOnce({
      ok: false,
      reason: 'TELEGRAM_LINKED_TO_DIFFERENT_PRIVY',
      existingPrivyUserId: 'did:privy:other',
      existingProfileId: 999,
      existingLinkStatus: 'active',
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { telegramUserId: '42' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(res.body?.code).toBe('RECOVERY_REQUIRED_TELEGRAM_BOUND')
  })

  it('GET /api/telegram/metrics returns funnel summary for a chat', async () => {
    const { default: handler } = await import('../_handlers/telegram/_metrics.ts')
    const req = createMockReq({
      method: 'GET',
      query: { chatId: '-100123', windowHours: '24' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(getTelegramFunnelMetricsMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.counts?.tradeFlowStarted).toBe(8)
    expect(res.body?.data?.counts?.inlineResultChosen).toBe(8)
    expect(res.body?.data?.conversion?.inlineChosenRatePct).toBe(40)
    expect(res.body?.data?.conversion?.tradePreviewToConfirmRatePct).toBe(66.67)
  })

  it('GET /api/telegram/metrics returns 404 when rollout flag is disabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_metrics.ts')
    isTelegramFunnelMetricsEnabledMock.mockReturnValueOnce(false)
    const req = createMockReq({
      method: 'GET',
      query: { chatId: '-100123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body?.success).toBe(false)
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('GET /api/telegram/metrics returns 403 when chat is outside rollout cohort', async () => {
    const { default: handler } = await import('../_handlers/telegram/_metrics.ts')
    isTelegramFunnelMetricsEnabledForChatMock.mockReturnValueOnce(false)
    const req = createMockReq({
      method: 'GET',
      query: { chatId: '-100123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.success).toBe(false)
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('route map registers telegram link endpoints', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    expect(await getApiHandler('telegram/miniapp/link')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/link/complete')).toBeNull()
    expect(await getApiHandler('telegram/link/start')).toBeNull()
    expect(await getApiHandler('telegram/link/status')).toBeNull()
    expect(await getApiHandler('telegram/merge-preflight')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/miniapp/session')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/discovery')).toBeNull()
    expect(await getApiHandler('telegram/inline/prepared')).toBeNull()
    expect(await getApiHandler('telegram/metrics')).toBeTypeOf('function')
  })

  it('POST /api/telegram/bot-config syncs commands and menu button', async () => {
    const { default: handler } = await import('../_handlers/telegram/_bot-config.ts')
    const req = createMockReq({
      method: 'POST',
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(setTelegramMyCommandsMock).toHaveBeenCalledTimes(3)
    expect(setTelegramChatMenuButtonMock).toHaveBeenCalledTimes(1)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.miniAppUrl).toBe('https://app.4626.fun/telegram/menu')
    expect(setTelegramChatMenuButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        menuButton: expect.objectContaining({
          type: 'web_app',
          web_app: { url: 'https://app.4626.fun/telegram/menu' },
        }),
      }),
    )
  })

  it('route map registers telegram bot config endpoint', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    expect(await getApiHandler('telegram/bot-config')).toBeTypeOf('function')
  })
})
