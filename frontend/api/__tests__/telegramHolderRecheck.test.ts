import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureTelegramTradingSchemaMock,
  listHolderRoomMembersNeedingRecheckMock,
  upsertHolderRoomMemberMock,
  checkSharesEligibilityMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureTelegramTradingSchemaMock: vi.fn(),
  listHolderRoomMembersNeedingRecheckMock: vi.fn(),
  upsertHolderRoomMemberMock: vi.fn(),
  checkSharesEligibilityMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/telegramTrading.js', () => ({
  ensureTelegramTradingSchema: ensureTelegramTradingSchemaMock,
  listHolderRoomMembersNeedingRecheck: listHolderRoomMembersNeedingRecheckMock,
  upsertHolderRoomMember: upsertHolderRoomMemberMock,
}))

vi.mock('../../server/_lib/keeprGating.js', () => ({
  checkSharesEligibility: checkSharesEligibilityMock,
}))

describe('telegram holder recheck endpoint', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    restoreEnv = applyEnv({
      TELEGRAM_HOLDER_ROOMS_ENABLED: 'true',
      TELEGRAM_HOLDER_RECHECK_SECRET: 'holder-secret',
      TELEGRAM_BOT_TOKEN: 'test-token',
    })
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    ensureTelegramTradingSchemaMock.mockResolvedValue(undefined)
    upsertHolderRoomMemberMock.mockResolvedValue({
      roomChatId: '-100555',
      telegramUserId: '99',
      canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'active',
      lastEligibleAt: null,
      graceUntil: null,
      lastCheckedAt: null,
      removedAt: null,
      createdAt: null,
      updatedAt: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('first ineligible check sets grace window and warns room', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'active',
        lastEligibleAt: null,
        graceUntil: null,
        lastCheckedAt: null,
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '1',
        threshold: '1000',
        blockNumber: 111,
        rpcUrl: 'https://rpc.example.test',
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('grace')
    expect(typeof call?.graceUntil).toBe('string')
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/sendMessage')
    expect(res.body?.data?.graced).toBe(1)
  })

  it('second ineligible check after grace removes member from room', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'grace',
        lastEligibleAt: '2026-03-12T00:00:00.000Z',
        graceUntil: '2026-03-12T01:00:00.000Z',
        lastCheckedAt: '2026-03-12T01:00:00.000Z',
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '1',
        threshold: '1000',
        blockNumber: 111,
        rpcUrl: 'https://rpc.example.test',
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('removed')
    expect(typeof call?.removedAt).toBe('string')
    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/banChatMember')
    expect(String((fetch as any).mock.calls[1][0])).toContain('/sendMessage')
    expect(res.body?.data?.removed).toBe(1)
  })

  it('keeps grace status when Telegram removal fails so enforcement can retry', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'grace',
        lastEligibleAt: '2026-03-12T00:00:00.000Z',
        graceUntil: '2026-03-12T01:00:00.000Z',
        lastCheckedAt: '2026-03-12T01:00:00.000Z',
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '1',
        threshold: '1000',
        blockNumber: 111,
        rpcUrl: 'https://rpc.example.test',
      },
    })
    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('grace')
    expect(call?.removedAt).toBe(null)
    expect(typeof call?.lastCheckedAt).toBe('string')
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('/banChatMember')
    expect(res.body?.data?.removed).toBe(0)
    expect(res.body?.data?.errors).toBe(1)
  })

  it('re-eligible member clears grace and remains active', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'grace',
        lastEligibleAt: '2026-03-12T00:00:00.000Z',
        graceUntil: '2026-03-14T01:00:00.000Z',
        lastCheckedAt: '2026-03-12T01:00:00.000Z',
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: true,
      reason: 'share_balance>=threshold',
      evidence: {
        shareBalance: '1000',
        threshold: '1000',
        blockNumber: 111,
        rpcUrl: 'https://rpc.example.test',
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('active')
    expect(call?.graceUntil).toBe(null)
    expect((fetch as any).mock.calls.length).toBe(0)
    expect(res.body?.data?.recovered).toBe(1)
  })

  it('keeps grace state when Telegram removal call fails', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'grace',
        lastEligibleAt: '2026-03-12T00:00:00.000Z',
        graceUntil: '2026-03-12T01:00:00.000Z',
        lastCheckedAt: '2026-03-12T01:00:00.000Z',
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'share_balance<threshold',
      evidence: {
        shareBalance: '1',
        threshold: '1000',
        blockNumber: 111,
        rpcUrl: 'https://rpc.example.test',
      },
    })
    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
      json: async () => ({ ok: false }),
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('grace')
    expect(call?.removedAt).toBe(null)
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(res.body?.data?.removed).toBe(0)
    expect(res.body?.data?.errors).toBe(1)
  })

  it('updates lastCheckedAt when onchain reads fail', async () => {
    const { default: handler } = await import('../_handlers/telegram/_holder-recheck.ts')
    listHolderRoomMembersNeedingRecheckMock.mockResolvedValueOnce([
      {
        chatId: '-100123',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        roomChatId: '-100555',
        shareTokenAddress: '0x2222222222222222222222222222222222222222',
        minSharesRaw: '1000',
        graceHours: 24,
        enabled: true,
        telegramUserId: '99',
        canonicalCswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'active',
        lastEligibleAt: '2026-03-12T00:00:00.000Z',
        graceUntil: null,
        lastCheckedAt: null,
      },
    ])
    checkSharesEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      reason: 'onchain_read_failed',
      evidence: {
        shareBalance: '0',
        threshold: '1000',
        blockNumber: null,
        rpcUrl: null,
      },
    })

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-telegram-holder-secret': 'holder-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(upsertHolderRoomMemberMock).toHaveBeenCalledTimes(1)
    const call = upsertHolderRoomMemberMock.mock.calls[0]?.[0] as any
    expect(call?.status).toBe('active')
    expect(typeof call?.lastCheckedAt).toBe('string')
    expect(res.body?.data?.skipped).toBe(1)
  })
})

