import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { handleKeeprCommandMock, handleTwitterCommandMock } = vi.hoisted(() => ({
  handleKeeprCommandMock: vi.fn(),
  handleTwitterCommandMock: vi.fn(),
}))

vi.mock('../../server/keepr/commands.js', () => ({
  handleKeeprCommand: handleKeeprCommandMock,
}))

vi.mock('../../server/twitter/commands.js', () => ({
  handleTwitterCommand: handleTwitterCommandMock,
}))

describe('telegram webhook handler', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_TARGET_CHAT_ID: '-100123',
      TELEGRAM_WEBHOOK_SECRET: 'top-secret',
      TELEGRAM_ADMIN_USER_IDS: '42',
      TELEGRAM_DEFAULT_SENDER_WALLET: '0x00000000000000000000000000000000000000aa',
      TELEGRAM_GROUP_ID_MAP_JSON: JSON.stringify({ '-100123': 'xmtp-group-1' }),
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
})
