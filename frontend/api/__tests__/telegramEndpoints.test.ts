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
  claimTelegramMiniAppReplayNonceMock,
  createTelegramMiniAppSessionMock,
  findReusableTelegramMiniAppSessionMock,
  listTelegramScopedVaultsMock,
  listTelegramAuctionsMock,
  listTelegramSignalsMock,
  ensureAccountsIdentitySchemaMock,
  upsertAccountMock,
  setTelegramMyCommandsMock,
  setTelegramChatMenuButtonMock,
  resolveTelegramBotTokenMock,
  trackTelegramLinkEventMock,
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
  claimTelegramMiniAppReplayNonceMock: vi.fn(),
  createTelegramMiniAppSessionMock: vi.fn(),
  findReusableTelegramMiniAppSessionMock: vi.fn(),
  listTelegramScopedVaultsMock: vi.fn(),
  listTelegramAuctionsMock: vi.fn(),
  listTelegramSignalsMock: vi.fn(),
  ensureAccountsIdentitySchemaMock: vi.fn(),
  upsertAccountMock: vi.fn(),
  setTelegramMyCommandsMock: vi.fn(),
  setTelegramChatMenuButtonMock: vi.fn(),
  resolveTelegramBotTokenMock: vi.fn(),
  trackTelegramLinkEventMock: vi.fn(),
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
  claimTelegramMiniAppReplayNonce: claimTelegramMiniAppReplayNonceMock,
  createTelegramMiniAppSession: createTelegramMiniAppSessionMock,
  findReusableTelegramMiniAppSession: findReusableTelegramMiniAppSessionMock,
  listTelegramScopedVaults: listTelegramScopedVaultsMock,
  listTelegramAuctions: listTelegramAuctionsMock,
  listTelegramSignals: listTelegramSignalsMock,
}))

vi.mock('../../server/_lib/telegramBotApi.js', () => ({
  setTelegramMyCommands: setTelegramMyCommandsMock,
  setTelegramChatMenuButton: setTelegramChatMenuButtonMock,
  resolveTelegramBotToken: resolveTelegramBotTokenMock,
}))

vi.mock('../../server/_lib/telegramLinkTelemetry.js', () => ({
  trackTelegramLinkEvent: trackTelegramLinkEventMock,
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
      TELEGRAM_MINI_APP_URL: 'https://v1.4626.fun',
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
    findReusableTelegramMiniAppSessionMock.mockResolvedValue({
      telegramUserId: '42',
      telegramUsername: 'akita',
      chatId: null,
      chatType: null,
      chatInstance: null,
      initDataHash: 'a'.repeat(64),
      authDate: 1_710_000_000,
      expiresAt: '2026-03-13T00:10:00.000Z',
      createdAt: '2026-03-13T00:00:00.000Z',
      lastUsedAt: null,
      revokedAt: null,
    })
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
    expect(ensureWaitlistSchemaMock).not.toHaveBeenCalled()
    expect(claimTelegramMiniAppReplayNonceMock).toHaveBeenCalledTimes(1)
    expect(createTelegramMiniAppSessionMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.sessionToken).toBe('mini-session-token')
    expect(trackTelegramLinkEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_miniapp_session_result',
        status: 'succeeded',
      }),
    )
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
    findReusableTelegramMiniAppSessionMock.mockResolvedValueOnce(null)
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
    expect(trackTelegramLinkEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_miniapp_session_result',
        status: 'failed',
        payload: expect.objectContaining({
          reason: 'replay_detected',
        }),
      }),
    )
  })

  it('POST /api/telegram/miniapp/session recovers replayed initData when a matching session already exists', async () => {
    const { default: handler } = await import('../_handlers/telegram/_miniapp-session.ts')
    claimTelegramMiniAppReplayNonceMock.mockResolvedValueOnce(false)
    findReusableTelegramMiniAppSessionMock.mockResolvedValueOnce({
      telegramUserId: '42',
      telegramUsername: 'akita',
      chatId: null,
      chatType: null,
      chatInstance: null,
      initDataHash: 'a'.repeat(64),
      authDate: 1_710_000_000,
      expiresAt: '2026-03-13T00:10:00.000Z',
      createdAt: '2026-03-13T00:00:00.000Z',
      lastUsedAt: null,
      revokedAt: null,
    })
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
    expect(findReusableTelegramMiniAppSessionMock).toHaveBeenCalledTimes(1)
    expect(createTelegramMiniAppSessionMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.sessionToken).toBe('mini-session-token')
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

  it('POST /api/telegram/link/telemetry accepts telegram link events', async () => {
    const { default: handler } = await import('../_handlers/telegram/_link-telemetry.ts')
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'telegram_link_state_transition',
        flowId: 'flow-1',
        phase: 'collect_email',
        status: 'transition',
        fromTag: 'verify_telegram_session',
        toTag: 'collect_email',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(trackTelegramLinkEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'telegram_link_state_transition',
        flowId: 'flow-1',
        phase: 'collect_email',
        status: 'transition',
        payload: expect.objectContaining({
          fromTag: 'verify_telegram_session',
          toTag: 'collect_email',
        }),
      }),
    )
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

  it('route map registers active telegram endpoints', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    const { getTelegramApiHandler } = await import('../_handlers/_routes.telegram.ts')
    expect(await getApiHandler('telegram/miniapp/link')).toBeNull()
    expect(await getApiHandler('telegram/link/complete')).toBeNull()
    expect(await getApiHandler('telegram/link/start')).toBeNull()
    expect(await getApiHandler('telegram/link/status')).toBeNull()
    expect(await getApiHandler('telegram/merge-preflight')).toBeNull()
    expect(await getApiHandler('telegram/miniapp/session')).toBeNull()
    expect(await getApiHandler('telegram/discovery')).toBeNull()
    expect(await getApiHandler('telegram/inline/prepared')).toBeNull()
    expect(await getApiHandler('telegram/metrics')).toBeNull()
    expect(await getTelegramApiHandler('miniapp/link')).toBeNull()
    expect(await getTelegramApiHandler('merge-preflight')).toBeNull()
    expect(await getTelegramApiHandler('link/complete')).toBeTypeOf('function')
    expect(await getTelegramApiHandler('link/telemetry')).toBeTypeOf('function')
    expect(await getTelegramApiHandler('miniapp/session')).toBeTypeOf('function')
    expect(await getTelegramApiHandler('metrics')).toBeTypeOf('function')
    expect(await getTelegramApiHandler('watch-tick')).toBeNull()
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
    expect(res.body?.data?.miniAppUrl).toBe('https://v1.4626.fun/telegram/menu')
    expect(setTelegramChatMenuButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        menuButton: expect.objectContaining({
          type: 'web_app',
          web_app: { url: 'https://v1.4626.fun/telegram/menu' },
        }),
      }),
    )
  })

  it('route map registers telegram bot config endpoint', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    const { getTelegramApiHandler } = await import('../_handlers/_routes.telegram.ts')
    expect(await getApiHandler('telegram/bot-config')).toBeNull()
    expect(await getTelegramApiHandler('bot-config')).toBeTypeOf('function')
  })
})
