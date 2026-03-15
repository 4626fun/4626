import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendTelegramMessage } from '../_handlers/telegram/webhook/telegramApi/messaging'

describe('telegram messaging transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to plain text when Telegram rejects HTML entities', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          '{"ok":false,"error_code":400,"description":"Bad Request: can\'t parse entities: Can\'t find end tag corresponding to start tag \\"code\\""}',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":true,"result":{"message_id":1}}',
      })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    await sendTelegramMessage({
      botToken: 'test-token',
      chatId: '-100123',
      text: '<b>Keepr</b>\n<code>/ai <question></code>',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstInit = (fetchMock.mock.calls as any[])[0]?.[1] as { body?: string }
    const secondInit = (fetchMock.mock.calls as any[])[1]?.[1] as { body?: string }
    const firstBody = JSON.parse(String(firstInit?.body ?? '{}')) as Record<string, unknown>
    const secondBody = JSON.parse(String(secondInit?.body ?? '{}')) as Record<string, unknown>

    expect(firstBody.parse_mode).toBe('HTML')
    expect(secondBody.parse_mode).toBeUndefined()
    expect(String(secondBody.text ?? '')).toContain('/ai <question>')
    expect(String(secondBody.text ?? '')).not.toContain('<code>')
  })
})
