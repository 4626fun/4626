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
  readTelegramLinkStartTokenStatusMock,
  readTelegramLinkStartTokenMock,
  upsertTelegramUserLinkMock,
  bootstrapCanonicalDelegationStateMock,
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
  readTelegramLinkStartTokenStatusMock: vi.fn(),
  readTelegramLinkStartTokenMock: vi.fn(),
  upsertTelegramUserLinkMock: vi.fn(),
  bootstrapCanonicalDelegationStateMock: vi.fn(),
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
  readTelegramLinkStartTokenStatus: readTelegramLinkStartTokenStatusMock,
  readTelegramLinkStartToken: readTelegramLinkStartTokenMock,
  upsertTelegramUserLink: upsertTelegramUserLinkMock,
}))

vi.mock('../../server/_lib/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
}))

vi.mock('../../server/_lib/telegramBotApi.js', () => ({
  setTelegramMyCommands: setTelegramMyCommandsMock,
  setTelegramChatMenuButton: setTelegramChatMenuButtonMock,
  resolveTelegramBotToken: resolveTelegramBotTokenMock,
}))

describe('telegram endpoint handlers', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      TELEGRAM_LINK_API_SECRET: undefined,
      TELEGRAM_MINI_APP_URL: 'https://app.4626.fun',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_FUNNEL_METRICS_ENABLED: 'true',
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
        tradeFlowStarted: 8,
        tradePreviewReady: 6,
        tradeConfirmed: 4,
        tradeConfirmFailed: 1,
      },
      conversion: {
        linkCompletionRatePct: 60,
        tradePreviewToConfirmRatePct: 66.67,
      },
    })
    logTelegramFunnelEventMock.mockResolvedValue(undefined)
    createTelegramLinkStartTokenMock.mockReturnValue({
      token: 'token-abc',
      expiresAt: '2026-03-13T00:10:00.000Z',
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

  it('POST /api/telegram/link/complete links telegram to canonical csw', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-complete.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-privy-token': 'privy-token' },
      body: { token: 'token-abc', telegramUsername: 'akita' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(bootstrapCanonicalDelegationStateMock).toHaveBeenCalledTimes(1)
    expect(upsertTelegramUserLinkMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.linked).toBe(true)
    expect(res.body?.data?.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
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
    expect(await getApiHandler('telegram/link/start')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/link/complete')).toBeTypeOf('function')
    expect(await getApiHandler('telegram/link/status')).toBeTypeOf('function')
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

