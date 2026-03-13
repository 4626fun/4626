import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  handleKeeprCommandMock,
  handleTwitterCommandMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  ensureKeeprSchemaMock,
  createTelegramLinkStartTokenMock,
  createTelegramActionTokenMock,
  consumeTelegramActionTokenMock,
  ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserIdMock,
  getTelegramPortfolioSummaryMock,
  listTelegramAuctionsMock,
  listTelegramScopedVaultsMock,
  listTelegramSignalsMock,
  listTelegramUserBidsMock,
  getTelegramChatTradePolicyMock,
  revokeTelegramLinkMock,
  logTelegramActionAuditMock,
  privyGetUserByIdMock,
  createPublicClientMock,
  resolvePrivyCoinbaseSmartWalletOwnerContextMock,
  sendPrivyCoinbaseSmartWalletUserOperationMock,
} = vi.hoisted(() => ({
  handleKeeprCommandMock: vi.fn(),
  handleTwitterCommandMock: vi.fn(),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  ensureKeeprSchemaMock: vi.fn(),
  createTelegramLinkStartTokenMock: vi.fn(),
  createTelegramActionTokenMock: vi.fn(),
  consumeTelegramActionTokenMock: vi.fn(),
  ensureTelegramTradingSchemaMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  getTelegramPortfolioSummaryMock: vi.fn(),
  listTelegramAuctionsMock: vi.fn(),
  listTelegramScopedVaultsMock: vi.fn(),
  listTelegramSignalsMock: vi.fn(),
  listTelegramUserBidsMock: vi.fn(),
  getTelegramChatTradePolicyMock: vi.fn(),
  revokeTelegramLinkMock: vi.fn(),
  logTelegramActionAuditMock: vi.fn(),
  privyGetUserByIdMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  resolvePrivyCoinbaseSmartWalletOwnerContextMock: vi.fn(),
  sendPrivyCoinbaseSmartWalletUserOperationMock: vi.fn(),
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    getUserById = privyGetUserByIdMock
  },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
  }
})

vi.mock('../../server/_lib/privyCoinbaseSmartWallet.js', () => ({
  isCoinbaseSmartWalletHelperError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && typeof (error as any).code === 'string' && typeof (error as any).retryable === 'boolean'),
  resolvePrivyCoinbaseSmartWalletOwnerContext: resolvePrivyCoinbaseSmartWalletOwnerContextMock,
  sendPrivyCoinbaseSmartWalletUserOperation: sendPrivyCoinbaseSmartWalletUserOperationMock,
}))

vi.mock('../../server/keepr/commands.js', () => ({
  handleKeeprCommand: handleKeeprCommandMock,
}))

vi.mock('../../server/twitter/commands.js', () => ({
  handleTwitterCommand: handleTwitterCommandMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: () => true,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../../server/_lib/telegramTrading.js', () => ({
  createTelegramLinkStartToken: createTelegramLinkStartTokenMock,
  createTelegramActionToken: createTelegramActionTokenMock,
  consumeTelegramActionToken: consumeTelegramActionTokenMock,
  ensureTelegramTradingSchema: ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
  getTelegramPortfolioSummary: getTelegramPortfolioSummaryMock,
  listTelegramAuctions: listTelegramAuctionsMock,
  listTelegramScopedVaults: listTelegramScopedVaultsMock,
  listTelegramSignals: listTelegramSignalsMock,
  listTelegramUserBids: listTelegramUserBidsMock,
  getTelegramChatTradePolicy: getTelegramChatTradePolicyMock,
  revokeTelegramLink: revokeTelegramLinkMock,
  logTelegramActionAudit: logTelegramActionAuditMock,
}))

describe('telegram webhook handler', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    getDbMock.mockResolvedValue({ sql: vi.fn(async () => ({ rows: [] })) })
    ensureWaitlistSchemaMock.mockResolvedValue(undefined)
    ensureKeeprSchemaMock.mockResolvedValue(undefined)
    ensureTelegramTradingSchemaMock.mockResolvedValue(undefined)
    createTelegramLinkStartTokenMock.mockReturnValue({
      token: 'link-token',
      expiresAt: '2026-03-13T00:10:00.000Z',
    })
    createTelegramActionTokenMock.mockResolvedValue({
      token: 'trade-token',
      expiresAt: '2026-03-13T00:01:30.000Z',
    })
    consumeTelegramActionTokenMock.mockResolvedValue({ ok: false, reason: 'not_found' })
    getTelegramLinkByUserIdMock.mockResolvedValue(null)
    getTelegramPortfolioSummaryMock.mockResolvedValue(null)
    listTelegramAuctionsMock.mockResolvedValue([])
    listTelegramScopedVaultsMock.mockResolvedValue([
      {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        chainId: 8453,
        groupId: 'xmtp-group-1',
        isSettled: false,
        ccaStrategyAddress: '0x3333333333333333333333333333333333333333',
      },
    ])
    listTelegramSignalsMock.mockResolvedValue([])
    listTelegramUserBidsMock.mockResolvedValue([])
    getTelegramChatTradePolicyMock.mockResolvedValue({
      buySellEnabled: true,
      bidEnabled: true,
    })
    revokeTelegramLinkMock.mockResolvedValue({ revoked: false, link: null })
    logTelegramActionAuditMock.mockResolvedValue(undefined)
    privyGetUserByIdMock.mockResolvedValue({
      id: 'did:privy:7',
      linkedAccounts: [
        {
          type: 'wallet',
          chainType: 'ethereum',
          walletClientType: 'privy',
          walletId: 'wallet_embedded_1',
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    })
    createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async ({ functionName }: any) => {
        if (functionName === 'getAuctionStatus') {
          return [
            '0x4444444444444444444444444444444444444444',
            true,
            false,
            1_000_000_000_000n,
            0n,
          ]
        }
        if (functionName === 'auctionToken') {
          return '0x7777777777777777777777777777777777777777'
        }
        if (functionName === 'decimals') {
          return 18
        }
        if (functionName === 'symbol') {
          return 'VAULTX'
        }
        return 0n
      }),
    })
    resolvePrivyCoinbaseSmartWalletOwnerContextMock.mockResolvedValue({
      ownerAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ownerIndex: 0,
    })
    sendPrivyCoinbaseSmartWalletUserOperationMock.mockResolvedValue({
      userOpHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
      txHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
      smartWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ownerIndex: 0,
    })
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_TARGET_CHAT_ID: '-100123',
      TELEGRAM_WEBHOOK_SECRET: 'top-secret',
      TELEGRAM_ADMIN_USER_IDS: '42',
      TELEGRAM_DEFAULT_SENDER_WALLET: '0x00000000000000000000000000000000000000aa',
      TELEGRAM_GROUP_ID_MAP_JSON: JSON.stringify({ '-100123': 'xmtp-group-1' }),
      PRIVY_APP_ID: 'privy-app',
      PRIVY_APP_SECRET: 'privy-secret',
      CDP_PAYMASTER_URL: 'https://bundler.example.test',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 401 when webhook secret does not match', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
      body: {
        update_id: 1,
        message: { message_id: 7, text: '/help', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('routes /x commands to twitter handler and sends telegram reply', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleTwitterCommandMock.mockResolvedValueOnce({ ok: true, response: 'Tweet posted.' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 2,
        message: { message_id: 8, text: '/x post hello --confirm', chat: { id: -100123 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleTwitterCommandMock).toHaveBeenCalledTimes(1)
    expect(handleTwitterCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post hello --confirm',
      role: 'ADMIN',
    })
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()

    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/sendMessage')
  })

  it('routes normal commands to keepr handler', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr commands...' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3,
        message: { message_id: 9, text: '/help', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help',
    })
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
    const callbackButtons = payload.reply_markup.inline_keyboard.flat()
    expect(callbackButtons.some((button: any) => button?.callback_data === 'help:market')).toBe(true)
    expect(
      callbackButtons.some(
        (button: any) => typeof button?.url === 'string' && String(button.url).includes('chatAction=vault-status'),
      ),
    ).toBe(true)
  })

  it('maps /start in DM to help and returns the help menu keyboard', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr quick help' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_1,
        message: { message_id: 91, text: '/start', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:7726886643',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help',
    })
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
    const buttons = payload.reply_markup.inline_keyboard.flat()
    expect(
      buttons.some(
        (button: any) =>
          typeof button?.web_app?.url === 'string' && String(button.web_app.url).includes('chatAction=ai-assistant'),
      ),
    ).toBe(true)
  })

  it('normalizes /help@botname to /help and still returns help menu keyboard', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr quick help' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_3,
        message: { message_id: 93, text: '/help@akitai_bot', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'telegram:7726886643',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help',
    })
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
  })

  it('returns the help menu keyboard for /keepr help too', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr quick help' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_2,
        message: { message_id: 92, text: '/keepr help', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/keepr help',
    })
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
  })

  it('ignores bot-authored updates to prevent reply loops', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 4,
        message: {
          message_id: 10,
          text: '/help',
          chat: { id: -100123 },
          from: { id: 42, is_bot: true },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('answers inline queries with prefill command templates', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5,
        inline_query: {
          id: 'iq-1',
          from: { id: 42 },
          query: 'ship update',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerInlineQuery')

    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(payload.inline_query_id).toBe('iq-1')
    expect(Array.isArray(payload.results)).toBe(true)
    const resultTexts = payload.results
      .map((entry: any) => String(entry?.input_message_content?.message_text ?? ''))
      .filter(Boolean)
      .join('\n')
    expect(resultTexts).toContain('/x post ship update --confirm')
    expect(resultTexts).toContain('/help')
  })

  it('answers inline query with reusable trade command result', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_1,
        inline_query: {
          id: 'iq-trade',
          from: { id: 42 },
          query: '/buy 0x2222222222222222222222222222222222222222 0.05 --confirm',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(payload.inline_query_id).toBe('iq-trade')
    expect(Array.isArray(payload.results)).toBe(true)
    const first = payload.results[0]
    expect(String(first?.title ?? '')).toContain('Reuse BUY')
    expect(String(first?.input_message_content?.message_text ?? '')).toBe(
      '/buy 0x2222222222222222222222222222222222222222 0.05 --confirm',
    )
  })

  it('personalizes inline results for unlinked users with a /link shortcut', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce(null)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_2,
        inline_query: {
          id: 'iq-link-state',
          from: { id: 777 },
          query: 'start trading',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    const resultTexts = payload.results
      .map((entry: any) => String(entry?.input_message_content?.message_text ?? ''))
      .filter(Boolean)
    expect(resultTexts.some((text: string) => text.startsWith('/link'))).toBe(true)
  })

  it('adds scoped vault shortcuts to inline results and keeps deterministic caps', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    listTelegramScopedVaultsMock.mockResolvedValueOnce([
      {
        vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        creatorCoinAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        groupId: 'g1',
        isSettled: false,
        ccaStrategyAddress: '0x3333333333333333333333333333333333333333',
      },
      {
        vaultAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        chainId: 8453,
        groupId: 'g2',
        isSettled: false,
        ccaStrategyAddress: null,
      },
      {
        vaultAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        creatorCoinAddress: '0x4444444444444444444444444444444444444444',
        chainId: 8453,
        groupId: 'g3',
        isSettled: false,
        ccaStrategyAddress: '0x5555555555555555555555555555555555555555',
      },
    ])

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_3,
        inline_query: {
          id: 'iq-scoped-vaults',
          from: { id: 99 },
          query: 'vault picks',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.results)).toBe(true)
    expect(payload.results.length).toBeLessThanOrEqual(8)
    const resultTexts = payload.results
      .map((entry: any) => String(entry?.input_message_content?.message_text ?? ''))
      .filter(Boolean)
    expect(resultTexts.some((text: string) => text.includes('/buy 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0.05 --confirm'))).toBe(true)
  })

  it('returns inline shortcut launcher with prefill buttons', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 6,
        message: {
          message_id: 11,
          text: '/inline',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/sendMessage')
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(payload.reply_markup?.inline_keyboard?.length).toBeGreaterThan(0)
    const allButtons = payload.reply_markup.inline_keyboard.flat()
    expect(allButtons.some((button: any) => typeof button.switch_inline_query_current_chat === 'string')).toBe(true)
  })

  it('allows admin private DM even when target chat is set', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr commands...' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7,
        message: {
          message_id: 12,
          text: '/help',
          chat: { id: 7726886643 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/sendMessage')
  })

  it('keeps non-admin private DM blocked when target chat is set', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 8,
        message: {
          message_id: 13,
          text: '/help',
          chat: { id: 7726886643 },
          from: { id: 999 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(0)
    expect(res.body?.data?.ignored).toBe(true)
  })

  it('retries sendMessage without reply target when Telegram rejects reply_to_message_id', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr commands...' })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"ok":false,"error_code":400,"description":"Bad Request: message to be replied not found"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 9,
        message: {
          message_id: 777,
          text: '/help',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(2)

    const firstPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    const secondPayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(firstPayload.reply_to_message_id).toBe(777)
    expect(secondPayload.reply_to_message_id).toBeUndefined()
  })

  it('handles callback query for help topic and responds with topic help', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr help - market\n- /mkt quote <symbol>' })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 10,
        callback_query: {
          id: 'cbq-1',
          data: 'help:market',
          from: { id: 99 },
          message: { message_id: 14, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help market',
    })

    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('- `/mkt quote` <symbol>')
    expect(String(payload.text ?? '')).toContain('symbol: ticker, e.g. BTC')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:help')).toBe(true)
  })

  it('handles callback query for inline launcher and returns prefill keyboard', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 11,
        callback_query: {
          id: 'cbq-2',
          data: 'help:inline',
          from: { id: 99 },
          message: { message_id: 15, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.some((button: any) => typeof button.switch_inline_query_current_chat === 'string')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:help')).toBe(true)
  })

  it('handles /linked as a telegram-native command without delegating to keepr', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12,
        message: { message_id: 16, text: '/linked', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Link Status')
  })

  it('handles /portfolio as a telegram-native command without delegating to keepr', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13,
        message: { message_id: 17, text: '/portfolio', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Portfolio')
  })

  it('handles callback query for telegram-native portfolio menu action', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 14,
        callback_query: {
          id: 'cbq-portfolio',
          data: 'menu:portfolio',
          from: { id: 99 },
          message: { message_id: 18, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Portfolio')
  })

  it('accepts callbacks in configured signals chat even when target chat differs', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreSignalsEnv = applyEnv({
      TELEGRAM_TARGET_CHAT_ID: '-100123',
      TELEGRAM_SIGNALS_CHAT_ID: '-100999',
    })
    try {
      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 14_1,
          callback_query: {
            id: 'cbq-signals-portfolio',
            data: 'menu:portfolio',
            from: { id: 99 },
            message: { message_id: 18, chat: { id: -100999 } },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect((fetch as any).mock.calls.length).toBe(2)
      expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
      expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
      const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
      expect(String(payload.text ?? '')).toContain('Portfolio')
    } finally {
      restoreSignalsEnv()
    }
  })

  it('blocks buy preview when chat scope disables buy and sell', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramChatTradePolicyMock.mockResolvedValueOnce({
      buySellEnabled: false,
      bidEnabled: true,
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 14_2,
        message: {
          message_id: 18,
          text: '/buy 0x1111111111111111111111111111111111111111 0.05 --confirm',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramActionTokenMock).not.toHaveBeenCalled()
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('buy/sell disabled')
  })

  it('blocks bid preview when chat scope disables bid', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramChatTradePolicyMock.mockResolvedValueOnce({
      buySellEnabled: true,
      bidEnabled: false,
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 14_3,
        message: {
          message_id: 18,
          text: '/bid 0x1111111111111111111111111111111111111111 $250 --confirm',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramActionTokenMock).not.toHaveBeenCalled()
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('bid disabled')
  })

  it('blocks trade preview when membership check is required and user is not a member', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreMembershipEnv = applyEnv({
      TELEGRAM_REQUIRE_TRADE_MEMBERSHIP: 'true',
    })
    try {
      getTelegramLinkByUserIdMock.mockResolvedValueOnce({
        telegramUserId: '99',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })

      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { status: 'left' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 14_4,
          message: {
            message_id: 18,
            text: '/buy 0x1111111111111111111111111111111111111111 0.05 --confirm',
            chat: { id: -100123 },
            from: { id: 99 },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(String((fetch as any).mock.calls[0][0])).toContain('/getChatMember')
      expect(createTelegramActionTokenMock).not.toHaveBeenCalled()
      const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
      expect(String(payload.text ?? '').toLowerCase()).toContain('membership')
    } finally {
      restoreMembershipEnv()
    }
  })

  it('rate-limits trade previews per user with structured reject reason', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreRateLimitEnv = applyEnv({
      TELEGRAM_TRADE_USER_RATE_LIMIT_PER_MIN: '1',
      TELEGRAM_TRADE_CHAT_RATE_LIMIT_PER_MIN: '100',
    })
    try {
      getTelegramLinkByUserIdMock.mockResolvedValue({
        telegramUserId: '1999',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })

      const firstReq = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 14_5,
          message: {
            message_id: 18,
            text: '/buy 0x1111111111111111111111111111111111111111 0.05 --confirm',
            chat: { id: -100123 },
            from: { id: 1999 },
          },
        },
      })
      const firstRes = createMockRes()
      await handler(firstReq, firstRes)

      const secondReq = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 14_6,
          message: {
            message_id: 19,
            text: '/buy 0x1111111111111111111111111111111111111111 0.06 --confirm',
            chat: { id: -100123 },
            from: { id: 1999 },
          },
        },
      })
      const secondRes = createMockRes()
      await handler(secondReq, secondRes)

      expect(firstRes.statusCode).toBe(200)
      expect(secondRes.statusCode).toBe(200)
      expect((fetch as any).mock.calls.length).toBe(2)
      const secondPayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
      expect(String(secondPayload.text ?? '')).toContain('rate_limit_user')
    } finally {
      restoreRateLimitEnv()
    }
  })

  it('renders buy preview with signed confirm callback token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    createTelegramActionTokenMock.mockResolvedValueOnce({
      token: 'trade-token-1',
      expiresAt: '2026-03-13T00:01:30.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 15,
        message: {
          message_id: 19,
          text: '/buy 0x1111111111111111111111111111111111111111 0.05 --confirm',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Preview: BUY')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    expect(Array.isArray(keyboard)).toBe(true)
    expect(keyboard.length).toBe(2)
    expect(String(keyboard?.[0]?.[0]?.callback_data ?? '')).toContain('trade:confirm:trade-token-1')
    const secondaryButtons = (keyboard?.[1] ?? []) as Array<any>
    expect(secondaryButtons.some((button: any) => String(button?.text ?? '').trim() === 'Edit Amount')).toBe(true)
    expect(secondaryButtons.some((button: any) => String(button?.text ?? '').trim() === 'Cancel')).toBe(true)
  })

  it('renders bid preview with live auction context and drift safety note', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    createTelegramActionTokenMock.mockResolvedValueOnce({
      token: 'trade-token-bid-preview',
      expiresAt: '2026-03-13T00:01:30.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 15_1,
        message: {
          message_id: 19_1,
          text: '/bid 0x1111111111111111111111111111111111111111 $250 --confirm',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Preview: BID')
    expect(String(payload.text ?? '')).toContain('Auction:')
    expect(String(payload.text ?? '')).toContain('Max price cap:')
    expect(String(payload.text ?? '')).toContain('>3% drift')
  })

  it('confirms buy callback via canonical CSW sender and logs audit', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'buy',
      intentPayload: {
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        amountInput: '0.05',
        amountEth: 0.05,
        usdEstimate: 150,
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Coin buy submitted.' })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 16,
        callback_query: {
          id: 'cbq-buy-confirm',
          data: 'trade:confirm:trade-token-1',
          from: { id: 99 },
          message: { message_id: 20, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      text: '/coin buy 0x2222222222222222222222222222222222222222 0.05',
    })
    expect(logTelegramActionAuditMock).toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(3)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    const callbackAckPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(callbackAckPayload.text ?? '')).toContain('BUY sent')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Confirmed BUY request')
    const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • BUY')
    expect(String(signalPayload.text ?? '')).toContain('Copy: `/buy 0x2222222222222222222222222222222222222222 0.05 --confirm`')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Reuse Buy' &&
          String(button?.copy_text?.text ?? '').trim() ===
          '/buy 0x2222222222222222222222222222222222222222 0.05 --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Edit Amount' &&
          String(button?.switch_inline_query_current_chat ?? '').trim() ===
          '/buy 0x2222222222222222222222222222222222222222 <new-eth-amount> --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) => String(button?.text ?? '').trim() === 'Open Portfolio' && String(button?.callback_data ?? '') === 'menu:portfolio',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'View Vault' &&
          String(button?.url ?? '').includes('/vault/0x2222222222222222222222222222222222222222'),
      ),
    ).toBe(true)
  })

  it('adds Stars tip buttons to signal posts when tips are enabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreTipEnv = applyEnv({
      TELEGRAM_STARS_TIPS_ENABLED: 'true',
      TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS: '-100123',
    })
    try {
      consumeTelegramActionTokenMock.mockResolvedValueOnce({
        ok: true,
        actionType: 'buy',
        intentPayload: {
          creatorCoinAddress: '0x2222222222222222222222222222222222222222',
          amountInput: '0.05',
          amountEth: 0.05,
          usdEstimate: 150,
        },
        expiresAt: '2026-03-13T00:01:30.000Z',
        consumedAt: '2026-03-13T00:00:32.000Z',
      })
      getTelegramLinkByUserIdMock.mockResolvedValueOnce({
        telegramUserId: '99',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })
      handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Coin buy submitted.' })

      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_03,
          callback_query: {
            id: 'cbq-buy-confirm-tip-buttons',
            data: 'trade:confirm:trade-token-tip',
            from: { id: 99 },
            message: { message_id: 20, chat: { id: -100123 } },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
      const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
      expect(signalButtons.some((button: any) => String(button?.callback_data ?? '') === 'tip:1:signal-buy')).toBe(true)
      expect(signalButtons.some((button: any) => String(button?.callback_data ?? '') === 'tip:5:signal-buy')).toBe(true)
    } finally {
      restoreTipEnv()
    }
  })

  it('falls back to switch-inline reuse shortcut when copy_text is disabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreCopyEnv = applyEnv({ TELEGRAM_COPY_TEXT_BUTTONS: 'false' })
    try {
      consumeTelegramActionTokenMock.mockResolvedValueOnce({
        ok: true,
        actionType: 'buy',
        intentPayload: {
          creatorCoinAddress: '0x2222222222222222222222222222222222222222',
          amountInput: '0.05',
          amountEth: 0.05,
          usdEstimate: 150,
        },
        expiresAt: '2026-03-13T00:01:30.000Z',
        consumedAt: '2026-03-13T00:00:32.000Z',
      })
      getTelegramLinkByUserIdMock.mockResolvedValueOnce({
        telegramUserId: '99',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })
      handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Coin buy submitted.' })

      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_01_2,
          callback_query: {
            id: 'cbq-buy-confirm-fallback',
            data: 'trade:confirm:trade-token-copy-fallback',
            from: { id: 99 },
            message: { message_id: 20, chat: { id: -100123 } },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
      const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Reuse Buy' &&
            String(button?.switch_inline_query_current_chat ?? '').trim() ===
              '/buy 0x2222222222222222222222222222222222222222 0.05 --confirm',
        ),
      ).toBe(true)
    } finally {
      restoreCopyEnv()
    }
  })

  it('confirms sell callback and emits sell-specific signal shortcuts', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'sell',
      intentPayload: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        amountInput: '1200',
        amountEth: 0,
        usdEstimate: 1200,
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Coin sell submitted.' })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 16_02,
        callback_query: {
          id: 'cbq-sell-confirm',
          data: 'trade:confirm:trade-token-sell',
          from: { id: 99 },
          message: { message_id: 24, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith({
      groupId: 'xmtp-group-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      text: '/coin sell 0x2222222222222222222222222222222222222222 1200',
    })
    expect((fetch as any).mock.calls.length).toBe(3)
    const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • SELL')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Reuse Sell' &&
          String(button?.copy_text?.text ?? '').trim() ===
          '/sell 0x1111111111111111111111111111111111111111 1200 --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Edit Amount' &&
          String(button?.switch_inline_query_current_chat ?? '').trim() ===
          '/sell 0x1111111111111111111111111111111111111111 <new-share-amount> --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'View Vault' &&
          String(button?.url ?? '').includes('/vault/0x1111111111111111111111111111111111111111'),
      ),
    ).toBe(true)
  })

  it('handles tip callback by sending a Telegram Stars invoice', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreTipEnv = applyEnv({
      TELEGRAM_STARS_TIPS_ENABLED: 'true',
      TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS: '-100123',
    })
    try {
      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_04,
          callback_query: {
            id: 'cbq-tip-stars',
            data: 'tip:5:signal-buy',
            from: { id: 99 },
            message: { message_id: 25, chat: { id: -100123 } },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect((fetch as any).mock.calls.length).toBe(2)
      expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
      expect(String((fetch as any).mock.calls[1][0])).toContain('/sendInvoice')
      const invoicePayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
      expect(invoicePayload.currency).toBe('XTR')
      expect(Array.isArray(invoicePayload.prices)).toBe(true)
      expect(invoicePayload.prices[0]?.amount).toBe(5)
    } finally {
      restoreTipEnv()
    }
  })

  it('answers pre-checkout queries for Stars tips', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreTipEnv = applyEnv({
      TELEGRAM_STARS_TIPS_ENABLED: 'true',
      TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS: '-100123',
    })
    try {
      ;(fetch as any).mockReset()
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_05,
          pre_checkout_query: {
            id: 'pcq-tip-1',
            from: { id: 99 },
            currency: 'XTR',
            total_amount: 5,
            invoice_payload: 'tip:5:signal-buy',
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect((fetch as any).mock.calls.length).toBe(1)
      expect(String((fetch as any).mock.calls[0][0])).toContain('/answerPreCheckoutQuery')
      const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
      expect(payload.pre_checkout_query_id).toBe('pcq-tip-1')
      expect(payload.ok).toBe(true)
    } finally {
      restoreTipEnv()
    }
  })

  it('logs Stars tip payment events from successful_payment updates', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreTipEnv = applyEnv({
      TELEGRAM_STARS_TIPS_ENABLED: 'true',
      TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS: '-100123',
    })
    try {
      getTelegramLinkByUserIdMock.mockResolvedValueOnce({
        telegramUserId: '99',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })

      ;(fetch as any).mockReset()
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_06,
          message: {
            message_id: 26,
            chat: { id: -100123 },
            from: { id: 99 },
            successful_payment: {
              currency: 'XTR',
              total_amount: 5,
              invoice_payload: 'tip:5:signal-buy',
              telegram_payment_charge_id: 'tg-charge-1',
              provider_payment_charge_id: 'provider-charge-1',
            },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(logTelegramActionAuditMock).toHaveBeenCalled()
      const auditCall = logTelegramActionAuditMock.mock.calls[0]?.[0] ?? {}
      expect(String(auditCall.actionType ?? '')).toBe('tip')
      expect(String(auditCall.status ?? '')).toBe('paid')
      expect((fetch as any).mock.calls.length).toBe(1)
      const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
      expect(String(payload.text ?? '').toLowerCase()).toContain('thanks for the tip')
    } finally {
      restoreTipEnv()
    }
  })

  it('routes signal follow-up into configured Signals topic thread', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreSignalsEnv = applyEnv({
      TELEGRAM_SIGNALS_CHAT_ID: '-100123',
      TELEGRAM_SIGNALS_THREAD_ID: '777',
    })
    try {
      consumeTelegramActionTokenMock.mockResolvedValueOnce({
        ok: true,
        actionType: 'buy',
        intentPayload: {
          creatorCoinAddress: '0x2222222222222222222222222222222222222222',
          amountInput: '0.05',
          amountEth: 0.05,
          usdEstimate: 150,
        },
        expiresAt: '2026-03-13T00:01:30.000Z',
        consumedAt: '2026-03-13T00:00:32.000Z',
      })
      getTelegramLinkByUserIdMock.mockResolvedValueOnce({
        telegramUserId: '99',
        telegramUsername: 'akita',
        profileId: 7,
        privyUserId: 'did:privy:7',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ownerVerified: true,
        linkStatus: 'active',
        linkedAt: '2026-03-13T00:00:00.000Z',
        lastVerifiedAt: '2026-03-13T00:00:00.000Z',
        revokedAt: null,
        failureCount: 0,
        lastFailureReason: null,
        unlinkRequestedAt: null,
      })
      handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Coin buy submitted.' })

      ;(fetch as any).mockReset()
      ;(fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        })

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 16_01,
          callback_query: {
            id: 'cbq-buy-signal-thread',
            data: 'trade:confirm:trade-token-1',
            from: { id: 99 },
            message: { message_id: 20, chat: { id: -100123 } },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect((fetch as any).mock.calls.length).toBe(3)
      const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
      expect(signalPayload.chat_id).toBe('-100123')
      expect(signalPayload.message_thread_id).toBe(777)
      expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • BUY')
      expect(String(signalPayload.text ?? '')).toContain('Copy: `/buy 0x2222222222222222222222222222222222222222 0.05 --confirm`')
      const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Reuse Buy' &&
            String(button?.copy_text?.text ?? '').trim() ===
            '/buy 0x2222222222222222222222222222222222222222 0.05 --confirm',
        ),
      ).toBe(true)
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Edit Amount' &&
            String(button?.switch_inline_query_current_chat ?? '').trim() ===
            '/buy 0x2222222222222222222222222222222222222222 <new-eth-amount> --confirm',
        ),
      ).toBe(true)
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Open Portfolio' && String(button?.callback_data ?? '') === 'menu:portfolio',
        ),
      ).toBe(true)
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'View Vault' &&
            String(button?.url ?? '').includes('/vault/0x2222222222222222222222222222222222222222'),
        ),
      ).toBe(true)
    } finally {
      restoreSignalsEnv()
    }
  })

  it('confirms bid callback via canonical CSW userOp and returns tx hash', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'bid',
      intentPayload: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        amountEth: 0.1,
        amountInput: '300',
        usdEstimate: 300,
        ccaStrategyAddress: '0x3333333333333333333333333333333333333333',
        bid: {
          auctionAddress: '0x4444444444444444444444444444444444444444',
          maxPriceQ96: '1000000000000',
          amountWei: '100000000000000000',
          clearingPriceQ96: '900000000000',
        },
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 16_1,
        callback_query: {
          id: 'cbq-bid-confirm',
          data: 'trade:confirm:trade-token-bid',
          from: { id: 99 },
          message: { message_id: 22, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(resolvePrivyCoinbaseSmartWalletOwnerContextMock).toHaveBeenCalledTimes(1)
    expect(sendPrivyCoinbaseSmartWalletUserOperationMock).toHaveBeenCalledTimes(1)
    expect(logTelegramActionAuditMock).toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(3)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Bid executed')
    expect(String(payload.text ?? '')).toContain('0x6666666666666666666666666666666666666666666666666666666666666666')
    const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • BID')
    expect(String(signalPayload.text ?? '')).toContain('Copy: `/bid 0x1111111111111111111111111111111111111111 $300 --confirm`')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Reuse Bid' &&
          String(button?.copy_text?.text ?? '').trim() ===
          '/bid 0x1111111111111111111111111111111111111111 $300 --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Edit Amount' &&
          String(button?.switch_inline_query_current_chat ?? '').trim() ===
          '/bid 0x1111111111111111111111111111111111111111 $<new-usd-amount> --confirm',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) => String(button?.text ?? '').trim() === 'Open Portfolio' && String(button?.callback_data ?? '') === 'menu:portfolio',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'View Vault' &&
          String(button?.url ?? '').includes('/vault/0x1111111111111111111111111111111111111111'),
      ),
    ).toBe(true)
  })

  it('rejects bid callback when requote drift exceeds safety limit', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'bid',
      intentPayload: {
        amountEth: 0.1,
        usdEstimate: 600,
        ccaStrategyAddress: '0x3333333333333333333333333333333333333333',
        bid: {
          auctionAddress: '0x4444444444444444444444444444444444444444',
          maxPriceQ96: '1000000000000',
          amountWei: '100000000000000000',
          clearingPriceQ96: '900000000000',
        },
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: '2026-03-13T00:00:00.000Z',
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 16_2,
        callback_query: {
          id: 'cbq-bid-drift',
          data: 'trade:confirm:trade-token-bid-drift',
          from: { id: 99 },
          message: { message_id: 23, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(sendPrivyCoinbaseSmartWalletUserOperationMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('3% safety limit')
  })

  it('rejects replayed trade callback tokens', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({ ok: false, reason: 'consumed' })

    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 17,
        callback_query: {
          id: 'cbq-buy-replay',
          data: 'trade:confirm:trade-token-1',
          from: { id: 99 },
          message: { message_id: 21, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('already confirmed')
  })
})
