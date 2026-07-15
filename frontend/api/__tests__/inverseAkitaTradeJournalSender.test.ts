import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readFlagsMock = vi.hoisted(() => vi.fn())

vi.mock('../../server/_lib/alfaclub/apiAuth.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/alfaclub/apiAuth.js')>('../../server/_lib/alfaclub/apiAuth.js')
  return {
    ...actual,
    readAlfaClubApiAuthFlags: readFlagsMock,
  }
})

import {
  readAlfaClubBotSenderReadiness,
  sendAlfaClubBotTextStrict,
  sendInverseAkitaJournalTextStrict,
} from '../../server/_lib/alfaclub/inverseAkitaTradeJournalSender.js'

describe('InverseAKITA strict journal sender', () => {
  beforeEach(() => {
    readFlagsMock.mockReturnValue({
      apiBaseUrl: 'https://api.alfaclub.test',
      apiProxyUrl: null,
      apiProxySecret: null,
      botToken: 'bot-secret',
      readBotToken: null,
      jwt: 'must-not-be-used',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('uses only the bot token and stable client-message id', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(
      JSON.stringify({ messageId: 'parent-1' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendInverseAkitaJournalTextStrict({
      roomId: '1659',
      text: 'journal',
      clientMessageId: 'stable-window-parent',
    })).resolves.toEqual({
      lane: 'bot_token_strict_parent',
      messageId: 'parent-1',
    })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer bot-secret',
      'Idempotency-Key': expect.stringContaining('stable-window-parent'),
    })
    expect(JSON.stringify(init)).not.toContain('must-not-be-used')
  })

  it('reports strict sender readiness without exposing the bot token', () => {
    expect(readAlfaClubBotSenderReadiness()).toEqual({ ready: true, errorCode: null })
    expect(JSON.stringify(readAlfaClubBotSenderReadiness())).not.toContain('bot-secret')

    readFlagsMock.mockReturnValueOnce({
      apiBaseUrl: 'https://api.alfaclub.test',
      apiProxyUrl: null,
      apiProxySecret: null,
      botToken: null,
      readBotToken: null,
      jwt: 'must-not-be-used',
    })
    expect(readAlfaClubBotSenderReadiness()).toEqual({
      ready: false,
      errorCode: 'alfaclub_bot_token_missing',
    })
  })

  it('fails closed as send_unknown when a successful response has no stable message id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(sendInverseAkitaJournalTextStrict({
      roomId: '1659',
      text: 'journal',
      clientMessageId: 'stable-window-parent',
    })).rejects.toMatchObject({ code: 'journal_send_unknown' })
  })

  it('does not fall back to JWT after a definitive bot-token rejection', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => (
      new Response('forbidden', { status: 403 })
    ))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendInverseAkitaJournalTextStrict({
      roomId: '1659',
      text: 'journal',
      clientMessageId: 'stable-window-parent',
    })).rejects.toMatchObject({ code: 'journal_send_failed' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses the identical strict bot transport key on immediate and recovery sends', async () => {
    const keys: Array<string | null> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key'))
      return new Response(JSON.stringify({ messageId: 'terminal-result-1' }), { status: 200 })
    }))
    const delivery = {
      roomId: '1659',
      text: 'terminal result',
      replyToMessageId: 'source-message-1',
      clientMessageId: 'inverse-opinion:decision-1:result',
    }

    await sendAlfaClubBotTextStrict(delivery)
    await sendAlfaClubBotTextStrict(delivery)

    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
    expect(keys[0]).toContain(delivery.clientMessageId)
  })
})
