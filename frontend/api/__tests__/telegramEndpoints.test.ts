import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
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
  claimTelegramMiniAppReplayNonceMock,
  createTelegramMiniAppSessionMock,
  readTelegramMiniAppSessionMock,
  readTelegramLinkStartTokenStatusMock,
  readTelegramLinkStartTokenMock,
  upsertTelegramUserLinkMock,
  runTelegramMergePreflightMock,
  listTelegramScopedVaultsMock,
  listTelegramAuctionsMock,
  listTelegramSignalsMock,
  bootstrapCanonicalDelegationStateMock,
  verifyPrivyForAccountsMock,
  setTelegramMyCommandsMock,
  setTelegramChatMenuButtonMock,
  resolveTelegramBotTokenMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
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
  claimTelegramMiniAppReplayNonceMock: vi.fn(),
  createTelegramMiniAppSessionMock: vi.fn(),
  readTelegramMiniAppSessionMock: vi.fn(),
  readTelegramLinkStartTokenStatusMock: vi.fn(),
  readTelegramLinkStartTokenMock: vi.fn(),
  upsertTelegramUserLinkMock: vi.fn(),
  runTelegramMergePreflightMock: vi.fn(),
  listTelegramScopedVaultsMock: vi.fn(),
  listTelegramAuctionsMock: vi.fn(),
  listTelegramSignalsMock: vi.fn(),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
  verifyPrivyForAccountsMock: vi.fn(),
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
  claimTelegramMiniAppReplayNonce: claimTelegramMiniAppReplayNonceMock,
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
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
}))

vi.mock('../../server/_lib/accountsIdentity.js', () => ({
  verifyPrivyForAccounts: verifyPrivyForAccountsMock,
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
      TELEGRAM_LINK_API_SECRET: undefined,
      TELEGRAM_MINI_APP_URL: 'https://app.4626.fun',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_FUNNEL_METRICS_ENABLED: 'true',
      TELEGRAM_MINIAPP_SESSION_ENABLED: 'true',
    })
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    ensureWaitlistSchemaMock.mockResolvedValue(undefined)
    ensureTelegramTradingSchemaMock.mockResolvedValue(undefined)
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
    claimTelegramMiniAppReplayNonceMock.mockResolvedValue(true)
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
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      profileId: 11,
      privyUserId: 'did:privy:11',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      privyIsOwner: true,
      privyEmbeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      chainId: 8453,
    })
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:11',
      privyUser: { id: 'did:privy:11' },
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

  it('POST /api/telegram/link/start validates required telegram ids', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-start.ts')
    const req = createMockReq({
      method: 'POST',
      body: { chatId: '-100123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('POST /api/telegram/link/start returns one-time link url', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-start.ts')
    const req = createMockReq({
      method: 'POST',
      body: { telegramUserId: '42', chatId: '-100123' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramLinkStartTokenMock).toHaveBeenCalledTimes(1)
    const url = String(res.body?.data?.url ?? '')
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/continue')
    expect(parsed.searchParams.get('autologin')).toBe('1')
    const next = parsed.searchParams.get('next') ?? ''
    expect(next).toContain('/swap?')
    expect(next).toContain('tgLinkToken=token-abc')
    expect(res.body?.data?.expiresAt).toBe('2026-03-13T00:10:00.000Z')
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

  it('POST /api/telegram/link/complete rejects invalid or expired token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
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

  it('POST /api/telegram/link/complete returns 410 for expired token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
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

  it('POST /api/telegram/link/complete requires a mini app session token when enabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
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

  it('POST /api/telegram/link/complete rejects mini app session user mismatch', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
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

  it('POST /api/telegram/link/complete links telegram to canonical csw', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita', miniAppSessionToken: 'mini-session-token' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(bootstrapCanonicalDelegationStateMock).toHaveBeenCalledTimes(1)
    expect(upsertTelegramUserLinkMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.linked).toBe(true)
    expect(res.body?.data?.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
  })

  it('POST /api/telegram/link/complete returns recovery-required on merge conflict', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
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

  it('GET /api/telegram/discovery returns mini app discovery data', async () => {
    const { default: handler } = await import('../_handlers/telegram/_discovery.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '42',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      ownerVerified: true,
      linkStatus: 'active',
    })
    getTelegramPortfolioSummaryMock.mockResolvedValueOnce({
      link: { telegramUserId: '42', linkStatus: 'active' },
      successfulActions: 2,
      buyCount: 1,
      sellCount: 1,
      bidCount: 0,
      recentActions: [],
    })
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-telegram-miniapp-session': 'mini-session-token' },
      query: { limit: '6' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.linked).toBe(true)
    expect(listTelegramScopedVaultsMock).toHaveBeenCalledTimes(1)
  })

  it('GET /api/telegram/link/status returns linked false when missing', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-status.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce(null)
    const req = createMockReq({
      method: 'GET',
      query: { telegramUserId: '42' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.linked).toBe(false)
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

  it('POST /api/telegram/inline/prepared saves prepared inline message', async () => {
    const { default: handler } = await import('../_handlers/telegram/_inline-prepared.ts')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: 'prepared-inline-1' } }),
      }),
    )

    try {
      const req = createMockReq({
        method: 'POST',
        body: {
          telegramUserId: '42',
          chatId: '-100123',
          command: '/buy',
          title: 'One tap buy',
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.preparedInlineMessageId).toBe('prepared-inline-1')
      expect(res.body?.data?.switchInlineQuery).toBe('buy')
      expect(String((fetch as any).mock.calls[0][0])).toContain('/savePreparedInlineMessage')
      expect(logTelegramFunnelEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'inline_prepared_sent',
        }),
      )
    } finally {
      vi.unstubAllGlobals()
    }
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
    expect(await getApiHandler('telegram/link/start')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/link/complete')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/link/status')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/merge-preflight')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/miniapp/session')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/discovery')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/inline/prepared')).toBeTypeOf('function')
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
  })

  it('route map registers telegram bot config endpoint', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    expect(await getApiHandler('telegram/bot-config')).toBeTypeOf('function')
  })
})

