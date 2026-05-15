import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loggerMock, readChatTokenMock, requestImmediatePrivyRefreshMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  readChatTokenMock: vi.fn(),
  requestImmediatePrivyRefreshMock: vi.fn(),
}))

vi.mock('../infra/logger.js', () => ({
  logger: loggerMock,
}))

vi.mock('./chatTokenStore.js', async () => {
  const actual = await vi.importActual<typeof import('./chatTokenStore.js')>('./chatTokenStore.js')
  return {
    ...actual,
    readAlfaClubChatToken: readChatTokenMock,
  }
})

vi.mock('./privyTokenRefresher.js', () => ({
  requestImmediatePrivyRefresh: requestImmediatePrivyRefreshMock,
}))

vi.mock('./chatIngestStore.js', () => ({
  upsertAlfaClubIngestMessages: vi.fn(async () => []),
}))

vi.mock('../../agent/core/executeDeterministicCommand.js', () => ({
  executeDeterministicCommand: vi.fn(async () => ({ responseText: '' })),
}))

import {
  collectAlfaClubCommandMessages,
  _ensureLiveCommandSocketForTests,
  _getBridgeAuthStateForTests,
  _resetAlfaClubChatBridgeStateForTests,
  _runAlfaClubChatBridgeTickForTests,
  _sendRoomMessageViaWebSocketForTests,
  readAlfaClubChatBridgeFlags,
  type AlfaClubChatBridgeFlags,
} from './chatBridge.js'
import {
  _resetBridgeAuthHealthForTests,
  readBridgeAuthHealthSnapshot,
} from './authHealthStore.js'

type Listener = (event?: unknown) => void

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  listeners = new Map<string, Listener[]>()
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(event: string, listener: Listener): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
  }

  removeEventListener(event: string, listener: Listener): void {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((entry) => entry !== listener),
    )
  }

  send(): void {}

  close(): void {
    this.emit('close', { code: 1000, reason: 'test close' })
  }

  emit(event: string, payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload)
    }
  }
}

function makeFlags(overrides: Partial<AlfaClubChatBridgeFlags> = {}): AlfaClubChatBridgeFlags {
  return {
    killSwitch: false,
    enabled: true,
    roomId: '1043',
    jwt: 'jwt-current',
    ingestJwt: null,
    botToken: null,
    apiBaseUrl: 'https://api.alfaclub.app',
    apiProxyUrl: null,
    apiProxySecret: null,
    websocketUrl: 'wss://ws.alfaclub.app',
    groupId: 'alfaclub-room-1043',
    pollIntervalMs: 6_000,
    historyLimit: 20,
    sendTimeoutMs: 10_000,
    requestTimeoutMs: 8_000,
    wsLiveFallbackEnabled: true,
    wsIngestAllRoomsEnabled: false,
    telegramRelayEnabled: false,
    telegramRelayBotToken: null,
    telegramRelayChatId: null,
    telegramRelayThreadId: null,
    ...overrides,
  }
}

function mockHistoryStatus(status: number): void {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ error: 'test' }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

function mockHistorySuccess(): void {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

function mockHistoryMessages(messages: Array<{ id: string; date: number; sender: string; text: string }>): void {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

function latestFakeSocket(): FakeWebSocket | undefined {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
}

describe('AlfaClub chat bridge auth-loop hardening', () => {
  const realFetch = globalThis.fetch
  const realWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T15:00:00.000Z'))
    loggerMock.info.mockClear()
    loggerMock.warn.mockClear()
    loggerMock.error.mockClear()
    readChatTokenMock.mockReset()
    readChatTokenMock.mockResolvedValue(null)
    requestImmediatePrivyRefreshMock.mockReset()
    requestImmediatePrivyRefreshMock.mockResolvedValue({ status: 'refreshed', identityTokenExp: null })
    FakeWebSocket.instances = []
    ;(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket
    _resetBridgeAuthHealthForTests()
    _resetAlfaClubChatBridgeStateForTests()
  })

  afterEach(() => {
    _resetAlfaClubChatBridgeStateForTests()
    _resetBridgeAuthHealthForTests()
    globalThis.fetch = realFetch
    ;(globalThis as { WebSocket?: unknown }).WebSocket = realWebSocket
    vi.useRealTimers()
  })

  it('kicks an immediate Privy refresh on room-history auth failure only', async () => {
    mockHistoryStatus(401)
    await _runAlfaClubChatBridgeTickForTests(makeFlags())
    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledTimes(1)
    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledWith('bridge_auth_fail')

    requestImmediatePrivyRefreshMock.mockClear()
    mockHistoryStatus(500)
    await expect(_runAlfaClubChatBridgeTickForTests(makeFlags())).rejects.toThrow(
      /room_history_failed:500/,
    )
    expect(requestImmediatePrivyRefreshMock).not.toHaveBeenCalled()
  })

  it('memoizes a known-bad JWT and suppresses repeat live-socket attempts', async () => {
    mockHistoryStatus(401)
    const flags = makeFlags({ wsIngestAllRoomsEnabled: true })
    await _runAlfaClubChatBridgeTickForTests(flags)
    await _runAlfaClubChatBridgeTickForTests(flags)

    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(readBridgeAuthHealthSnapshot().suppressedSocketAttempts).toBe(2)
    expect(_getBridgeAuthStateForTests().lastBadJwt).toBe('jwt-current')
  })

  it('backs off websocket reconnects after consecutive ws_error events', () => {
    const flags = makeFlags()

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    latestFakeSocket()?.emit('error', { message: 'bad token' })
    expect(_getBridgeAuthStateForTests().socketBackoffMs).toBe(1_000)

    vi.advanceTimersByTime(1_001)
    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    latestFakeSocket()?.emit('error', { message: 'bad token' })
    expect(_getBridgeAuthStateForTests().socketBackoffMs).toBe(2_000)

    vi.advanceTimersByTime(2_001)
    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    latestFakeSocket()?.emit('error', { message: 'bad token' })
    expect(_getBridgeAuthStateForTests().socketBackoffMs).toBe(4_000)

    const before = FakeWebSocket.instances.length
    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances).toHaveLength(before)

    vi.advanceTimersByTime(4_001)
    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances.length).toBeGreaterThan(before)
  })

  it('logs benign non-101 websocket closes at info level', () => {
    const flags = makeFlags()

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })

    const socket = latestFakeSocket()
    expect(socket).toBeDefined()

    socket?.emit('error', { message: 'Received network error or non-101 status code.' })
    socket?.emit('close', { code: 1006, reason: '' })

    const wsCloseWarns = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_close',
    )
    const wsCloseInfos = loggerMock.info.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_close',
    )

    expect(wsCloseWarns).toHaveLength(0)
    expect(wsCloseInfos).toHaveLength(1)
  })

  it('logs websocket 403 handshake failures at info level', () => {
    const flags = makeFlags()

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })

    const socket = latestFakeSocket()
    expect(socket).toBeDefined()
    socket?.emit('error', { message: 'Unexpected server response: 403' })

    const wsErrorWarns = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_error',
    )
    const wsErrorInfos = loggerMock.info.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_error',
    )

    expect(wsErrorWarns).toHaveLength(0)
    expect(wsErrorInfos).toHaveLength(1)
  })

  it('rolls up duplicate room-history auth fallback warnings within 60 seconds', async () => {
    mockHistoryStatus(401)

    for (let i = 0; i < 30; i += 1) {
      await _runAlfaClubChatBridgeTickForTests(makeFlags())
      vi.advanceTimersByTime(1_000)
    }

    const authFallbackWarnings = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] room_history_auth_failed:ws_live_fallback',
    )
    // Initial event is logged immediately with `repeats: 1`; subsequent
    // events inside the 60 s window are accumulated and flushed as a
    // separate `:rollup` summary line at window close (see
    // `flushAuthFailRollup`).
    expect(authFallbackWarnings).toHaveLength(1)
    expect(authFallbackWarnings[0]?.[1]).toMatchObject({ repeats: 1 })
  })

  it('emits exactly two log lines for a burst within 60s: initial + roll-up summary with repeats === N', async () => {
    mockHistoryStatus(401)

    // Five tightly-spaced events well inside the 60 s window.
    const N = 5
    for (let i = 0; i < N; i += 1) {
      await _runAlfaClubChatBridgeTickForTests(makeFlags())
      vi.advanceTimersByTime(2_000)
    }

    // Cross the 60 s boundary so the one-shot flush timer fires.
    vi.advanceTimersByTime(60_000)

    const initial = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] room_history_auth_failed:ws_live_fallback',
    )
    const summary = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] room_history_auth_failed:ws_live_fallback:rollup',
    )

    expect(initial).toHaveLength(1)
    expect(initial[0]?.[1]).toMatchObject({ repeats: 1 })
    expect(summary).toHaveLength(1)
    expect(summary[0]?.[1]).toMatchObject({ repeats: N })
  })

  it('clears auth-failure counters and bad-JWT memo after history recovery', async () => {
    mockHistoryStatus(401)
    await _runAlfaClubChatBridgeTickForTests(makeFlags())
    expect(readBridgeAuthHealthSnapshot().consecutiveAuthFailures).toBe(1)
    expect(_getBridgeAuthStateForTests().lastBadJwt).toBe('jwt-current')

    mockHistorySuccess()
    await _runAlfaClubChatBridgeTickForTests(makeFlags())

    expect(readBridgeAuthHealthSnapshot().consecutiveAuthFailures).toBe(0)
    expect(_getBridgeAuthStateForTests().lastBadJwt).toBeNull()
  })

  it('normalizes t.me/c URLs and falls back to TELEGRAM_BOT_TOKEN', () => {
    const previousRelayChat = process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID
    const previousRelayThread = process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID
    const previousRelayBotToken = process.env.ALFACLUB_TELEGRAM_BOT_TOKEN
    const previousTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    try {
      process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID = 'https://t.me/c/3709479662/2'
      delete process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID
      delete process.env.ALFACLUB_TELEGRAM_BOT_TOKEN
      process.env.TELEGRAM_BOT_TOKEN = 'fallback-token'

      const flags = readAlfaClubChatBridgeFlags()
      expect(flags.telegramRelayChatId).toBe('-1003709479662')
      expect(flags.telegramRelayThreadId).toBe(2)
      expect(flags.telegramRelayBotToken).toBe('fallback-token')
    } finally {
      if (typeof previousRelayChat === 'undefined') delete process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID
      else process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID = previousRelayChat

      if (typeof previousRelayThread === 'undefined') delete process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID
      else process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID = previousRelayThread

      if (typeof previousRelayBotToken === 'undefined') delete process.env.ALFACLUB_TELEGRAM_BOT_TOKEN
      else process.env.ALFACLUB_TELEGRAM_BOT_TOKEN = previousRelayBotToken

      if (typeof previousTelegramBotToken === 'undefined') delete process.env.TELEGRAM_BOT_TOKEN
      else process.env.TELEGRAM_BOT_TOKEN = previousTelegramBotToken
    }
  })

  it('dequotes wrapped env values for proxy/base config', () => {
    const previousBase = process.env.ALFACLUB_CHAT_API_BASE_URL
    const previousProxyUrl = process.env.ALFACLUB_CHAT_API_PROXY_URL
    const previousProxySecret = process.env.ALFACLUB_CHAT_API_PROXY_SECRET
    const previousRoomId = process.env.ALFACLUB_CHAT_ROOM_ID
    try {
      process.env.ALFACLUB_CHAT_API_BASE_URL = '"https://api.alfaclub.app"'
      process.env.ALFACLUB_CHAT_API_PROXY_URL = '"https://alfaclub-proxy.steep-dew-0c33.workers.dev"'
      process.env.ALFACLUB_CHAT_API_PROXY_SECRET = '"proxy-secret"'
      process.env.ALFACLUB_CHAT_ROOM_ID = '"1043"'

      const flags = readAlfaClubChatBridgeFlags()
      expect(flags.apiBaseUrl).toBe('https://api.alfaclub.app')
      expect(flags.apiProxyUrl).toBe('https://alfaclub-proxy.steep-dew-0c33.workers.dev')
      expect(flags.apiProxySecret).toBe('proxy-secret')
      expect(flags.roomId).toBe('1043')
    } finally {
      if (typeof previousBase === 'undefined') delete process.env.ALFACLUB_CHAT_API_BASE_URL
      else process.env.ALFACLUB_CHAT_API_BASE_URL = previousBase

      if (typeof previousProxyUrl === 'undefined') delete process.env.ALFACLUB_CHAT_API_PROXY_URL
      else process.env.ALFACLUB_CHAT_API_PROXY_URL = previousProxyUrl

      if (typeof previousProxySecret === 'undefined') delete process.env.ALFACLUB_CHAT_API_PROXY_SECRET
      else process.env.ALFACLUB_CHAT_API_PROXY_SECRET = previousProxySecret

      if (typeof previousRoomId === 'undefined') delete process.env.ALFACLUB_CHAT_ROOM_ID
      else process.env.ALFACLUB_CHAT_ROOM_ID = previousRoomId
    }
  })

  it('warns when websocket closes churn inside 60 seconds', () => {
    const flags = makeFlags()
    for (let i = 0; i < 5; i += 1) {
      _ensureLiveCommandSocketForTests({
        websocketUrl: flags.websocketUrl,
        roomId: '1043',
        jwt: 'jwt-a',
        flags,
      })
      latestFakeSocket()?.emit('close', { code: 1005, reason: '' })
      vi.advanceTimersByTime(_getBridgeAuthStateForTests().socketBackoffMs + 1)
    }

    const churnWarnings = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_close_churn',
    )
    expect(churnWarnings).toHaveLength(1)
    expect(churnWarnings[0]?.[1]).toMatchObject({
      roomId: '1043',
      latestCode: 1005,
      closesInWindow: 5,
    })
  })

  it('normalizes trusted sender bare gmeow variants into /gmeow', () => {
    const commands = collectAlfaClubCommandMessages({
      messages: [
        {
          id: 'm-gmeow',
          date: Date.now(),
          sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
          text: 'Gmeoww https://x.com/i/status/2053460215681695890',
        },
      ],
      seenMessageIds: new Set<string>(),
    })
    expect(commands).toHaveLength(1)
    expect(commands[0]?.text).toBe('/gmeow')
  })

  it('processes recent slash commands on first seed tick', async () => {
    const nowMs = Date.now()
    mockHistoryMessages([
      {
        id: 'm-recent-gmeow',
        date: nowMs - 10_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
      },
    ])

    const result = await _runAlfaClubChatBridgeTickForTests(makeFlags())
    expect(result.seeded).toBe(true)
    expect(result.processed).toBe(1)
  })

  it('reports ws_proxy_http when websocket send goes through the HTTP proxy lane', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const lane = await _sendRoomMessageViaWebSocketForTests({
      websocketUrl: 'wss://ws.alfaclub.app',
      wsProxyHttpSendUrl: 'https://proxy.example/send',
      wsProxySecret: 'secret-123',
      jwt: 'jwt-current',
      roomId: '1043',
      text: 'gm',
      timeoutMs: 5_000,
    })

    expect(lane).toBe('ws_proxy_http')
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('reports websocket when websocket send uses the raw ws lane', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('fetch should not be used for raw websocket lane')
    }) as unknown as typeof fetch

    const lanePromise = _sendRoomMessageViaWebSocketForTests({
      websocketUrl: 'wss://ws.alfaclub.app',
      jwt: 'jwt-current',
      roomId: '1043',
      text: 'gm',
      timeoutMs: 5_000,
    })

    const socket = latestFakeSocket()
    expect(socket).toBeDefined()
    socket?.emit('open')
    socket?.emit('close', { code: 1000, reason: 'ok' })

    await expect(lanePromise).resolves.toBe('websocket')
  })
})
