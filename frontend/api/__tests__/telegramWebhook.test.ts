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
  upsertTelegramTradePercentPromptMock,
  getTelegramTradePercentPromptMock,
  consumeTelegramTradePercentPromptMock,
  clearTelegramTradePercentPromptMock,
  ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserIdMock,
  getTelegramPortfolioSummaryMock,
  getTelegramInlineSignalFeedByInlineMessageIdMock,
  listTelegramAuctionsMock,
  listTelegramInlineSignalFeedsBySourceChatMock,
  listTelegramScopedVaultsMock,
  listTelegramSignalsMock,
  listTelegramUserBidsMock,
  getTelegramChatTradePolicyMock,
  getHolderRoomPolicyByVaultMock,
  listHolderRoomPoliciesMock,
  isTelegramFunnelEventsEnabledForChatMock,
  logTelegramFunnelEventMock,
  closeTelegramInlineSignalFeedMock,
  upsertHolderRoomMemberMock,
  revokeTelegramLinkMock,
  logTelegramActionAuditMock,
  setTelegramInlineSignalFeedPausedMock,
  touchTelegramInlineSignalFeedPushMock,
  upsertTelegramInlineSignalFeedMock,
  checkSharesEligibilityMock,
  privyGetUserByIdMock,
  createPublicClientMock,
  resolvePrivyCoinbaseSmartWalletOwnerContextMock,
  sendPrivyCoinbaseSmartWalletUserOperationMock,
  readTelegramOnboardingSessionMock,
  tryInsertTelegramPrivateDmWelcomeSentMock,
  upsertTelegramOnboardingSessionMock,
  startAkitaVaultDeployFromTelegramMock,
  fetchVaultDeployStatusFromTelegramMock,
} = vi.hoisted(() => ({
  handleKeeprCommandMock: vi.fn(),
  handleTwitterCommandMock: vi.fn(),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  ensureKeeprSchemaMock: vi.fn(),
  createTelegramLinkStartTokenMock: vi.fn(),
  createTelegramActionTokenMock: vi.fn(),
  consumeTelegramActionTokenMock: vi.fn(),
  upsertTelegramTradePercentPromptMock: vi.fn(),
  getTelegramTradePercentPromptMock: vi.fn(),
  consumeTelegramTradePercentPromptMock: vi.fn(),
  clearTelegramTradePercentPromptMock: vi.fn(),
  ensureTelegramTradingSchemaMock: vi.fn(),
  getTelegramLinkByUserIdMock: vi.fn(),
  getTelegramPortfolioSummaryMock: vi.fn(),
  getTelegramInlineSignalFeedByInlineMessageIdMock: vi.fn(),
  listTelegramAuctionsMock: vi.fn(),
  listTelegramInlineSignalFeedsBySourceChatMock: vi.fn(),
  listTelegramScopedVaultsMock: vi.fn(),
  listTelegramSignalsMock: vi.fn(),
  listTelegramUserBidsMock: vi.fn(),
  getTelegramChatTradePolicyMock: vi.fn(),
  getHolderRoomPolicyByVaultMock: vi.fn(),
  listHolderRoomPoliciesMock: vi.fn(),
  isTelegramFunnelEventsEnabledForChatMock: vi.fn(),
  logTelegramFunnelEventMock: vi.fn(),
  closeTelegramInlineSignalFeedMock: vi.fn(),
  upsertHolderRoomMemberMock: vi.fn(),
  revokeTelegramLinkMock: vi.fn(),
  logTelegramActionAuditMock: vi.fn(),
  setTelegramInlineSignalFeedPausedMock: vi.fn(),
  touchTelegramInlineSignalFeedPushMock: vi.fn(),
  upsertTelegramInlineSignalFeedMock: vi.fn(),
  checkSharesEligibilityMock: vi.fn(),
  privyGetUserByIdMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  resolvePrivyCoinbaseSmartWalletOwnerContextMock: vi.fn(),
  sendPrivyCoinbaseSmartWalletUserOperationMock: vi.fn(),
  readTelegramOnboardingSessionMock: vi.fn(),
  tryInsertTelegramPrivateDmWelcomeSentMock: vi.fn(),
  upsertTelegramOnboardingSessionMock: vi.fn(),
  startAkitaVaultDeployFromTelegramMock: vi.fn(),
  fetchVaultDeployStatusFromTelegramMock: vi.fn(),
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

vi.mock('../../server/_lib/keeprGating.js', () => ({
  checkSharesEligibility: checkSharesEligibilityMock,
}))

vi.mock('../../server/_lib/telegramTrading.js', () => ({
  createTelegramLinkStartToken: createTelegramLinkStartTokenMock,
  createTelegramActionToken: createTelegramActionTokenMock,
  consumeTelegramActionToken: consumeTelegramActionTokenMock,
  upsertTelegramTradePercentPrompt: upsertTelegramTradePercentPromptMock,
  getTelegramTradePercentPrompt: getTelegramTradePercentPromptMock,
  consumeTelegramTradePercentPrompt: consumeTelegramTradePercentPromptMock,
  clearTelegramTradePercentPrompt: clearTelegramTradePercentPromptMock,
  ensureTelegramTradingSchema: ensureTelegramTradingSchemaMock,
  getTelegramLinkByUserId: getTelegramLinkByUserIdMock,
  getTelegramPortfolioSummary: getTelegramPortfolioSummaryMock,
  getTelegramInlineSignalFeedByInlineMessageId: getTelegramInlineSignalFeedByInlineMessageIdMock,
  listTelegramAuctions: listTelegramAuctionsMock,
  listTelegramInlineSignalFeedsBySourceChat: listTelegramInlineSignalFeedsBySourceChatMock,
  listTelegramScopedVaults: listTelegramScopedVaultsMock,
  listTelegramSignals: listTelegramSignalsMock,
  listTelegramUserBids: listTelegramUserBidsMock,
  getTelegramChatTradePolicy: getTelegramChatTradePolicyMock,
  getHolderRoomPolicyByVault: getHolderRoomPolicyByVaultMock,
  listHolderRoomPolicies: listHolderRoomPoliciesMock,
  isTelegramFunnelEventsEnabledForChat: isTelegramFunnelEventsEnabledForChatMock,
  logTelegramFunnelEvent: logTelegramFunnelEventMock,
  closeTelegramInlineSignalFeed: closeTelegramInlineSignalFeedMock,
  upsertHolderRoomMember: upsertHolderRoomMemberMock,
  revokeTelegramLink: revokeTelegramLinkMock,
  logTelegramActionAudit: logTelegramActionAuditMock,
  setTelegramInlineSignalFeedPaused: setTelegramInlineSignalFeedPausedMock,
  touchTelegramInlineSignalFeedPush: touchTelegramInlineSignalFeedPushMock,
  upsertTelegramInlineSignalFeed: upsertTelegramInlineSignalFeedMock,
  readTelegramOnboardingSession: readTelegramOnboardingSessionMock,
  tryInsertTelegramPrivateDmWelcomeSent: tryInsertTelegramPrivateDmWelcomeSentMock,
  upsertTelegramOnboardingSession: upsertTelegramOnboardingSessionMock,
}))

vi.mock('../_handlers/telegram/webhook/services/vaultDeploy.js', () => ({
  startAkitaVaultDeployFromTelegram: startAkitaVaultDeployFromTelegramMock,
  fetchVaultDeployStatusFromTelegram: fetchVaultDeployStatusFromTelegramMock,
  formatVaultDeployPreviewText: (...args: any[]) => {
    const [{ version, creatorToken, smartWallet, expiresAt } = {}] = args
    return [
      'Vault Deploy Preview • AKITA',
      '',
      `- creatorToken: ${creatorToken ?? ''}`,
      `- smartWallet: ${smartWallet ?? ''}`,
      `- version: ${version ?? ''}`,
      '- flow: deploy-session start -> auto-continue when owner is installed',
      '',
      `Token expires: ${expiresAt ?? ''}`,
    ].join('\n')
  },
  buildVaultDeployPreviewReplyMarkup: (token: string) => ({
    inline_keyboard: [[
      { text: 'Confirm', callback_data: `vaultdeploy:confirm:${token}` },
      { text: 'Decline', callback_data: `vaultdeploy:decline:${token}` },
    ]],
  }),
  formatVaultDeployTokenFailure: (reason: string) => {
    if (reason === 'expired') return 'Vault deploy confirmation expired. Start a new `/vaultdeploy` preview.'
    if (reason === 'consumed') return 'This vault deploy preview was already confirmed or cancelled.'
    if (reason === 'scope_mismatch') return 'Vault deploy confirmation scope mismatch. Use a fresh preview from this chat.'
    return 'Vault deploy confirmation token not found. Start a new `/vaultdeploy` preview.'
  },
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
    upsertTelegramTradePercentPromptMock.mockResolvedValue({
      chatId: '-100123',
      telegramUserId: '99',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      expiresAt: '2026-03-13T00:03:00.000Z',
      consumedAt: null,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
    })
    getTelegramTradePercentPromptMock.mockResolvedValue(null)
    consumeTelegramTradePercentPromptMock.mockResolvedValue(null)
    clearTelegramTradePercentPromptMock.mockResolvedValue(undefined)
    getTelegramLinkByUserIdMock.mockResolvedValue(null)
    getTelegramPortfolioSummaryMock.mockResolvedValue(null)
    getTelegramInlineSignalFeedByInlineMessageIdMock.mockResolvedValue(null)
    listTelegramAuctionsMock.mockResolvedValue([])
    listTelegramInlineSignalFeedsBySourceChatMock.mockResolvedValue([])
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
    getHolderRoomPolicyByVaultMock.mockResolvedValue(null)
    listHolderRoomPoliciesMock.mockResolvedValue([])
    isTelegramFunnelEventsEnabledForChatMock.mockReturnValue(true)
    logTelegramFunnelEventMock.mockResolvedValue(undefined)
    closeTelegramInlineSignalFeedMock.mockResolvedValue(null)
    upsertHolderRoomMemberMock.mockResolvedValue(null)
    revokeTelegramLinkMock.mockResolvedValue({ revoked: false, link: null })
    logTelegramActionAuditMock.mockResolvedValue(undefined)
    setTelegramInlineSignalFeedPausedMock.mockResolvedValue(null)
    touchTelegramInlineSignalFeedPushMock.mockResolvedValue(undefined)
    upsertTelegramInlineSignalFeedMock.mockResolvedValue(null)
    readTelegramOnboardingSessionMock.mockResolvedValue(null)
    tryInsertTelegramPrivateDmWelcomeSentMock.mockResolvedValue(true)
    upsertTelegramOnboardingSessionMock.mockResolvedValue(undefined)
    startAkitaVaultDeployFromTelegramMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'vault_deploy_start_failed',
    })
    fetchVaultDeployStatusFromTelegramMock.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'vault_deploy_status_failed',
    })
    checkSharesEligibilityMock.mockResolvedValue({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '0',
        threshold: '1',
        blockNumber: 123,
        rpcUrl: 'https://rpc.example.test',
      },
    })
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
      getBalance: vi.fn(async () => 1_000_000_000_000_000_000n),
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
      TELEGRAM_ALLOWED_CHAT_IDS: '-100123',
      TELEGRAM_WEBHOOK_SECRET: 'top-secret',
      TELEGRAM_ADMIN_USER_IDS: '42',
      TELEGRAM_ALLOW_PRIVATE_DMS: 'false',
      TELEGRAM_ALLOW_ALL_PRIVATE_DMS: 'false',
      TELEGRAM_DEFAULT_SENDER_WALLET: '0x00000000000000000000000000000000000000aa',
      TELEGRAM_GROUP_ID_MAP_JSON: JSON.stringify({ '-100123': 'xmtp-group-1' }),
      TELEGRAM_HOLDER_ROOMS_ENABLED: 'true',
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

  it('returns 503 when webhook secret is not configured', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreWebhookSecret = applyEnv({
      TELEGRAM_WEBHOOK_SECRET: undefined,
    })
    try {
      const req = createMockReq({
        method: 'POST',
        body: {
          update_id: 1,
          message: { message_id: 7, text: '/help', chat: { id: -100123 }, from: { id: 99 } },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(String(res.body?.error ?? '')).toContain('webhook secret')
      expect(handleKeeprCommandMock).not.toHaveBeenCalled()
      expect((fetch as any).mock.calls.length).toBe(0)
    } finally {
      restoreWebhookSecret()
    }
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
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help',
    }))
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
    const callbackButtons = payload.reply_markup.inline_keyboard.flat()
    const connectButton = callbackButtons.find((button: any) => String(button?.text ?? '').trim() === '■ Connect')
    expect(Boolean(connectButton)).toBe(true)
    expect(String(connectButton?.callback_data ?? '')).toBe('menu:connect')
    expect(callbackButtons.some((button: any) => button?.callback_data === 'menu:explore')).toBe(true)
    expect(callbackButtons.some((button: any) => button?.callback_data === 'menu:cre')).toBe(true)
    expect(callbackButtons.some((button: any) => button?.callback_data === 'menu:solana')).toBe(true)
    expect(callbackButtons.some((button: any) => typeof button?.switch_inline_query === 'string')).toBe(true)
    expect(callbackButtons.some((button: any) => button?.callback_data === 'menu:topics')).toBe(true)
    expect(callbackButtons.some((button: any) => button?.callback_data === 'help:market')).toBe(false)
    expect(callbackButtons.some((button: any) => button?.callback_data === 'menu:deploy')).toBe(false)
  })

  it('sends a Telegram photo card when a command returns media metadata', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({
      ok: true,
      response: 'Chart — BTC (1m)',
      action: {
        telegramMedia: {
          kind: 'photo',
          bytes: Buffer.from([1, 2, 3, 4]),
          contentType: 'image/png',
          filename: 'chart.png',
          caption: '<b>AKITA | MARKET CHART</b>',
          suppressText: true,
        },
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_0_0,
        message: { message_id: 9_1, text: '/mkt chart BTC 1m', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/sendPhoto')
    const form = (fetch as any).mock.calls[0][1]?.body as FormData
    expect(form.get('chat_id')).toBe('-100123')
    expect(form.get('caption')).toBe('<b>AKITA | MARKET CHART</b>')
    expect(form.get('parse_mode')).toBe('HTML')
    expect(String(form.get('reply_to_message_id') ?? '')).toBe('91')
    expect(String(form.get('reply_markup') ?? '')).toContain('message:delete')
  })

  it('backticks only the command and not the help description', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({
      ok: true,
      response: ['Keepr quick help', '', 'Most used:', '- /keepr status — vault status and config'].join('\n'),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_0,
        message: { message_id: 90, text: '/help market', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    const text = String(payload.text ?? '')
    expect(text).toContain('- `/keepr status` — vault status and config')
    expect(text).not.toContain('- `/keepr status — vault status and config`')
  })

  it('renders /cre status with premium chrome and collapsed details', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({
      ok: true,
      response: ['CRE Status', '', '- vaults: 2', '- idleFunds: 0.42 ETH', '- reportsPending: 1'].join('\n'),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_0_1,
        message: { message_id: 90_1, text: '/cre status', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    const text = String(payload.text ?? '')
    expect(text).toContain('AKITA | CRE STATUS')
    expect(text).toContain('<code>/cre status</code>')
    expect(text).toContain('<blockquote expandable>')
    const buttons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
  })

  it('handles /start in DM as onboarding welcome with a single Start inline CTA', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

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
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.parse_mode ?? '')).toBe('HTML')
    const body = String(payload.text ?? '')
    expect(body).toContain('Welcome to 4626.fun on Telegram')
    expect(body.toLowerCase()).not.toContain('do you have a zora account')
    expect(body).not.toContain('/link')
    expect(Array.isArray(payload.reply_markup?.inline_keyboard)).toBe(true)
    const buttons = payload.reply_markup.inline_keyboard.flat()
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:begin')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
    expect(upsertTelegramOnboardingSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ telegramUserId: '42', step: 'welcome' }),
    )
  })

  it('handles /start in DM when already linked with the full trade-focused menu', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '42',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: null,
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 3_1_1,
        message: { message_id: 91, text: '/start', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Connected and ready')
    const flat = (payload.reply_markup?.inline_keyboard ?? []).flat()
    expect(flat.some((b: any) => String(b?.callback_data ?? '') === 'menu:trade')).toBe(true)
    expect(flat.some((b: any) => String(b?.callback_data ?? '') === 'menu:cre')).toBe(true)
    expect(flat.some((b: any) => String(b?.callback_data ?? '') === 'menu:solana')).toBe(true)
    expect(flat.some((b: any) => String(b?.text ?? '').trim() === 'Start')).toBe(false)
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
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'telegram:7726886643',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help',
    }))
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
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/keepr help',
    }))
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
    if (Object.prototype.hasOwnProperty.call(payload, 'next_offset')) {
      expect(typeof payload.next_offset).toBe('string')
    }
    const resultTexts = payload.results
      .map((entry: any) => String(entry?.input_message_content?.message_text ?? ''))
      .filter(Boolean)
      .join('\n')
    expect(resultTexts).toContain('/link')
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
    const tradeResult = payload.results.find((entry: any) => String(entry?.input_message_content?.message_text ?? '').trim() === '/buy')
    expect(tradeResult).toBeTruthy()
    expect(String(tradeResult?.title ?? '').toLowerCase()).toContain('buy')
  })

  it('uses brand-style inline growth copy when TELEGRAM_INLINE_GROWTH_MODE is enabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreGrowthEnv = applyEnv({
      TELEGRAM_INLINE_GROWTH_MODE: '1',
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 5_15,
          inline_query: {
            id: 'iq-growth',
            from: { id: 777 },
            query: 'start trading',
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
      const titles = payload.results.map((entry: any) => String(entry?.title ?? ''))
      const descriptions = payload.results.map((entry: any) => String(entry?.description ?? ''))

      expect(titles.some((title: string) => title.includes('Connect wallet'))).toBe(true)
      expect(descriptions.some((description: string) => description.includes('One-time setup • buy, sell, bid'))).toBe(true)
      expect(titles.some((title: string) => title.includes('Guide'))).toBe(true)
      expect(titles.some((title: string) => title.includes('Ask Keepr AI'))).toBe(false)
      expect(titles.join(' ')).not.toContain('🚀')
      expect(descriptions.join(' ')).not.toContain('🚀')
    } finally {
      restoreGrowthEnv()
    }
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
    expect(Boolean(payload.switch_pm_parameter || payload.button?.start_parameter)).toBe(true)
    expect(String(payload.button?.web_app?.url ?? '')).toContain('/telegram/link')
    expect(String(payload.button?.text ?? '')).toBe('Connect wallet')
  })

  it('adds scoped vault shortcuts to inline results and keeps deterministic caps', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
    expect(String(payload.button?.text ?? '')).toBe('Open 4626')
    expect(String(payload.button?.web_app?.url ?? '')).toContain('/telegram/menu')
    const resultTexts = payload.results
      .map((entry: any) => String(entry?.input_message_content?.message_text ?? ''))
      .filter(Boolean)
    expect(resultTexts.some((text: string) => text.trim() === '/buy')).toBe(true)
    expect(resultTexts.some((text: string) => text.trim() === '/bid')).toBe(true)
    expect(typeof payload.next_offset).toBe('string')
  })

  it('respects inline query offset when paginating results', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_31,
        inline_query: {
          id: 'iq-offset',
          from: { id: 42 },
          query: 'vault picks',
          offset: '4',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(Array.isArray(payload.results)).toBe(true)
    const firstId = String(payload.results[0]?.id ?? '')
    expect(firstId.startsWith('r4:')).toBe(true)
  })

  it('hides PM handoff when TELEGRAM_INLINE_PM_HANDOFF_ENABLED is off', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const restoreInlineEnv = applyEnv({
      TELEGRAM_INLINE_PM_HANDOFF_ENABLED: 'false',
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 5_32,
          inline_query: {
            id: 'iq-no-pm',
            from: { id: 777 },
            query: 'start trading',
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
      expect(payload.switch_pm_parameter).toBeUndefined()
      expect(payload.button).toBeUndefined()
    } finally {
      restoreInlineEnv()
    }
  })

  it('handles chosen_inline_result updates and logs inline attribution context', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_4,
        chosen_inline_result: {
          result_id: 'r2:photo:link-account',
          from: { id: 777 },
          query: 'buy now',
          inline_message_id: 'inline-msg-1',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(0)
    expect(logTelegramFunnelEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'inline_result_chosen',
        actionType: 'inline',
        context: expect.objectContaining({
          source: 'inline',
          resultType: 'photo',
          rankPosition: 3,
          queryClass: 'trade',
        }),
      }),
    )
  })

  it('activates and renders a live signals inline card when chosen', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    listTelegramSignalsMock.mockResolvedValueOnce([
      {
        telegramUserId: '777',
        actionType: 'buy',
        status: 'confirmed',
        txHash: '0x1234567890123456789012345678901234567890',
        createdAt: '2026-03-21T18:00:00.000Z',
      },
    ])
    upsertTelegramInlineSignalFeedMock.mockResolvedValueOnce({
      inlineMessageId: 'inline-msg-live',
      sourceChatId: '-100123',
      ownerTelegramUserId: '777',
      paused: false,
      closedAt: null,
      lastRenderHash: null,
      lastPushedAt: null,
      createdAt: '2026-03-21T18:00:00.000Z',
      updatedAt: '2026-03-21T18:00:00.000Z',
    })
    getTelegramInlineSignalFeedByInlineMessageIdMock.mockResolvedValueOnce({
      inlineMessageId: 'inline-msg-live',
      sourceChatId: '-100123',
      ownerTelegramUserId: '777',
      paused: false,
      closedAt: null,
      lastRenderHash: null,
      lastPushedAt: null,
      createdAt: '2026-03-21T18:00:00.000Z',
      updatedAt: '2026-03-21T18:00:00.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_41,
        chosen_inline_result: {
          result_id: 'r0:article:signals-live',
          from: { id: 777 },
          query: 'signals live',
          inline_message_id: 'inline-msg-live',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertTelegramInlineSignalFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inlineMessageId: 'inline-msg-live',
        sourceChatId: '-100123',
        ownerTelegramUserId: '777',
      }),
    )
    expect(String((fetch as any).mock.calls[0][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(payload.inline_message_id).toBe('inline-msg-live')
    expect(String(payload.text ?? '')).toContain('AKITA | SIGNALS LIVE')
  })

  it('refreshes a live signals inline card from an inline callback', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramInlineSignalFeedByInlineMessageIdMock
      .mockResolvedValueOnce({
        inlineMessageId: 'inline-msg-live',
        sourceChatId: '-100123',
        ownerTelegramUserId: '777',
        paused: false,
        closedAt: null,
        lastRenderHash: null,
        lastPushedAt: null,
        createdAt: '2026-03-21T18:00:00.000Z',
        updatedAt: '2026-03-21T18:00:00.000Z',
      })
      .mockResolvedValueOnce({
      inlineMessageId: 'inline-msg-live',
      sourceChatId: '-100123',
      ownerTelegramUserId: '777',
      paused: false,
      closedAt: null,
      lastRenderHash: null,
      lastPushedAt: null,
      createdAt: '2026-03-21T18:00:00.000Z',
      updatedAt: '2026-03-21T18:00:00.000Z',
      })
    listTelegramSignalsMock.mockResolvedValueOnce([
      {
        telegramUserId: '777',
        actionType: 'sell',
        status: 'submitted',
        txHash: '0x1234567890123456789012345678901234567890',
        createdAt: '2026-03-21T18:01:00.000Z',
      },
    ])

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 5_42,
        callback_query: {
          id: 'cbq-live-refresh',
          data: 'livefeed:signals:refresh',
          from: { id: 777 },
          inline_message_id: 'inline-msg-live',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/editMessageText')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/answerCallbackQuery')
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
    expect(allButtons.some((button: any) => typeof button.switch_inline_query === 'string')).toBe(true)
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

  it('allows non-admin private DM when TELEGRAM_ALLOW_PRIVATE_DMS is enabled', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr commands...' })
    const restorePrivateDmEnv = applyEnv({
      TELEGRAM_ALLOW_PRIVATE_DMS: 'true',
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 7_0,
          message: {
            message_id: 12_0,
            text: '/help',
            chat: { id: 7726886643 },
            from: { id: 999 },
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
      expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
        groupId: 'telegram:7726886643',
        senderWallet: '0x0000000000000000000000000000000000000000',
        text: '/help',
      }))
      expect((fetch as any).mock.calls.length).toBe(1)
      expect(String((fetch as any).mock.calls[0][0])).toContain('/sendMessage')
    } finally {
      restorePrivateDmEnv()
    }
  })

  it('blocks non-admin private DM by default when private-dm flags are unset', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Keepr commands...' })
    const restorePrivateDmEnv = applyEnv({
      TELEGRAM_ALLOW_PRIVATE_DMS: undefined,
      TELEGRAM_ALLOW_ALL_PRIVATE_DMS: undefined,
    })

    try {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
        body: {
          update_id: 7_0_2,
          message: {
            message_id: 12_0_2,
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
      expect((fetch as any).mock.calls.length).toBe(0)
    } finally {
      restorePrivateDmEnv()
    }
  })

  it('guides unlinked private-chat plain text with the same welcome + Start keyboard as /start', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_1,
        message: {
          message_id: 12_1,
          text: 'Why?',
          chat: { id: 7726886643 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(tryInsertTelegramPrivateDmWelcomeSentMock).toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Welcome to 4626.fun on Telegram')
    expect(String(payload.text ?? '').toLowerCase()).not.toContain('coinbase smart wallet | 4626.fun')
    const buttons = payload.reply_markup.inline_keyboard.flat()
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:begin')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
  })

  it('does not re-send welcome on subsequent private plain text when welcome was already sent', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    tryInsertTelegramPrivateDmWelcomeSentMock.mockResolvedValueOnce(false)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_1_9,
        message: {
          message_id: 12_1_9,
          text: 'Hello again',
          chat: { id: 7726886643 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('keeps plain private-chat followups as normal command text once linked', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'AI follow-up reply' })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '42',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: null,
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_1_0,
        message: {
          message_id: 12_1_0,
          text: 'Why?',
          chat: { id: 7726886643 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'telegram:7726886643',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: 'Why?',
    }))
  })

  it('auto-routes private-chat mentions into /ai', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'AI follow-up reply' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_1_1,
        message: {
          message_id: 12_1_1,
          text: '@keepr Why?',
          chat: { id: 7726886643 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'telegram:7726886643',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/ai @keepr Why?',
    }))
  })

  it('auto-routes plain replies to bot messages into /ai in groups', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'AI follow-up reply' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_2,
        message: {
          message_id: 12_2,
          text: 'Why?',
          chat: { id: -100123 },
          from: { id: 99 },
          reply_to_message: {
            message_id: 12_0,
            from: { id: 42, is_bot: true },
          },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/ai Why?',
    }))
  })

  it('keeps plain group chat text as-is when not replying to the bot', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'No auto-route' })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 7_3,
        message: {
          message_id: 12_3,
          text: 'Why?',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: 'Why?',
    }))
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
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/help market',
    }))

    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('- `/mkt quote` <symbol>')
    expect(String(payload.text ?? '')).toContain('symbol: ticker, e.g. BTC')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:start')).toBe(true)
  })

  it('acknowledges callback query from disallowed chat context and ignores it', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    ;(fetch as any).mockReset()
    ;(fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 10_1,
        callback_query: {
          id: 'cbq-disallowed',
          data: 'menu:start',
          from: { id: 999 },
          message: { message_id: 1401, chat: { id: 7726886643 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ignored).toBe(true)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(payload.callback_query_id).toBe('cbq-disallowed')
    expect(String(payload.text ?? '')).toContain('not enabled')
    expect(payload.show_alert).toBe(true)
  })

  it('does not route deprecated help:inline callback to inline launcher', async () => {
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
    expect(allButtons.some((button: any) => typeof button.switch_inline_query_current_chat === 'string')).toBe(false)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:start')).toBe(false)
  })

  it('handles callback query for more tools menu and returns secondary actions', async () => {
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
        update_id: 11_1,
        callback_query: {
          id: 'cbq-more',
          data: 'menu:more',
          from: { id: 99 },
          message: { message_id: 15, chat: { id: -100123 } },
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
    expect(String(payload.text ?? '')).toContain('More Tools')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.some((button: any) => typeof button?.switch_inline_query === 'string')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:deploy')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:zora')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:cre')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:solana')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:start')).toBe(true)
  })

  it('handles callback query for explore menu with non-emoji symbols', async () => {
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
        update_id: 11_2,
        callback_query: {
          id: 'cbq-explore',
          data: 'menu:explore',
          from: { id: 99 },
          message: { message_id: 16, chat: { id: -100123 } },
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
    expect(String(payload.text ?? '')).toContain('Explore')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => String(button?.text ?? '') === 'Vaults')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.text ?? '') === 'Auctions')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.text ?? '') === 'Signals')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.text ?? '').includes('⇢'))).toBe(false)
  })

  it('handles callback query for CRE menu and returns one-tap operator actions', async () => {
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
        update_id: 11_3,
        callback_query: {
          id: 'cbq-cre',
          data: 'menu:cre',
          from: { id: 99 },
          message: { message_id: 17, chat: { id: -100123 } },
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
    expect(String(payload.text ?? '')).toContain('CRE Ops')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:status')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:auction')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:tend')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:report')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:solana')).toBe(true)
    expect(allButtons.some((button: any) => typeof button?.switch_inline_query_current_chat === 'string')).toBe(true)
  })

  it('handles callback query for Solana menu and returns one-tap bridge actions', async () => {
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
        update_id: 11_4,
        callback_query: {
          id: 'cbq-solana',
          data: 'menu:solana',
          from: { id: 99 },
          message: { message_id: 18, chat: { id: -100123 } },
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
    expect(String(payload.text ?? '')).toContain('Solana')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:solana')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:settle-fees')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:relay-entries')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:cre')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:start')).toBe(true)
    expect(allButtons.some((button: any) => typeof button?.switch_inline_query_current_chat === 'string')).toBe(true)
  })

  it('routes Solana action callbacks to the existing CRE command backend and keeps the Solana menu attached', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Fee settlement submitted.' })

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
        update_id: 11_5,
        callback_query: {
          id: 'cbq-settle',
          data: 'cre:settle-fees',
          from: { id: 99 },
          message: { message_id: 19, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/cre settle-fees',
    }))
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Fee settlement submitted.')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:settle-fees')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'cre:relay-entries')).toBe(true)
    expect(allButtons.some((button: any) => button?.callback_data === 'menu:cre')).toBe(true)
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
    expect(String(payload.text ?? '')).toContain('AKITA | LINK STATUS')
    expect(String(payload.text ?? '')).toContain('<blockquote expandable>')
    expect(String(payload.text ?? '')).toContain('- linked: no')
    expect(String(payload.text ?? '')).toContain('- next:')
    expect(String(payload.text ?? '')).toContain('/start')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.length).toBeGreaterThan(0)
  })

  it('renders /linked success with trade shortcuts when owner is verified', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: '0x1111111111111111111111111111111111111111',
      ownerVerified: true,
      linkStatus: 'active',
      linkedAt: '2026-03-13T00:00:00.000Z',
      lastVerifiedAt: null,
      revokedAt: null,
      failureCount: 0,
      lastFailureReason: null,
      unlinkRequestedAt: null,
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12_0,
        message: { message_id: 16, text: '/linked', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Ready actions')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    const walletButton = allButtons.find((button: any) => String(button?.text ?? '').trim() === '■ Wallet')
    expect(Boolean(walletButton)).toBe(true)
    expect(
      typeof walletButton?.web_app?.url === 'string' ||
        typeof walletButton?.url === 'string' ||
        String(walletButton?.callback_data ?? '') === 'menu:wallet',
    ).toBe(true)
    expect(allButtons.some((button: any) => String(button?.callback_data ?? '') === 'menu:trade')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.callback_data ?? '') === 'menu:explore')).toBe(true)
  })

  it('renders /link in groups with private-DM linking instructions only', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12_1,
        message: { message_id: 16, text: '/link', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Link your 4626 account (one time)')
    expect(String(payload.text ?? '')).toContain('only available in a private chat')
    expect(String(payload.text ?? '')).toContain('/start')
    expect(String(payload.text ?? '')).toContain('/link')
    expect(String(payload.text ?? '')).not.toContain('Tap Open Mini App.')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.some((button: any) => String(button?.callback_data ?? '') === 'menu:linked')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.text ?? '').trim() === 'Check Link Status')).toBe(true)
    expect(allButtons.some((button: any) => String(button?.text ?? '').trim() === 'Open Mini App')).toBe(false)
  })

  it('renders /link in private chats as onboarding alias before Zora branch (welcome + Start)', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    readTelegramOnboardingSessionMock.mockResolvedValueOnce(null)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12_15,
        message: { message_id: 16, text: '/link', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Welcome to 4626.fun on Telegram')
    const buttons = payload.reply_markup.inline_keyboard.flat()
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:begin')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
  })

  it('renders /link in private chats with mini app after onboarding CSW branch (link existing)', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    readTelegramOnboardingSessionMock.mockResolvedValueOnce({
      telegramUserId: '42',
      step: 'branch_link',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12_15_1,
        message: { message_id: 16, text: '/link', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Tap Open Mini App.')
    expect(String(payload.text ?? '')).toContain('If the button fails, return to this DM and tap Open Mini App again.')
    expect(String(payload.text ?? '')).toContain('Do not copy this URL into a browser')
    expect(String(payload.text ?? '')).not.toMatch(/<a href="[^"]+">Open Mini App<\/a>/)
    expect(String(payload.parse_mode ?? '')).toBe('HTML')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.some((button: any) => String(button?.text ?? '').trim() === 'Open Mini App')).toBe(true)
    const openMiniAppButton = allButtons.find((button: any) => String(button?.text ?? '').trim() === 'Open Mini App')
    const launchUrl = String(openMiniAppButton?.web_app?.url ?? openMiniAppButton?.url ?? '')
    expect(decodeURIComponent(launchUrl)).toContain('/telegram/link?')
    expect(decodeURIComponent(launchUrl)).toContain('tgMiniApp=1')
    expect(decodeURIComponent(launchUrl)).toContain('tgEntry=link')
    expect(decodeURIComponent(launchUrl)).toContain('tgChatId=')
    expect(decodeURIComponent(launchUrl)).toContain('tgLinkToken=')
    expect(decodeURIComponent(launchUrl)).toContain('tgZoraBranch=has')
    expect(decodeURIComponent(launchUrl)).toContain('tgCswIntent=has')
    expect(decodeURIComponent(launchUrl)).not.toContain('/continue?')
    expect(decodeURIComponent(launchUrl)).not.toContain('autologin=1')
  })

  it('callback onboard:begin advances to CSW fork with expected inline labels', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    readTelegramOnboardingSessionMock.mockResolvedValue(null)
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
        update_id: 12_21,
        callback_query: {
          id: 'cb-onb-begin',
          data: 'onboard:begin',
          from: { id: 42 },
          message: { message_id: 501, chat: { id: 7726886643 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    const ackPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(ackPayload.text ?? '')).toContain('Next step')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    const body = String(payload.text ?? '')
    expect(body.toLowerCase()).toContain('coinbase smart wallet | 4626.fun')
    expect(body.toLowerCase()).not.toContain('welcome to 4626.fun')
    const buttons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:csw:link')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:csw:create')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
    expect(upsertTelegramOnboardingSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ telegramUserId: '42', step: 'csw_fork' }),
    )
  })

  it('callback onboard:csw:create persists create branch and includes Base app invite + tgCswIntent=need in Mini App URL', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    readTelegramOnboardingSessionMock.mockResolvedValueOnce({
      telegramUserId: '42',
      step: 'csw_fork',
      expiresAt: '2099-01-01T00:00:00.000Z',
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
        update_id: 12_21_1,
        callback_query: {
          id: 'cb-onb-create',
          data: 'onboard:csw:create',
          from: { id: 42 },
          message: { message_id: 503, chat: { id: 7726886643 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertTelegramOnboardingSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ telegramUserId: '42', step: 'branch_create' }),
    )
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    const baseBtn = allButtons.find((b: any) => String(b?.text ?? '').toLowerCase().includes('base'))
    expect(String(baseBtn?.url ?? '')).toContain('base.app')
    const openMiniAppButton = allButtons.find((button: any) => String(button?.text ?? '').trim() === 'Open Mini App')
    const launchUrl = String(openMiniAppButton?.web_app?.url ?? openMiniAppButton?.url ?? '')
    expect(decodeURIComponent(launchUrl)).toContain('tgCswIntent=need')
    expect(decodeURIComponent(launchUrl)).toContain('tgZoraBranch=need')
  })

  it('callback onboard:csw:link without Start step re-shows welcome and nudges Tap Start first', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    readTelegramOnboardingSessionMock.mockResolvedValueOnce({
      telegramUserId: '42',
      step: 'welcome',
      expiresAt: '2099-01-01T00:00:00.000Z',
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
        update_id: 12_22,
        callback_query: {
          id: 'cb-onb-zora-early',
          data: 'onboard:csw:link',
          from: { id: 42 },
          message: { message_id: 502, chat: { id: 7726886643 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const ackPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(ackPayload.text ?? '')).toContain('Tap Start first')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Welcome to 4626.fun on Telegram')
    const buttons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(buttons.some((button: any) => button?.callback_data === 'onboard:begin')).toBe(true)
    expect(buttons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
  })

  it('handles delete callback by removing the bot message', async () => {
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
        update_id: 12_22_1,
        callback_query: {
          id: 'cb-delete',
          data: 'message:delete',
          from: { id: 42 },
          message: { message_id: 503, chat: { id: 7726886643 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/deleteMessage')
    const deletePayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(deletePayload.chat_id).toBe('7726886643')
    expect(deletePayload.message_id).toBe(503)
  })

  it('renders /help connect CTA as menu callback for deterministic /link flow', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 12_16,
        message: { message_id: 160, text: '/help', chat: { id: 7726886643 }, from: { id: 42 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    const connectButton = allButtons.find((button: any) =>
      String(button?.text ?? '')
        .trim()
        .toLowerCase()
        .includes('connect'),
    )
    expect(connectButton).toBeTruthy()
    expect(String(connectButton?.callback_data ?? '')).toBe('menu:connect')
  })

  it('handles /wallet as a telegram-native command without delegating to keepr', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13,
        message: { message_id: 17, text: '/wallet', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(handleTwitterCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('AKITA | WALLET')
    expect(String(payload.text ?? '')).toContain('<blockquote expandable>')
  })

  it('blocks /join when telegram user is not linked', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValueOnce(null)

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13_1,
        message: {
          message_id: 17,
          text: '/join 0x1111111111111111111111111111111111111111',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getHolderRoomPolicyByVaultMock).not.toHaveBeenCalled()
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('link required')
  })

  it('blocks /join when holder threshold is not met', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
    getHolderRoomPolicyByVaultMock.mockResolvedValueOnce({
      chatId: '-100123',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      roomChatId: '-100555',
      minSharesRaw: '1000000000000000000',
      graceHours: 24,
      enabled: true,
      createdAt: null,
      updatedAt: null,
    })
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '1',
        threshold: '1000000000000000000',
        blockNumber: 456,
        rpcUrl: 'https://rpc.example.test',
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13_2,
        message: {
          message_id: 17,
          text: '/join 0x1111111111111111111111111111111111111111',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).not.toHaveBeenCalled()
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('not eligible')
  })

  it('returns one-time room invite when /join user is eligible', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    ;(fetch as any).mockReset()
    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { invite_link: 'https://t.me/+roomInvite123' } }),
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

    getTelegramLinkByUserIdMock.mockResolvedValue({
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
    getHolderRoomPolicyByVaultMock.mockResolvedValueOnce({
      chatId: '-100123',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      roomChatId: '-100555',
      minSharesRaw: '1000000000000000000',
      graceHours: 24,
      enabled: true,
      createdAt: null,
      updatedAt: null,
    })
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: true,
      reason: 'share_balance>=threshold',
      evidence: {
        shareBalance: '2000000000000000000',
        threshold: '1000000000000000000',
        blockNumber: 789,
        rpcUrl: 'https://rpc.example.test',
      },
    })
    upsertHolderRoomMemberMock.mockResolvedValueOnce({
      roomChatId: '-100555',
      telegramUserId: '99',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'active',
      lastEligibleAt: '2026-03-13T00:00:00.000Z',
      graceUntil: null,
      lastCheckedAt: '2026-03-13T00:00:00.000Z',
      removedAt: null,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13_3,
        message: {
          message_id: 17,
          text: '/join 0x1111111111111111111111111111111111111111',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(3)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/createChatInviteLink')
    const invitePayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(invitePayload.chat_id ?? '')).toBe('-100555')
    expect(Number(invitePayload.member_limit)).toBe(1)
    expect(String((fetch as any).mock.calls[1][0])).toContain('/sendMessage')
    const dmPayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(dmPayload.chat_id ?? '')).toBe('99')
    expect(String(dmPayload.text ?? '')).toContain('https://t.me/+roomInvite123')
    expect(String((fetch as any).mock.calls[2][0])).toContain('/sendMessage')
    const groupAckPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(groupAckPayload.chat_id ?? '')).toBe('-100123')
    expect(String(groupAckPayload.text ?? '')).toContain('invite sent via private DM')
  })

  it('keeps holder-room command templates copy-friendly with backticks', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    listHolderRoomPoliciesMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        minSharesRaw: '1000000000000000000',
        graceHours: 24,
        enabled: true,
        createdAt: null,
        updatedAt: null,
      },
    ])

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 13_4,
        message: {
          message_id: 17,
          text: '/rooms',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('`/join` <vault|ticker>')
    expect(String(payload.text ?? '')).toContain('`/eligibility` <vault|ticker>')
    expect(String(payload.parse_mode ?? '')).toBe('Markdown')
  })

  it('handles callback query for telegram-native wallet menu action', async () => {
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
          id: 'cbq-wallet',
          data: 'menu:wallet',
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
    const ackPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(ackPayload.text ?? '')).toContain('Wallet')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Wallet')
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
            id: 'cbq-signals-wallet',
            data: 'menu:wallet',
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
      expect(String(payload.text ?? '')).toContain('Wallet')
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
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
          text: '/buy',
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
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
          text: '/bid',
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
            text: '/buy',
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
          callback_query: {
            id: 'cbq-rate-limit-1',
            data: 'tradeflow:p:buy:0x1111111111111111111111111111111111111111:2500',
            from: { id: 1999 },
            message: { message_id: 18, chat: { id: -100123 } },
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
          callback_query: {
            id: 'cbq-rate-limit-2',
            data: 'tradeflow:p:buy:0x1111111111111111111111111111111111111111:2500',
            from: { id: 1999 },
            message: { message_id: 19, chat: { id: -100123 } },
          },
        },
      })
      const secondRes = createMockRes()
      await handler(secondReq, secondRes)

      expect(firstRes.statusCode).toBe(200)
      expect(secondRes.statusCode).toBe(200)
      expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
      expect((fetch as any).mock.calls.length).toBe(4)
      const secondPayload = JSON.parse(String((fetch as any).mock.calls[3][1]?.body ?? '{}'))
      expect(String(secondPayload.text ?? '')).toContain('rate_limit_user')
    } finally {
      restoreRateLimitEnv()
    }
  })

  it('renders buy preview with signed accept callback token', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
        callback_query: {
          id: 'cbq-preview-buy',
          data: 'tradeflow:p:buy:0x1111111111111111111111111111111111111111:2500',
          from: { id: 99 },
          message: { message_id: 19, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    expect(getDbMock).toHaveBeenCalledTimes(1)
    expect(clearTelegramTradePercentPromptMock).toHaveBeenCalledWith({
      db: expect.anything(),
      chatId: '-100123',
      telegramUserId: '99',
    })
    const previewFunnelCalls = logTelegramFunnelEventMock.mock.calls.map((call) => call[0] ?? {})
    expect(
      previewFunnelCalls.some((entry: any) => entry?.eventName === 'trade_preview_ready' && entry?.actionType === 'buy'),
    ).toBe(true)
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Step 3/3')
    expect(String(payload.text ?? '')).toContain('Preview: BUY')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    expect(Array.isArray(keyboard)).toBe(true)
    const primaryButtons = (keyboard?.[0] ?? []) as Array<any>
    expect(primaryButtons.some((button: any) => String(button?.text ?? '').trim() === 'Accept')).toBe(true)
    expect(primaryButtons.some((button: any) => String(button?.text ?? '').trim() === 'Decline')).toBe(true)
    expect(String(primaryButtons?.[0]?.callback_data ?? '')).toContain('trade:accept:trade-token-1')
    const allButtons = keyboard.flat()
    expect(allButtons.some((button: any) => button?.callback_data === 'message:delete')).toBe(true)
  })

  it('renders bid preview with live auction context and drift safety note', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
        callback_query: {
          id: 'cbq-preview-bid',
          data: 'tradeflow:p:bid:0x1111111111111111111111111111111111111111:2500',
          from: { id: 99 },
          message: { message_id: 19_1, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
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
          data: 'trade:accept:trade-token-1',
          from: { id: 99 },
          message: { message_id: 20, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      text: '/coin buy 0x2222222222222222222222222222222222222222 0.05',
    }))
    expect(logTelegramActionAuditMock).toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(3)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/answerCallbackQuery')
    const callbackAckPayload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(callbackAckPayload.text ?? '')).toContain('Processing')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/editMessageText')
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Confirmed BUY request')
    const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • BUY')
    expect(String(signalPayload.text ?? '')).toContain('Next: `/buy`')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Start Buy' &&
          String(button?.copy_text?.text ?? '').trim() === '/buy',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) => String(button?.text ?? '').trim() === 'Open Wallet' && String(button?.callback_data ?? '') === 'menu:wallet',
      ),
    ).toBe(true)
    expect(signalButtons.some((button: any) => String(button?.text ?? '').trim() === 'View Vault')).toBe(false)
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
            data: 'trade:accept:trade-token-tip',
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

  it('blocks buy callback when canonical wallet is missing', async () => {
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
      canonicalCswAddress: 'not-an-address',
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
        update_id: 16_9,
        callback_query: {
          id: 'cbq-buy-missing-canonical',
          data: 'trade:accept:trade-token-1',
          from: { id: 99 },
          message: { message_id: 20, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('canonical wallet')
    expect(String(payload.text ?? '').toLowerCase()).toContain('not available')
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
            data: 'trade:accept:trade-token-copy-fallback',
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
            String(button?.text ?? '').trim() === 'Start Buy' &&
            String(button?.switch_inline_query_current_chat ?? '').trim() === '/buy',
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
          data: 'trade:accept:trade-token-sell',
          from: { id: 99 },
          message: { message_id: 24, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      text: '/coin sell 0x2222222222222222222222222222222222222222 1200',
    }))
    expect((fetch as any).mock.calls.length).toBe(3)
    const signalPayload = JSON.parse(String((fetch as any).mock.calls[2][1]?.body ?? '{}'))
    expect(String(signalPayload.text ?? '')).toContain('✅ Trade Signal • SELL')
    expect(String(signalPayload.text ?? '')).toContain('Next: `/sell`')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Start Sell' &&
          String(button?.copy_text?.text ?? '').trim() === '/sell',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'View Vault',
      ),
    ).toBe(false)
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
          data: 'trade:accept:trade-token-1',
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
      expect(String(signalPayload.text ?? '')).toContain('Next: `/buy`')
      const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Start Buy' &&
            String(button?.copy_text?.text ?? '').trim() === '/buy',
        ),
      ).toBe(true)
      expect(
        signalButtons.some(
          (button: any) =>
            String(button?.text ?? '').trim() === 'Open Wallet' && String(button?.callback_data ?? '') === 'menu:wallet',
        ),
      ).toBe(true)
      expect(signalButtons.some((button: any) => String(button?.text ?? '').trim() === 'View Vault')).toBe(false)
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
          data: 'trade:accept:trade-token-bid',
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
    expect(String(signalPayload.text ?? '')).toContain('Next: `/bid`')
    const signalButtons = signalPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      signalButtons.some(
        (button: any) =>
          String(button?.text ?? '').trim() === 'Start Bid' &&
          String(button?.copy_text?.text ?? '').trim() === '/bid',
      ),
    ).toBe(true)
    expect(
      signalButtons.some(
        (button: any) => String(button?.text ?? '').trim() === 'Open Wallet' && String(button?.callback_data ?? '') === 'menu:wallet',
      ),
    ).toBe(true)
    expect(signalButtons.some((button: any) => String(button?.text ?? '').trim() === 'View Vault')).toBe(false)
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
          data: 'trade:accept:trade-token-bid-drift',
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
          data: 'trade:accept:trade-token-1',
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
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'menu:buy')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'menu:start')).toBe(true)
    const invalidTokenFunnelCalls = logTelegramFunnelEventMock.mock.calls.map((call) => call[0] ?? {})
    expect(
      invalidTokenFunnelCalls.some(
        (entry: any) => entry?.eventName === 'trade_confirm_token_invalid' && entry?.context?.reason === 'consumed',
      ),
    ).toBe(true)
  })

  it('starts interactive buy flow with a vault picker on /buy', async () => {
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

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_1,
        message: {
          message_id: 30,
          text: '/buy',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Step 1/3')
    expect(String(payload.text ?? '')).toContain('Pick a vault')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    expect(Array.isArray(keyboard)).toBe(true)
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '').startsWith('tradeflow:v:buy:'))).toBe(true)
    expect(clearTelegramTradePercentPromptMock).toHaveBeenCalledWith({
      db: expect.anything(),
      chatId: '-100123',
      telegramUserId: '99',
    })
    const startFunnelCalls = logTelegramFunnelEventMock.mock.calls.map((call) => call[0] ?? {})
    expect(
      startFunnelCalls.some((entry: any) => entry?.eventName === 'trade_flow_started' && entry?.actionType === 'buy'),
    ).toBe(true)
  })

  it('skips funnel logging when chat is outside rollout cohort', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    isTelegramFunnelEventsEnabledForChatMock.mockReturnValue(false)
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
        update_id: 18_1_1,
        message: {
          message_id: 30,
          text: '/buy',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(logTelegramFunnelEventMock).not.toHaveBeenCalled()
  })

  it('shows percent picker after selecting a vault in interactive flow', async () => {
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
        update_id: 18_2,
        callback_query: {
          id: 'cbq-flow-vault-buy',
          data: 'tradeflow:v:buy:0x1111111111111111111111111111111111111111',
          from: { id: 99 },
          message: { message_id: 31, chat: { id: -100123 } },
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
    expect(String(payload.text ?? '')).toContain('Step 2/3')
    expect(String(payload.text ?? '')).toContain('Pick size')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '').startsWith('tradeflow:p:buy:'))).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '').startsWith('tradeflow:c:buy:'))).toBe(true)
  })

  it('rejects typed /buy arguments and guides users to interactive flow', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_3,
        message: {
          message_id: 32,
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
    expect(String(payload.text ?? '')).toContain('/buy')
    expect(String(payload.text ?? '')).toContain('interactive')
  })

  it('prompts for custom percent and stores pending prompt state', async () => {
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
        update_id: 18_4,
        callback_query: {
          id: 'cbq-flow-custom-buy',
          data: 'tradeflow:c:buy:0x1111111111111111111111111111111111111111',
          from: { id: 99 },
          message: { message_id: 33, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertTelegramTradePercentPromptMock).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Custom BUY size')
    expect(String(payload.text ?? '')).toContain('1 and 99.99')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'tradeflow:v:buy:0x1111111111111111111111111111111111111111')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'menu:buy')).toBe(true)
  })

  it('keeps custom percent flow active on invalid input with recovery buttons', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramTradePercentPromptMock.mockResolvedValueOnce({
      chatId: '-100123',
      telegramUserId: '99',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      expiresAt: '2026-03-13T00:03:00.000Z',
      consumedAt: null,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_4_1,
        message: {
          message_id: 33,
          text: 'abc',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(consumeTelegramTradePercentPromptMock).not.toHaveBeenCalled()
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Custom BUY size')
    expect(String(payload.text ?? '')).toContain('between 1 and 99.99')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'tradeflow:v:buy:0x1111111111111111111111111111111111111111')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'menu:buy')).toBe(true)
  })

  it('consumes pending custom percent input and renders a preview', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    getTelegramTradePercentPromptMock.mockResolvedValueOnce({
      chatId: '-100123',
      telegramUserId: '99',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      expiresAt: '2026-03-13T00:03:00.000Z',
      consumedAt: null,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
    })
    consumeTelegramTradePercentPromptMock.mockResolvedValueOnce({
      chatId: '-100123',
      telegramUserId: '99',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      expiresAt: '2026-03-13T00:03:00.000Z',
      consumedAt: '2026-03-13T00:00:45.000Z',
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:45.000Z',
    })
    createTelegramActionTokenMock.mockResolvedValueOnce({
      token: 'trade-token-custom-1',
      expiresAt: '2026-03-13T00:01:30.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValue({
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
        update_id: 18_5,
        message: {
          message_id: 34,
          text: '42%',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(consumeTelegramTradePercentPromptMock).toHaveBeenCalledTimes(1)
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Preview: BUY')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '').startsWith('trade:accept:'))).toBe(true)
  })

  it('starts deploy wizard from /deploy with deploy-type buttons', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_6,
        message: {
          message_id: 35,
          text: '/deploy',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Deploy')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'deploy:type:trend')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'deploy:type:content')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'deploy:type:creator')).toBe(true)
  })

  it('renders deploy preview for trend reserve and includes confirm callback token', async () => {
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
      token: 'deploy-token-1',
      expiresAt: '2026-03-13T00:01:30.000Z',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_7,
        message: {
          message_id: 36,
          text: '/deploy trend BASEAI',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(createTelegramActionTokenMock).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Deploy Preview')
    expect(String(payload.text ?? '')).toContain('TREND')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '').startsWith('deploy:confirm:deploy-token-1'))).toBe(true)
  })

  it('shows deploy recovery actions when deploy confirmation token is expired', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({ ok: false, reason: 'expired' })

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
        update_id: 18_7_1,
        callback_query: {
          id: 'cbq-deploy-expired',
          data: 'deploy:confirm:deploy-token-expired',
          from: { id: 99 },
          message: { message_id: 36, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Deploy confirmation expired')
    const keyboard = payload.reply_markup?.inline_keyboard ?? []
    const flat = keyboard.flat()
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'deploy:type:trend')).toBe(true)
    expect(flat.some((button: any) => String(button?.callback_data ?? '') === 'menu:start')).toBe(true)
  })

  it('confirms deploy callback and executes /coin trend reserve via canonical CSW', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'deploy_trend',
      intentPayload: {
        deployType: 'trend',
        ticker: 'BASEAI',
        commandText: '/coin trend reserve BASEAI',
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
    handleKeeprCommandMock.mockResolvedValueOnce({ ok: true, response: 'Trend reserved + deployed.' })

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
        update_id: 18_8,
        callback_query: {
          id: 'cbq-deploy-confirm',
          data: 'deploy:confirm:deploy-token-1',
          from: { id: 99 },
          message: { message_id: 37, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).toHaveBeenCalledTimes(1)
    expect(handleKeeprCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'xmtp-group-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      text: '/coin trend reserve BASEAI',
    }))
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Deploy sent')
  })

  it('blocks deploy callback when canonical wallet is missing', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'deploy_trend',
      intentPayload: {
        deployType: 'trend',
        ticker: 'BASEAI',
        commandText: '/coin trend reserve BASEAI',
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })
    getTelegramLinkByUserIdMock.mockResolvedValueOnce({
      telegramUserId: '99',
      telegramUsername: 'akita',
      profileId: 7,
      privyUserId: 'did:privy:7',
      canonicalCswAddress: 'invalid-address',
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
        update_id: 18_8_1,
        callback_query: {
          id: 'cbq-deploy-missing-canonical',
          data: 'deploy:confirm:deploy-token-1',
          from: { id: 99 },
          message: { message_id: 37, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(2)
    const payload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(payload.text ?? '').toLowerCase()).toContain('canonical wallet')
    expect(String(payload.text ?? '').toLowerCase()).toContain('not available')
  })

  it('renders vault deploy preview with confirm/decline callbacks', async () => {
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
      token: 'vault-preview-token',
      expiresAt: '2026-03-13T00:05:00.000Z',
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
        update_id: 18_8_2,
        message: {
          message_id: 39,
          text: '/vaultdeploy akita v1.6.1',
          chat: { id: -100123 },
          from: { id: 99 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Vault Deploy Preview • AKITA')
    const buttons = payload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      buttons.some((button: any) => String(button?.callback_data ?? '') === 'vaultdeploy:confirm:vault-preview-token'),
    ).toBe(true)
    expect(
      buttons.some((button: any) => String(button?.callback_data ?? '') === 'vaultdeploy:decline:vault-preview-token'),
    ).toBe(true)
  })

  it('confirms vault deploy callback and renders a single status card with refresh', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    consumeTelegramActionTokenMock.mockResolvedValueOnce({
      ok: true,
      actionType: 'vault_deploy',
      intentPayload: {
        deployType: 'vault',
        token: 'akita',
        version: 'v1.6.1',
        creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        smartWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      expiresAt: '2026-03-13T00:05:00.000Z',
      consumedAt: '2026-03-13T00:00:30.000Z',
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
    startAkitaVaultDeployFromTelegramMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        sessionId: 'session-vault-1',
        nextAction: 'phase2_core_sent',
        predictedContracts: {
          creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
          vault: '0x1111111111111111111111111111111111111111',
          wrapper: '0x2222222222222222222222222222222222222222',
          shareOFT: '0x3333333333333333333333333333333333333333',
          gaugeController: '0x4444444444444444444444444444444444444444',
          ccaStrategy: '0x5555555555555555555555555555555555555555',
          oracle: '0x6666666666666666666666666666666666666666',
        },
      },
    })
    fetchVaultDeployStatusFromTelegramMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        id: 'session-vault-1',
        step: 'phase2_confirmed',
        lastError: null,
        lastUserOpHash: '0x8888888888888888888888888888888888888888888888888888888888888888',
        lastTxHash: '0x7777777777777777777777777777777777777777777777777777777777777777',
        launchImage: null,
        diagnostics: null,
      },
    })
    createTelegramActionTokenMock.mockResolvedValueOnce({
      token: 'vault-status-token',
      expiresAt: '2026-03-13T00:15:00.000Z',
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
        update_id: 18_8_3,
        callback_query: {
          id: 'cbq-vault-confirm',
          data: 'vaultdeploy:confirm:vault-preview-token',
          from: { id: 99 },
          message: { message_id: 40, chat: { id: -100123 } },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(startAkitaVaultDeployFromTelegramMock).toHaveBeenCalledWith({
      canonicalSmartWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      version: 'v1.6.1',
    })
    expect(fetchVaultDeployStatusFromTelegramMock).toHaveBeenCalledWith({
      canonicalSmartWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sessionId: 'session-vault-1',
    })
    expect((fetch as any).mock.calls.length).toBe(2)
    const callbackAck = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(callbackAck.text ?? '')).toContain('Starting deployment')
    const editedPayload = JSON.parse(String((fetch as any).mock.calls[1][1]?.body ?? '{}'))
    expect(String(editedPayload.text ?? '')).toContain('<b>AKITA Vault Deploy</b>')
    expect(String(editedPayload.text ?? '')).toContain('✅ Phase 2 finalize')
    expect(String(editedPayload.text ?? '')).toContain('⬜ Deferred auction launch')
    expect(String(editedPayload.text ?? '')).toContain('https://basescan.org/address/0x1111111111111111111111111111111111111111')
    const buttons = editedPayload.reply_markup?.inline_keyboard?.flat?.() ?? []
    expect(
      buttons.some((button: any) => String(button?.callback_data ?? '') === 'vaultdeploy:status:vault-status-token'),
    ).toBe(true)
    expect(
      buttons.some((button: any) => String(button?.url ?? '').includes('https://basescan.org/tx/')),
    ).toBe(true)
  })

  it('handles /zora as a telegram-native command with web-first guidance', async () => {
    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'top-secret' },
      body: {
        update_id: 18_9,
        message: { message_id: 38, text: '/zora', chat: { id: -100123 }, from: { id: 99 } },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handleKeeprCommandMock).not.toHaveBeenCalled()
    expect((fetch as any).mock.calls.length).toBe(1)
    const payload = JSON.parse(String((fetch as any).mock.calls[0][1]?.body ?? '{}'))
    expect(String(payload.text ?? '')).toContain('Zora')
    expect(String(payload.text ?? '')).toContain('/link')
    expect(String(payload.text ?? '')).toContain('Open 4626 on the web')
    const allButtons = payload.reply_markup?.inline_keyboard?.flat() ?? []
    expect(allButtons.some((button: any) => String(button?.text ?? '').trim() === 'Open Zora Linking')).toBe(false)
  })
})
