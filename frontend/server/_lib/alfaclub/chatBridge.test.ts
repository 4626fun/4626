import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  loggerMock,
  readChatTokenMock,
  requestImmediatePrivyRefreshMock,
  upsertAlfaClubIngestMessagesMock,
  executeDeterministicCommandMock,
  repliedCommandLedgerMock,
  getChatBridgeMessageOriginsMock,
  recordChatBridgeMessageOriginMock,
  relayRoomMessagesToXmtpMock,
  lookupEnabledRoomBindingMock,
  readTrustedAlfaClubCrossChannelIngressMock,
  claimInverseOpinionTradeIntentMock,
  executeInverseAkitaChatReactionMock,
  deliverInverseOpinionTerminalReplyMock,
  tryClaimCommandReplyMock,
} = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  readChatTokenMock: vi.fn(),
  requestImmediatePrivyRefreshMock: vi.fn(),
  upsertAlfaClubIngestMessagesMock: vi.fn(
    async () =>
      [] as Array<{
        roomId: string
        messageId: string
        senderAddress: string
        text: string
        dateMs: number | null
        rawPayloadText?: string | null
      }>,
  ),
  executeDeterministicCommandMock: vi.fn(async () => ({ responseText: '' })),
  repliedCommandLedgerMock: new Set<string>(),
  getChatBridgeMessageOriginsMock: vi.fn(
    async () => new Map<string, 'telegram' | 'xmtp' | 'web4626'>(),
  ),
  recordChatBridgeMessageOriginMock: vi.fn(async () => {}),
  relayRoomMessagesToXmtpMock: vi.fn(async () => ({ enqueued: 0, skipped: 0 })),
  lookupEnabledRoomBindingMock: vi.fn(async (roomId: string) => ({
    available: true,
    binding: {
      roomId,
      enabled: true,
      rolloutStatus: 'enabled',
      telegram: { enabled: true, chatId: '-100123', threadId: null },
      xmtp: {
        enabled: true,
        groupId: `group-${roomId}`,
        syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000001659',
      },
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    },
  })),
  readTrustedAlfaClubCrossChannelIngressMock: vi.fn(
    async (): Promise<{
      id: string
      sourceChannel: 'telegram' | 'xmtp' | 'web4626'
      sourceMessageId: string
      sourceConversationId: string | null
      targetRoomId: string
      originalText: string
      alfaclubRoomId: string | null
      alfaclubMessageId: string | null
      validatedProfileId: string | null
      validatedIssuer: string | null
      claimedAt: string
      linkedAt: string | null
      updatedAt: string
    } | null> => null,
  ),
  claimInverseOpinionTradeIntentMock: vi.fn(),
  executeInverseAkitaChatReactionMock: vi.fn(),
  deliverInverseOpinionTerminalReplyMock: vi.fn(),
  tryClaimCommandReplyMock: vi.fn(),
}))

vi.mock('./commandReplyLedger.js', () => ({
  filterUnrepliedCommandMessageIds: vi.fn(
    async ({ messageIds }: { roomId: string; messageIds: string[] }) =>
      new Set(messageIds.filter((id) => !repliedCommandLedgerMock.has(id))),
  ),
  recordCommandReply: vi.fn(async ({ messageId }: { roomId: string; messageId: string }) => {
    repliedCommandLedgerMock.add(messageId)
  }),
  // tryClaimCommandReply is required by the live command path.
  // to commandReplyLedger.ts without updating this mock, so any test exercising the live
  // command path failed with "No tryClaimCommandReply export is defined on the mock".
  tryClaimCommandReply: tryClaimCommandReplyMock.mockImplementation(
    async ({ messageId }: { roomId: string; messageId: string }) => {
    if (repliedCommandLedgerMock.has(messageId)) return false
    repliedCommandLedgerMock.add(messageId)
    return true
    },
  ),
}))

vi.mock('./inverseOpinionTradeRecorder.js', () => ({
  claimInverseOpinionTradeIntent: claimInverseOpinionTradeIntentMock,
}))

vi.mock('./inverseOpinionTerminalReplyDelivery.js', () => ({
  deliverInverseOpinionTerminalReply: deliverInverseOpinionTerminalReplyMock,
}))

vi.mock('./inverseAkitaChatReaction.js', async () => {
  const actual = await vi.importActual<typeof import('./inverseAkitaChatReaction.js')>(
    './inverseAkitaChatReaction.js',
  )
  return {
    ...actual,
    executeInverseAkitaChatReaction: executeInverseAkitaChatReactionMock,
  }
})

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
  upsertAlfaClubIngestMessages: upsertAlfaClubIngestMessagesMock,
}))

vi.mock('./chatBridgeMessageOrigin.js', () => ({
  getChatBridgeMessageOrigins: getChatBridgeMessageOriginsMock,
  recordChatBridgeMessageOrigin: recordChatBridgeMessageOriginMock,
}))

vi.mock('./crossChannelIngress.js', () => ({
  readTrustedAlfaClubCrossChannelIngress: readTrustedAlfaClubCrossChannelIngressMock,
}))

vi.mock('./roomChannelBridge.js', () => ({
  relayRoomMessagesToXmtp: relayRoomMessagesToXmtpMock,
}))

vi.mock('./roomChannelBindings.js', () => ({
  lookupEnabledAlfaClubRoomChannelBindingByRoom: lookupEnabledRoomBindingMock,
}))

vi.mock('../../agents/core/executeDeterministicCommand.js', () => ({
  executeDeterministicCommand: executeDeterministicCommandMock,
}))

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  collectAlfaClubCommandMessages,
  _ensureLiveCommandSocketForTests,
  _executeInverseAkitaChatReactionBatchForTests,
  _getBridgeAuthStateForTests,
  _ingestLiveMessagesForTests,
  _resetAlfaClubChatBridgeStateForTests,
  _resolveTrustedCommandSenderWalletForTests,
  _runAlfaClubChatBridgeTickForTests,
  _sendCommandReplyToRoomForTests,
  _sendRoomMessageViaWebSocketForTests,
  buildAlfaClubOutboundFrame,
  canBridgeExecuteCommandsInRoom,
  canBridgeReplyInRoom,
  isAlfaClubHistoryIngestSender,
  isHistoryMessageChipIngestCandidate,
  isHistoryMessageMediaKeepCandidate,
  isHistoryMessageCommandCandidate,
  readAlfaClubChatBridgeFlags,
  readAlfaClubChatBridgeFlagsForCronTick,
  readAlfaClubCronSkipLiveWebSocket,
  resolveAlfaClubBridgePollRoomIds,
  sendAlfaClubRoomText,
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
    hermitCommandRoomIds: ['1043'],
    inverseAkitaChatReactionRoomIds: ['1659'],
    jwt: 'jwt-current',
    ingestJwt: null,
    readBotToken: null,
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
    upsertAlfaClubIngestMessagesMock.mockReset()
    upsertAlfaClubIngestMessagesMock.mockResolvedValue([])
    executeDeterministicCommandMock.mockReset()
    executeDeterministicCommandMock.mockResolvedValue({ responseText: '' })
    claimInverseOpinionTradeIntentMock.mockReset()
    claimInverseOpinionTradeIntentMock.mockResolvedValue({
      decisionId: '11111111-1111-4111-8111-111111111111',
      executionPhase: 'claimed',
      executionClaimed: true,
    })
    executeInverseAkitaChatReactionMock.mockReset()
    executeInverseAkitaChatReactionMock.mockResolvedValue({
      ok: true,
      replyText: '',
      reactionEmoji: '',
      counterSide: 'short',
      pair: 'BTC',
    })
    deliverInverseOpinionTerminalReplyMock.mockReset()
    deliverInverseOpinionTerminalReplyMock.mockResolvedValue({
      created: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      sendUnknown: 0,
      errors: 0,
      backlog: {},
    })
    tryClaimCommandReplyMock.mockClear()
    repliedCommandLedgerMock.clear()
    getChatBridgeMessageOriginsMock.mockReset()
    getChatBridgeMessageOriginsMock.mockResolvedValue(new Map())
    recordChatBridgeMessageOriginMock.mockReset()
    recordChatBridgeMessageOriginMock.mockResolvedValue(undefined)
    relayRoomMessagesToXmtpMock.mockReset()
    relayRoomMessagesToXmtpMock.mockResolvedValue({ enqueued: 0, skipped: 0 })
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

  it('retries room history after awaited Privy refresh when the first fetch returns 401', async () => {
    readChatTokenMock
      .mockResolvedValueOnce({
        jwt: 'jwt-stale',
        updatedAt: '2026-05-02T15:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
        updatedBy: 'test',
      })
      .mockResolvedValueOnce({
        jwt: 'jwt-fresh',
        updatedAt: '2026-05-02T15:05:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
        updatedBy: 'privy-token-refresher',
      })

    let historyFetchCalls = 0
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('room_history_paginate')) {
        historyFetchCalls += 1
        if (historyFetchCalls === 1) {
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const result = await _runAlfaClubChatBridgeTickForTests(makeFlags({ jwt: null }))
    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledWith('bridge_auth_fail')
    expect(historyFetchCalls).toBe(2)
    expect(result.errors).toEqual([])
    expect(result.fetched).toBe(0)
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
    // Prior 401 tick marked the JWT bad; the next cron tick refreshes before history fetch.
    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledTimes(1)
    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledWith('bridge_auth_fail')
  })

  it('treats a history-fetch timeout as a quiet transient instead of a tick error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('This operation was aborted')
    }) as unknown as typeof fetch

    const result = await _runAlfaClubChatBridgeTickForTests(makeFlags())
    // Transient timeouts return a clean tick result so the hermit runtime
    // does not emit a per-tick "AlfaClub command errors" warning.
    expect(result.errors).toHaveLength(0)
    expect(loggerMock.info).toHaveBeenCalledWith(
      '[alfaclub-chat] room_history_timeout:transient',
      expect.objectContaining({ consecutive: 1 }),
    )
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      '[alfaclub-chat] room_history_failed:no_fallback',
      expect.anything(),
    )
    // Timeouts are not auth failures — no Privy refresh kick.
    expect(requestImmediatePrivyRefreshMock).not.toHaveBeenCalled()
  })

  it('escalates sustained consecutive history timeouts to warn and resets on recovery', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('This operation was aborted')
    }) as unknown as typeof fetch

    for (let i = 0; i < 5; i += 1) {
      await _runAlfaClubChatBridgeTickForTests(makeFlags())
    }
    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[alfaclub-chat] room_history_timeout:sustained',
      expect.objectContaining({ consecutive: 5 }),
    )

    mockHistorySuccess()
    await _runAlfaClubChatBridgeTickForTests(makeFlags())

    loggerMock.info.mockClear()
    globalThis.fetch = vi.fn(async () => {
      throw new Error('This operation was aborted')
    }) as unknown as typeof fetch
    await _runAlfaClubChatBridgeTickForTests(makeFlags())
    expect(loggerMock.info).toHaveBeenCalledWith(
      '[alfaclub-chat] room_history_timeout:transient',
      expect.objectContaining({ consecutive: 1 }),
    )
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

  it('reuses one websocket when ingesting all rooms across poll room rotation', () => {
    const flags = makeFlags({
      wsIngestAllRoomsEnabled: true,
      roomId: '1659',
      hermitCommandRoomIds: ['1043'],
    })

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1659',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances).toHaveLength(1)

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('reconnects websocket when poll room changes without ingest-all mode', () => {
    const flags = makeFlags({ wsIngestAllRoomsEnabled: false })

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances).toHaveLength(1)

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1659',
      jwt: 'jwt-a',
      flags,
    })
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2)
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
    expect(wsErrorInfos[0]?.[1]).toMatchObject({
      handshakeStatus: 403,
      phase: 'handshake',
      upstream: 'ws.alfaclub.app',
      benignEscalated: false,
    })
  })

  it('marks persistent benign ws_error windows without warning-level spam', () => {
    const flags = makeFlags()

    _ensureLiveCommandSocketForTests({
      websocketUrl: flags.websocketUrl,
      roomId: '1043',
      jwt: 'jwt-a',
      flags,
    })

    const socket = latestFakeSocket()
    expect(socket).toBeDefined()

    for (let i = 0; i < 5; i += 1) {
      socket?.emit('error', { message: 'Received network error or non-101 status code.' })
      vi.advanceTimersByTime(61_000)
    }

    const wsErrorWarns = loggerMock.warn.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_error',
    )
    const wsErrorInfos = loggerMock.info.mock.calls.filter(
      ([message]) => message === '[alfaclub-chat] ws_error',
    )

    expect(wsErrorWarns).toHaveLength(0)
    expect(wsErrorInfos.length).toBeGreaterThanOrEqual(5)
    expect(wsErrorInfos[wsErrorInfos.length - 1]?.[1]).toMatchObject({
      roomId: '1043',
      benignEscalated: true,
      benignWindowsInLast10m: 5,
      phase: 'handshake',
    })
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

  it('normalizes t.me/c URLs and requires HERMIT_TELEGRAM_BOT_TOKEN', () => {
    const previousRelayChat = process.env.HERMIT_TELEGRAM_RELAY_CHAT_ID
    const previousRelayThread = process.env.HERMIT_TELEGRAM_RELAY_THREAD_ID
    const previousRelayBotToken = process.env.HERMIT_TELEGRAM_BOT_TOKEN
    try {
      process.env.HERMIT_TELEGRAM_RELAY_CHAT_ID = 'https://t.me/c/3709479662/2'
      delete process.env.HERMIT_TELEGRAM_RELAY_THREAD_ID
      process.env.HERMIT_TELEGRAM_BOT_TOKEN = 'relay-token'

      const flags = readAlfaClubChatBridgeFlags()
      expect(flags.telegramRelayChatId).toBe('-1003709479662')
      expect(flags.telegramRelayThreadId).toBe(2)
      expect(flags.telegramRelayBotToken).toBe('relay-token')
    } finally {
      if (typeof previousRelayChat === 'undefined') delete process.env.HERMIT_TELEGRAM_RELAY_CHAT_ID
      else process.env.HERMIT_TELEGRAM_RELAY_CHAT_ID = previousRelayChat

      if (typeof previousRelayThread === 'undefined') delete process.env.HERMIT_TELEGRAM_RELAY_THREAD_ID
      else process.env.HERMIT_TELEGRAM_RELAY_THREAD_ID = previousRelayThread

      if (typeof previousRelayBotToken === 'undefined') delete process.env.HERMIT_TELEGRAM_BOT_TOKEN
      else process.env.HERMIT_TELEGRAM_BOT_TOKEN = previousRelayBotToken
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

  it('accepts Telegram-relayed slash commands from non-hex bot sender envelopes', () => {
    const commands = collectAlfaClubCommandMessages({
      messages: [
        {
          id: 'm-telegram-relay',
          date: Date.now(),
          sender: 'keepr4626bot',
          text: '/alfa status\n(tg @akita)',
        },
      ],
      seenMessageIds: new Set<string>(),
    })
    expect(commands).toHaveLength(1)
    expect(commands[0]?.text).toBe('/alfa status')
  })

  it('accepts /halp commands for help-family routing', () => {
    const commands = collectAlfaClubCommandMessages({
      messages: [
        {
          id: 'm-halp',
          date: Date.now(),
          sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
          text: '/halp',
        },
      ],
      seenMessageIds: new Set<string>(),
    })
    expect(commands).toHaveLength(1)
    expect(commands[0]?.text).toBe('/halp')
  })

  it('cron mode does not re-run /gmeow when ingest upsert is an update (not a new row)', async () => {
    const nowMs = Date.now()
    mockHistoryMessages([
      {
        id: 'm-gmeow-once',
        date: nowMs - 10_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
      },
    ])
    // Empty response skips websocket send (fake timers would hang on send timeout).
    upsertAlfaClubIngestMessagesMock
      .mockResolvedValueOnce([{
        roomId: '1043',
        messageId: 'm-gmeow-once',
        senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
        dateMs: nowMs - 10_000,
      }])
      .mockResolvedValueOnce([])

    const first = await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
    })
    const second = await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
    })

    expect(first.processed).toBe(1)
    expect(second.processed).toBe(0)
    expect(executeDeterministicCommandMock).toHaveBeenCalledTimes(1)
  })

  it('command reply ledger skips commands that were already answered', async () => {
    const nowMs = Date.now()
    repliedCommandLedgerMock.add('m-alfa-once')
    mockHistoryMessages([
      {
        id: 'm-alfa-once',
        date: nowMs - 10_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/alfa',
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([{
      roomId: '1043',
      messageId: 'm-alfa-once',
      senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      text: '/alfa',
      dateMs: nowMs - 10_000,
    }])

    const result = await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
    })

    expect(result.processed).toBe(0)
    expect(executeDeterministicCommandMock).not.toHaveBeenCalled()
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

  it('does not fall back to the bot API when a JWT websocket reply fails', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'upstream_failed' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      _sendCommandReplyToRoomForTests({
        flags: makeFlags({
          botToken: 'alfa_bot_still_configured',
          wsProxyHttpSendUrl: 'https://proxy.example/send',
        }),
        jwt: 'jwt-current',
        roomId: '1043',
        text: 'single websocket reply',
        attachments: [],
        replyToMessageId: 'trigger-1',
        replyToMessageDate: Date.now(),
        commandMessageId: 'trigger-1',
      }),
    ).rejects.toThrow('ws_proxy_send_failed:502')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('cron tick options skip live websocket connect', async () => {
    mockHistorySuccess()
    const flags = makeFlags({
      wsIngestAllRoomsEnabled: true,
      ingestJwt: 'jwt-ingest',
    })
    await _runAlfaClubChatBridgeTickForTests(flags, {
      seedHistoryOnlyOnFirstTick: false,
      skipLiveWebSocket: true,
    })
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('ingestCommandCandidatesOnly upserts slash commands only', async () => {
    const nowMs = Date.now()
    mockHistoryMessages([
      {
        id: 'm-chat',
        date: nowMs - 5_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'gm everyone',
      },
      {
        id: 'm-gmeow',
        date: nowMs - 4_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([{
      roomId: '1043',
      messageId: 'm-gmeow',
      senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      text: '/gmeow',
      dateMs: nowMs - 4_000,
    }])

    await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
      ingestCommandCandidatesOnly: true,
    })

    const firstCall = upsertAlfaClubIngestMessagesMock.mock.calls[0] as any
    const rows = (firstCall?.[0] ?? []) as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.messageId).toBe('m-gmeow')
    expect(relayRoomMessagesToXmtpMock).toHaveBeenCalledWith([
      { roomId: '1043', messageId: 'm-gmeow', text: '/gmeow' },
    ])
  })

  it('history ingest persists Chip trade-completed cards for any polled room', async () => {
    const nowMs = Date.now()
    const chipText = JSON.stringify({ coin: 'HYPE', dir: 'Open Long', sz: '0.65' })
    mockHistoryMessages([
      {
        id: 'm-human',
        date: nowMs - 5_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'watching hype',
      },
      {
        id: 'm-chip-open',
        date: nowMs - 4_000,
        sender: 'trade-completed',
        username: 'Chip',
        text: chipText,
        isBot: true,
      },
      {
        id: 'm-other-bot',
        date: nowMs - 3_000,
        sender: 'some-other-system',
        username: 'OtherBot',
        text: 'ignore me',
        isBot: true,
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      {
        roomId: '1484',
        messageId: 'm-human',
        senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'watching hype',
        dateMs: nowMs - 5_000,
      },
      {
        roomId: '1484',
        messageId: 'm-chip-open',
        senderAddress: 'trade-completed',
        username: 'Chip',
        text: chipText,
        dateMs: nowMs - 4_000,
      },
    ])

    await _runAlfaClubChatBridgeTickForTests(
      makeFlags({
        roomId: '1043',
        hermitCommandRoomIds: ['1043', '1659'],
        inverseAkitaChatReactionRoomIds: ['1484', '1659'],
      }),
      {
        seedHistoryOnlyOnFirstTick: false,
        pollRoomId: '1484',
        skipLiveWebSocket: true,
      },
    )

    const firstCall = upsertAlfaClubIngestMessagesMock.mock.calls[0] as any
    const rows = (firstCall?.[0] ?? []) as Array<{ messageId?: string; senderAddress?: string }>
    expect(rows.map((row) => row.messageId).sort()).toEqual(['m-chip-open', 'm-human'])
    expect(rows.find((row) => row.messageId === 'm-chip-open')?.senderAddress).toBe(
      'trade-completed',
    )
    expect(rows.some((row) => row.messageId === 'm-other-bot')).toBe(false)
  })

  it('cron command-only mode still upserts Chip cards alongside slash commands', async () => {
    const nowMs = Date.now()
    const chipText = JSON.stringify({ coin: 'ETH', dir: 'Open Short', sz: '0.1' })
    mockHistoryMessages([
      {
        id: 'm-chat',
        date: nowMs - 5_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'gm everyone',
      },
      {
        id: 'm-chip',
        date: nowMs - 4_500,
        sender: 'trade-completed',
        username: 'Chip',
        text: chipText,
        isBot: true,
      },
      {
        id: 'm-gmeow',
        date: nowMs - 4_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      {
        roomId: '1043',
        messageId: 'm-chip',
        senderAddress: 'trade-completed',
        username: 'Chip',
        text: chipText,
        dateMs: nowMs - 4_500,
      },
      {
        roomId: '1043',
        messageId: 'm-gmeow',
        senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
        dateMs: nowMs - 4_000,
      },
    ])

    await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
      ingestCommandCandidatesOnly: true,
      skipLiveWebSocket: true,
    })

    const firstCall = upsertAlfaClubIngestMessagesMock.mock.calls[0] as any
    const rows = (firstCall?.[0] ?? []) as Array<{ messageId?: string }>
    expect(rows.map((row) => row.messageId).sort()).toEqual(['m-chip', 'm-gmeow'])
    // Chip system cards must not fan out to XMTP/Telegram.
    expect(relayRoomMessagesToXmtpMock).toHaveBeenCalledWith([
      { roomId: '1043', messageId: 'm-gmeow', text: '/gmeow' },
    ])
  })

  it('cron command-only mode upserts GIF/photo drops when auto-keep is enabled', async () => {
    vi.stubEnv('HERMIT_AUTO_KEEP_ENABLED', '1')
    const nowMs = Date.now()
    mockHistoryMessages([
      {
        id: 'm-chat',
        date: nowMs - 5_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'gm everyone',
      },
      {
        id: 'm-gif',
        date: nowMs - 4_200,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '',
        attachments: [{ url: 'https://cdn.example/chef.gif', type: 'gif' }],
      },
      {
        id: 'm-gmeow',
        date: nowMs - 4_000,
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      {
        roomId: '1043',
        messageId: 'm-gif',
        senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '',
        dateMs: nowMs - 4_200,
        attachmentsJson: [{ url: 'https://cdn.example/chef.gif', type: 'gif' }],
      },
      {
        roomId: '1043',
        messageId: 'm-gmeow',
        senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
        dateMs: nowMs - 4_000,
      },
    ])

    await _runAlfaClubChatBridgeTickForTests(makeFlags(), {
      seedHistoryOnlyOnFirstTick: false,
      ingestCommandCandidatesOnly: true,
      skipLiveWebSocket: true,
    })

    const firstCall = upsertAlfaClubIngestMessagesMock.mock.calls[0] as any
    const rows = (firstCall?.[0] ?? []) as Array<{ messageId?: string }>
    expect(rows.map((row) => row.messageId).sort()).toEqual(['m-gif', 'm-gmeow'])
  })

  it('polls Hermit room 1659 when pollRoomId is set on the tick', async () => {
    let historyRoomId = ''
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('room_history_paginate')) {
        historyRoomId = new URL(url).searchParams.get('roomId') ?? ''
        return new Response(
          JSON.stringify({
            messages: [
              {
                id: 'm-1659-gmeow',
                date: Date.now() - 2_000,
                sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
                text: '/gmeow',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([{
      roomId: '1659',
      messageId: 'm-1659-gmeow',
      senderAddress: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      text: '/gmeow',
      dateMs: Date.now() - 2_000,
    }])

    await _runAlfaClubChatBridgeTickForTests(
      makeFlags({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] }),
      {
        seedHistoryOnlyOnFirstTick: false,
        ingestCommandCandidatesOnly: true,
        pollRoomId: '1659',
      },
    )

    expect(historyRoomId).toBe('1659')
  })

  it('does not execute slash commands from an opinion-only room', async () => {
    mockHistoryMessages([
      {
        id: 'opinion-room-command',
        date: Date.now() - 1_000,
        sender: '0x1111111111111111111111111111111111111111',
        text: '/gmeow',
      },
    ])
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      {
        roomId: '1484',
        messageId: 'opinion-room-command',
        senderAddress: '0x1111111111111111111111111111111111111111',
        text: '/gmeow',
        dateMs: Date.now() - 1_000,
      },
    ])

    await _runAlfaClubChatBridgeTickForTests(
      makeFlags({
        roomId: '1043',
        hermitCommandRoomIds: ['1043', '1659'],
        inverseAkitaChatReactionRoomIds: ['1484', '1659'],
      }),
      {
        seedHistoryOnlyOnFirstTick: false,
        pollRoomId: '1484',
      },
    )

    expect(executeDeterministicCommandMock).not.toHaveBeenCalled()
  })

  it('uses read bot token endpoint for room history when configured', async () => {
    let calledUrl = ''
    let authHeader = ''
    globalThis.fetch = vi.fn(async (input, init) => {
      calledUrl = String(input)
      authHeader = String((init as RequestInit | undefined)?.headers
        ? ((init as RequestInit).headers as Record<string, string>)['Authorization'] ?? ''
        : '')
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    await _runAlfaClubChatBridgeTickForTests(
      makeFlags({
        roomId: '1659',
        jwt: null,
        readBotToken: 'alfa_bot_read_token',
      }),
      {
        seedHistoryOnlyOnFirstTick: false,
      },
    )

    expect(calledUrl).toContain('/api/room/1659/messages')
    expect(authHeader).toBe('Bearer alfa_bot_read_token')
  })
})

describe('AlfaClub chat bridge cron helpers', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('readAlfaClubCronSkipLiveWebSocket defaults on', () => {
    restoreEnv = applyEnv({ ALFACLUB_BRIDGE_CRON_SKIP_WS: undefined })
    expect(readAlfaClubCronSkipLiveWebSocket()).toBe(true)
  })

  it('readAlfaClubChatBridgeFlagsForCronTick caps history limit', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_HISTORY_LIMIT: '40',
      ALFACLUB_BRIDGE_CRON_HISTORY_LIMIT: '8',
    })
    expect(readAlfaClubChatBridgeFlagsForCronTick().historyLimit).toBe(8)
  })

  it('unions command and opinion rooms without widening command authority', () => {
    const flags = makeFlags({
      roomId: '1043',
      hermitCommandRoomIds: ['1043', '1659'],
      inverseAkitaChatReactionRoomIds: ['1484', '1660', '2', '1043', '1659'],
    })
    expect(resolveAlfaClubBridgePollRoomIds(flags)).toEqual([
      '1043',
      '1659',
      '1484',
      '1660',
      '2',
    ])
    expect(canBridgeReplyInRoom(flags, '1659')).toBe(true)
    expect(canBridgeReplyInRoom(flags, '1484')).toBe(true)
    expect(canBridgeExecuteCommandsInRoom(flags, '1043')).toBe(true)
    expect(canBridgeExecuteCommandsInRoom(flags, '1484')).toBe(false)
    expect(canBridgeReplyInRoom(flags, '9999')).toBe(false)
  })

  it('isHistoryMessageCommandCandidate ignores bot rows and plain chat', () => {
    expect(
      isHistoryMessageCommandCandidate({
        id: '1',
        date: Date.now(),
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'hello',
        isBot: false,
      }),
    ).toBe(false)
    expect(
      isHistoryMessageCommandCandidate({
        id: '2',
        date: Date.now(),
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
        isBot: false,
      }),
    ).toBe(true)
    expect(
      isHistoryMessageCommandCandidate({
        id: '3',
        date: Date.now(),
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: '/gmeow',
        isBot: true,
      }),
    ).toBe(false)
  })

  it('accepts Chip / trade-completed as history ingest senders', () => {
    expect(isAlfaClubHistoryIngestSender({ sender: 'trade-completed' })).toBe(true)
    expect(isAlfaClubHistoryIngestSender({ sender: 'chip', username: 'Chip' })).toBe(true)
    expect(
      isAlfaClubHistoryIngestSender({
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      }),
    ).toBe(true)
    expect(isAlfaClubHistoryIngestSender({ sender: 'some-bot' })).toBe(false)
    expect(
      isHistoryMessageMediaKeepCandidate({
        id: 'm-gif',
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        attachments: [{ url: 'https://cdn.example/a.gif', type: 'gif' }],
      }),
    ).toBe(true)
    expect(
      isHistoryMessageChipIngestCandidate({
        id: 'chip-1',
        date: Date.now(),
        sender: 'trade-completed',
        username: 'Chip',
        text: JSON.stringify({ coin: 'HYPE', dir: 'Open Long', sz: '0.65' }),
        isBot: true,
      }),
    ).toBe(true)
    expect(
      isHistoryMessageChipIngestCandidate({
        id: 'human-1',
        date: Date.now(),
        sender: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
        text: 'gm',
      }),
    ).toBe(false)
  })
})

describe('inverse opinion decision ordering', () => {
  const intent = {
    id: 'inverse-source-1',
    date: Date.now(),
    sender: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    publicAuthorLabel: '@creator',
    text: 'long btc',
    userSide: 'long' as const,
    pair: 'BTC',
    ordinal: 0,
    parseMode: 'strict' as const,
  }

  beforeEach(() => {
    process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED = '1'
    repliedCommandLedgerMock.clear()
    claimInverseOpinionTradeIntentMock.mockReset()
    claimInverseOpinionTradeIntentMock.mockResolvedValue({
      decisionId: '11111111-1111-4111-8111-111111111111',
      executionPhase: 'claimed',
      executionClaimed: true,
    })
    executeInverseAkitaChatReactionMock.mockReset()
    executeInverseAkitaChatReactionMock.mockResolvedValue({
      ok: true,
      replyText: '',
      reactionEmoji: '',
      counterSide: 'short',
      pair: 'BTC',
    })
    // Reset (not clear): prior tests may leave unused mockResolvedValueOnce entries.
    tryClaimCommandReplyMock.mockReset()
    tryClaimCommandReplyMock.mockImplementation(
      async ({ messageId }: { roomId: string; messageId: string }) => {
        if (repliedCommandLedgerMock.has(messageId)) return false
        repliedCommandLedgerMock.add(messageId)
        return true
      },
    )
  })

  afterEach(() => {
    delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
  })

  it('claims durable attribution before Arena and delegates terminal delivery to the outbox', async () => {
    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(claimInverseOpinionTradeIntentMock).toHaveBeenCalledWith({
      roomId: '1659',
      intent,
    })
    expect(executeInverseAkitaChatReactionMock).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '1659',
      intent,
      claimedDecision: expect.objectContaining({
        decisionId: '11111111-1111-4111-8111-111111111111',
      }),
    }))
    expect(
      claimInverseOpinionTradeIntentMock.mock.invocationCallOrder[0],
    ).toBeLessThan(executeInverseAkitaChatReactionMock.mock.invocationCallOrder[0]!)
    expect(tryClaimCommandReplyMock).not.toHaveBeenCalled()
    expect(deliverInverseOpinionTerminalReplyMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('does not claim a reply or execute when durable attribution is unavailable', async () => {
    claimInverseOpinionTradeIntentMock.mockRejectedValueOnce(new Error('db_unavailable'))

    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(executeInverseAkitaChatReactionMock).not.toHaveBeenCalled()
    expect(tryClaimCommandReplyMock).not.toHaveBeenCalled()
  })

  it('resumes a reclaimed execution lease and delegates its result to durable delivery', async () => {
    tryClaimCommandReplyMock.mockResolvedValueOnce(false)
    claimInverseOpinionTradeIntentMock.mockResolvedValueOnce({
      decisionId: '11111111-1111-4111-8111-111111111111',
      executionPhase: 'claimed',
      executionClaimed: true,
      executionAttemptCount: 2,
    })
    executeInverseAkitaChatReactionMock.mockResolvedValueOnce({
      ok: true,
      replyText: 'stable reclaimed result',
      reactionEmoji: '🔄',
      counterSide: 'short',
      pair: 'BTC',
    })
    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(executeInverseAkitaChatReactionMock).toHaveBeenCalledTimes(1)
    expect(executeInverseAkitaChatReactionMock).toHaveBeenCalledWith(expect.objectContaining({
      claimedDecision: expect.objectContaining({ executionClaimed: true }),
    }))
    expect(deliverInverseOpinionTerminalReplyMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('recovers a persisted terminal result without history-dependent execution or WS delivery', async () => {
    tryClaimCommandReplyMock.mockResolvedValue(false)
    claimInverseOpinionTradeIntentMock.mockResolvedValue({
      decisionId: '11111111-1111-4111-8111-111111111111',
      executionPhase: 'resolved',
      terminalOutcome: 'executed',
      executionClaimed: false,
      receiptSummary: {
        terminalReply: {
          ok: true,
          replyText: 'stable terminal result',
          threadReceiptText: 'stable terminal receipt',
          reactionEmoji: '🔄',
          counterSide: 'short',
          pair: 'BTC',
        },
      },
    })
    const batch = {
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
        botToken: 'bot-token',
        wsProxyHttpSendUrl: 'https://relay.test/ws-send',
        wsProxySecret: 'proxy-secret',
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    }

    await _executeInverseAkitaChatReactionBatchForTests(batch)
    await _executeInverseAkitaChatReactionBatchForTests(batch)

    expect(executeInverseAkitaChatReactionMock).not.toHaveBeenCalled()
    expect(deliverInverseOpinionTerminalReplyMock).toHaveBeenCalledTimes(2)
    expect(tryClaimCommandReplyMock).not.toHaveBeenCalled()
  })

  it('does not execute when another worker owns the durable execution lease', async () => {
    claimInverseOpinionTradeIntentMock.mockResolvedValueOnce({
      decisionId: '11111111-1111-4111-8111-111111111111',
      executionPhase: 'claimed',
      executionClaimed: false,
    })

    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(tryClaimCommandReplyMock).not.toHaveBeenCalled()
    expect(executeInverseAkitaChatReactionMock).not.toHaveBeenCalled()
  })

  it('keeps legacy reply and execution flow free of attribution calls when capture defaults off', async () => {
    delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
    tryClaimCommandReplyMock.mockResolvedValueOnce(true)

    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(claimInverseOpinionTradeIntentMock).not.toHaveBeenCalled()
    expect(deliverInverseOpinionTerminalReplyMock).not.toHaveBeenCalled()
    expect(tryClaimCommandReplyMock).toHaveBeenCalledWith({
      roomId: '1659',
      messageId: intent.id,
      commandHead: 'inverse-chat',
      failureMode: 'closed',
    })
    expect(executeInverseAkitaChatReactionMock).toHaveBeenCalledWith({
      roomId: '1659',
      intent,
    })
  })

  it('does not re-trade when legacy reply claim is already owned after redeploy replay', async () => {
    delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
    tryClaimCommandReplyMock.mockReset()
    tryClaimCommandReplyMock.mockResolvedValue(false)

    await _executeInverseAkitaChatReactionBatchForTests({
      intents: [intent],
      flags: makeFlags({
        roomId: '1659',
        inverseAkitaChatReactionRoomIds: ['1659'],
      }),
      roomId: '1659',
      jwt: 'jwt-current',
    })

    expect(tryClaimCommandReplyMock).toHaveBeenCalled()
    expect(executeInverseAkitaChatReactionMock).not.toHaveBeenCalled()
  })

})

describe('buildAlfaClubOutboundFrame reply/thread contract', () => {
  const root = { id: 'msg-root-1', date: 1_783_440_580_981 }

  it('emits reply_id and reply_date together when the trigger date is known', () => {
    const frame = buildAlfaClubOutboundFrame({
      roomId: '1659',
      text: 'quote reply',
      replyToMessageId: root.id,
      replyToMessageDate: root.date,
    })
    expect(frame.value.reply_id).toBe(root.id)
    expect(frame.value.reply_date).toBe(root.date)
    expect(frame.value.thread_root_id).toBeUndefined()
  })

  it('drops reply_id when the reply date is missing (server rejects lone reply_id)', () => {
    const frame = buildAlfaClubOutboundFrame({
      roomId: '1659',
      text: 'plain send',
      replyToMessageId: root.id,
    })
    expect(frame.value.reply_id).toBeUndefined()
    expect(frame.value.reply_date).toBeUndefined()
  })

  it('emits thread_root_id only alongside a complete reply_id + reply_date pair', () => {
    const threaded = buildAlfaClubOutboundFrame({
      roomId: '1659',
      text: 'thread receipt',
      replyToMessageId: root.id,
      replyToMessageDate: root.date,
      threadRootId: root.id,
    })
    expect(threaded.value.thread_root_id).toBe(root.id)
    expect(threaded.value.reply_id).toBe(root.id)
    expect(threaded.value.reply_date).toBe(root.date)

    const incomplete = buildAlfaClubOutboundFrame({
      roomId: '1659',
      text: 'thread receipt without date',
      replyToMessageId: root.id,
      threadRootId: root.id,
    })
    expect(incomplete.value.thread_root_id).toBeUndefined()
    expect(incomplete.value.reply_id).toBeUndefined()
  })

  it('ignores invalid reply dates', () => {
    const frame = buildAlfaClubOutboundFrame({
      roomId: '1659',
      text: 'bad date',
      replyToMessageId: root.id,
      replyToMessageDate: Number.NaN,
    })
    expect(frame.value.reply_id).toBeUndefined()
    expect(frame.value.reply_date).toBeUndefined()
  })
})

describe('data-driven room channel origin-aware outbound fan-out', () => {
  const realFetch = globalThis.fetch

  function makeInboundMessage(
    overrides: Partial<{
      roomId: string
      id: string
      date: number
      sender: string
      text: string
      username: string
      isBot: boolean
    }> = {},
  ) {
    return {
      roomId: '1659',
      id: 'msg-1',
      date: 1_700_000_000_000,
      sender: '0xabc0000000000000000000000000000000abc00',
      text: 'hello room',
      attachments: [],
      replyAttachments: [],
      rawPayloadText: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    upsertAlfaClubIngestMessagesMock.mockReset()
    getChatBridgeMessageOriginsMock.mockReset()
    getChatBridgeMessageOriginsMock.mockResolvedValue(new Map())
    recordChatBridgeMessageOriginMock.mockReset()
    recordChatBridgeMessageOriginMock.mockResolvedValue(undefined)
    relayRoomMessagesToXmtpMock.mockReset()
    relayRoomMessagesToXmtpMock.mockResolvedValue({ enqueued: 0, skipped: 0 })
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('enqueues the XMTP outbound relay only for messages not already tagged origin=xmtp', async () => {
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      { roomId: '1659', messageId: 'm1', senderAddress: '0xabc', text: 'native message', dateMs: 1000, rawPayloadText: null },
      { roomId: '1659', messageId: 'm2', senderAddress: '0xabc', text: 'xmtp echo', dateMs: 1001, rawPayloadText: null },
    ])
    getChatBridgeMessageOriginsMock.mockResolvedValueOnce(new Map<string, 'telegram' | 'xmtp'>([['m2', 'xmtp']]))

    await _ingestLiveMessagesForTests(
      [makeInboundMessage({ id: 'm1', text: 'native message' }), makeInboundMessage({ id: 'm2', text: 'xmtp echo' })],
      makeFlags({ roomId: '1659', telegramRelayEnabled: false }),
    )

    expect(relayRoomMessagesToXmtpMock).toHaveBeenCalledTimes(1)
    expect(relayRoomMessagesToXmtpMock).toHaveBeenCalledWith([
      { roomId: '1659', messageId: 'm1', text: 'native message' },
      { roomId: '1659', messageId: 'm2', text: 'xmtp echo', origin: 'xmtp' },
    ])
  })

  it('skips relaying a telegram-origin message back to Telegram but still relays cross-channel xmtp-origin messages', async () => {
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      { roomId: '1659', messageId: 't1', senderAddress: '0xabc', text: 'from telegram', dateMs: 1000, rawPayloadText: null },
      { roomId: '1659', messageId: 'x1', senderAddress: '0xabc', text: 'from xmtp', dateMs: 1001, rawPayloadText: null },
    ])
    getChatBridgeMessageOriginsMock.mockResolvedValueOnce(
      new Map<string, 'telegram' | 'xmtp'>([
        ['t1', 'telegram'],
        ['x1', 'xmtp'],
      ]),
    )
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await _ingestLiveMessagesForTests(
      [makeInboundMessage({ id: 't1', text: 'from telegram' }), makeInboundMessage({ id: 'x1', text: 'from xmtp' })],
      makeFlags({
        roomId: '1659',
        telegramRelayEnabled: true,
        telegramRelayBotToken: 'tg-token',
        telegramRelayChatId: '-100123',
      }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(requestInit.body))
    expect(body.text).toContain('from xmtp')
  })

  it('relays native (untagged) messages to both XMTP and Telegram', async () => {
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      { roomId: '1659', messageId: 'n1', senderAddress: '0xabc', text: 'native both', dateMs: 1000, rawPayloadText: null },
    ])
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await _ingestLiveMessagesForTests(
      [makeInboundMessage({ id: 'n1', text: 'native both' })],
      makeFlags({
        roomId: '1659',
        telegramRelayEnabled: true,
        telegramRelayBotToken: 'tg-token',
        telegramRelayChatId: '-100123',
      }),
    )

    expect(relayRoomMessagesToXmtpMock).toHaveBeenCalledWith([
      { roomId: '1659', messageId: 'n1', text: 'native both' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never relays when the message list is empty (no ingest write, no bridge calls)', async () => {
    await _ingestLiveMessagesForTests([], makeFlags({ roomId: '1659' }))

    expect(upsertAlfaClubIngestMessagesMock).not.toHaveBeenCalled()
    expect(relayRoomMessagesToXmtpMock).not.toHaveBeenCalled()
  })

  it('ingests live Chip cards with username/isBot and skips XMTP/Telegram fan-out', async () => {
    const chipText = JSON.stringify({ coin: 'HYPE', dir: 'Open Long', sz: '0.65' })
    upsertAlfaClubIngestMessagesMock.mockResolvedValueOnce([
      {
        roomId: '1484',
        messageId: 'chip-live-1',
        senderAddress: 'trade-completed',
        username: 'Chip',
        text: chipText,
        dateMs: 1000,
        rawPayloadText: null,
      },
    ])

    await _ingestLiveMessagesForTests(
      [
        makeInboundMessage({
          roomId: '1484',
          id: 'chip-live-1',
          sender: 'trade-completed',
          username: 'Chip',
          isBot: true,
          text: chipText,
        }),
      ],
      makeFlags({
        roomId: '1484',
        telegramRelayEnabled: true,
        telegramRelayBotToken: 'tg-token',
        telegramRelayChatId: '-100123',
      }),
    )

    const upsertRows = upsertAlfaClubIngestMessagesMock.mock.calls[0]?.[0] as Array<{
      senderAddress?: string
      username?: string | null
      isBot?: boolean | null
    }>
    expect(upsertRows).toHaveLength(1)
    expect(upsertRows[0]?.senderAddress).toBe('trade-completed')
    expect(upsertRows[0]?.username).toBe('Chip')
    expect(upsertRows[0]?.isBot).toBe(true)
    expect(relayRoomMessagesToXmtpMock).not.toHaveBeenCalled()
  })
})

describe('_resolveTrustedCommandSenderWalletForTests', () => {
  const nativeSender = '0x1111111111111111111111111111111111111111'
  const trustedIssuer = '0x2222222222222222222222222222222222222222'

  beforeEach(() => {
    getChatBridgeMessageOriginsMock.mockReset()
    getChatBridgeMessageOriginsMock.mockResolvedValue(new Map())
    readTrustedAlfaClubCrossChannelIngressMock.mockReset()
    readTrustedAlfaClubCrossChannelIngressMock.mockResolvedValue(null)
  })

  it('allows native hex senders without an ingress envelope', async () => {
    const resolved = await _resolveTrustedCommandSenderWalletForTests({
      roomId: '1659',
      messageId: 'native-1',
      sender: nativeSender,
      text: '/help',
    })

    expect(resolved).toEqual({
      senderWallet: nativeSender,
      source: 'native',
      commandText: '/help',
    })
    expect(readTrustedAlfaClubCrossChannelIngressMock).not.toHaveBeenCalled()
  })

  it('denies web4626-origin commands when trusted ingress is missing', async () => {
    getChatBridgeMessageOriginsMock.mockResolvedValueOnce(
      new Map<string, 'telegram' | 'xmtp' | 'web4626'>([['web-1', 'web4626']]),
    )

    const resolved = await _resolveTrustedCommandSenderWalletForTests({
      roomId: '1659',
      messageId: 'web-1',
      sender: 'relay-bot',
      text: '/help',
    })

    expect(resolved).toBeNull()
    expect(readTrustedAlfaClubCrossChannelIngressMock).toHaveBeenCalledWith({
      alfaclubRoomId: '1659',
      alfaclubMessageId: 'web-1',
    })
  })

  it('allows web4626-origin commands when trusted ingress supplies the issuer', async () => {
    getChatBridgeMessageOriginsMock.mockResolvedValueOnce(
      new Map<string, 'telegram' | 'xmtp' | 'web4626'>([['web-2', 'web4626']]),
    )
    readTrustedAlfaClubCrossChannelIngressMock.mockResolvedValueOnce({
      id: 'ing-1',
      sourceChannel: 'web4626',
      sourceMessageId: 'client-2',
      sourceConversationId: 'web4626:1659',
      targetRoomId: '1659',
      originalText: '/status',
      alfaclubRoomId: '1659',
      alfaclubMessageId: 'web-2',
      validatedProfileId: '42',
      validatedIssuer: trustedIssuer,
      claimedAt: '2026-07-13T00:00:00.000Z',
      linkedAt: '2026-07-13T00:00:01.000Z',
      updatedAt: '2026-07-13T00:00:01.000Z',
    })

    const resolved = await _resolveTrustedCommandSenderWalletForTests({
      roomId: '1659',
      messageId: 'web-2',
      sender: 'relay-bot',
      text: 'ignored wrapper',
    })

    expect(resolved).toEqual({
      senderWallet: trustedIssuer,
      source: 'ingress',
      commandText: '/status',
    })
  })
})

describe('sendAlfaClubRoomText JWT message ids + refresh fallback', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    readChatTokenMock.mockReset()
    readChatTokenMock.mockResolvedValue(null)
    requestImmediatePrivyRefreshMock.mockReset()
    requestImmediatePrivyRefreshMock.mockResolvedValue({
      status: 'refreshed',
      identityTokenExp: null,
    })
    recordChatBridgeMessageOriginMock.mockReset()
    recordChatBridgeMessageOriginMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('returns messageId from the JWT HTTP /message response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: 'jwt-msg-42', roomId: '1484' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const result = await sendAlfaClubRoomText({
      roomId: '1484',
      text: 'hello from web',
      clientMessageId: 'web4626:1484:client-1',
      flags: makeFlags({
        roomId: '1484',
        jwt: 'jwt-current',
        botToken: null,
      }),
      origin: 'web4626',
    })

    expect(result).toEqual({
      lane: 'jwt_http_without_reply_id',
      messageId: 'jwt-msg-42',
    })
    expect(recordChatBridgeMessageOriginMock).toHaveBeenCalledWith({
      roomId: '1484',
      messageId: 'jwt-msg-42',
      origin: 'web4626',
    })
  })

  it('uses the refreshed JWT on WS fallback after HTTP auth retry fails', async () => {
    requestImmediatePrivyRefreshMock.mockImplementation(async () => {
      readChatTokenMock.mockResolvedValue({
        jwt: 'jwt-refreshed',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
      return { status: 'refreshed' as const, identityTokenExp: null }
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/room/') && url.includes('/message')) {
        return new Response(JSON.stringify({ error: 'invalid or revoked token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('ws-proxy-send')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await sendAlfaClubRoomText({
      roomId: '1484',
      text: 'retry via ws',
      flags: makeFlags({
        roomId: '1484',
        jwt: 'jwt-stale',
        botToken: null,
        wsProxyHttpSendUrl: 'https://relay.example/ws-proxy-send',
        wsProxySecret: 'secret',
      }),
    })

    expect(requestImmediatePrivyRefreshMock).toHaveBeenCalledWith('bridge_auth_fail')
    expect(result.lane).toBe('ws_proxy_http_primary')
    const proxyCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('ws-proxy-send'),
    )
    expect(proxyCall).toBeTruthy()
    const body = JSON.parse(String((proxyCall?.[1] as RequestInit | undefined)?.body ?? '{}')) as {
      jwt?: string
    }
    expect(body.jwt).toBe('jwt-refreshed')
  })
})
