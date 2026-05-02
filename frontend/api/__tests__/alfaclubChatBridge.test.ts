import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from './helpers'

import {
  _ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS,
  _fetchRoomHistoryForTests,
  _isRoomHistoryAuthErrorForTests,
  _markReadMessageForTests,
  _shouldSuppressDeterministicReplyForTests,
  buildAlfaClubOutboundFrame,
  collectAlfaClubCommandMessages,
  extractAlfaClubWsMessagesForTest,
  readAlfaClubChatBridgeFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubFingerprintBaseUrl,
  resolveAlfaClubOriginHeaders,
} from '../../server/_lib/alfaclub/chatBridge.ts'

describe('readAlfaClubChatBridgeFlags', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('parses required env vars and applies sane defaults', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_GROUP_ID: 'alfa-room-main',
      ALFACLUB_CHAT_POLL_INTERVAL_MS: '7000',
      ALFACLUB_CHAT_HISTORY_LIMIT: '35',
      ALFACLUB_CHAT_SEND_TIMEOUT_MS: '9000',
      ALFACLUB_CHAT_API_BASE_URL: 'https://api.alfaclub.app',
      ALFACLUB_CHAT_WS_URL: 'wss://ws.alfaclub.app',
      ALFACLUB_VIGILANTE_KILL_SWITCH: '0',
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_TARGET_CHAT_ID: undefined,
      ALFACLUB_TELEGRAM_RELAY_CHAT_ID: undefined,
      ALFACLUB_TELEGRAM_RELAY_ENABLED: undefined,
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.enabled).toBe(true)
    expect(flags.killSwitch).toBe(false)
    expect(flags.roomId).toBe('1043')
    expect(flags.jwt).toBe('token-xyz')
    expect(flags.ingestJwt).toBeNull()
    expect(flags.groupId).toBe('alfa-room-main')
    expect(flags.pollIntervalMs).toBe(7000)
    expect(flags.historyLimit).toBe(35)
    expect(flags.sendTimeoutMs).toBe(9000)
    expect(flags.wsLiveFallbackEnabled).toBe(true)
    expect(flags.wsIngestAllRoomsEnabled).toBe(true)
    expect(flags.telegramRelayEnabled).toBe(false)
    expect(flags.telegramRelayChatId).toBeNull()
  })

  it('falls back when room id is invalid', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: 'room-abc',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_GROUP_ID: undefined,
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.roomId).toBeNull()
    expect(flags.groupId).toBe('alfaclub-room-unknown')
    expect(flags.wsLiveFallbackEnabled).toBe(true)
    expect(flags.wsIngestAllRoomsEnabled).toBe(true)
  })

  it('allows disabling websocket live fallback', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_WS_LIVE_FALLBACK_ENABLED: '0',
      ALFACLUB_CHAT_WS_INGEST_ALL_ROOMS_ENABLED: '0',
      TELEGRAM_BOT_TOKEN: 'telegram-token',
      ALFACLUB_TELEGRAM_RELAY_CHAT_ID: '@fun4626',
      ALFACLUB_TELEGRAM_RELAY_ENABLED: '0',
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.wsLiveFallbackEnabled).toBe(false)
    expect(flags.wsIngestAllRoomsEnabled).toBe(false)
    expect(flags.telegramRelayEnabled).toBe(false)
    expect(flags.telegramRelayChatId).toBe('@fun4626')
  })

  it('supports a dedicated ingest jwt for all-room websocket ingestion', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'command-token',
      ALFACLUB_CHAT_INGEST_JWT: 'ingest-token',
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.jwt).toBe('command-token')
    expect(flags.ingestJwt).toBe('ingest-token')
  })

  it('auto-enables telegram relay when bot token and destination are configured', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      TELEGRAM_BOT_TOKEN: 'telegram-token',
      ALFACLUB_TELEGRAM_RELAY_CHAT_ID: '@fun4626',
      ALFACLUB_TELEGRAM_RELAY_THREAD_ID: '77',
      ALFACLUB_TELEGRAM_RELAY_ENABLED: undefined,
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.telegramRelayEnabled).toBe(true)
    expect(flags.telegramRelayBotToken).toBe('telegram-token')
    expect(flags.telegramRelayChatId).toBe('@fun4626')
    expect(flags.telegramRelayThreadId).toBe(77)
  })
})

describe('collectAlfaClubCommandMessages', () => {
  it('collects only unseen /alfa commands from external senders', () => {
    const commands = collectAlfaClubCommandMessages({
      seenMessageIds: new Set<string>(['m-seen']),
      selfAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      messages: [
        { id: 'm-old', date: 10, sender: '0x1111111111111111111111111111111111111111', text: '/help' },
        { id: 'm-seen', date: 11, sender: '0x1111111111111111111111111111111111111111', text: '/alfa' },
        { id: 'm-self', date: 12, sender: '0xab6d5c10b03300326cd7fab7267ae192842967b5', text: '/alfa' },
        { id: 'm-command-bot', date: 13, sender: 'command-bot', text: '/alfa' },
        { id: 'm-valid-2', date: 14, sender: '0x2222222222222222222222222222222222222222', text: '/alfaclub status' },
        { id: 'm-valid-1', date: 9, sender: '0x1111111111111111111111111111111111111111', text: '/alfa 0xaaa' },
        { id: 'm-hermit', date: 15, sender: '0x3333333333333333333333333333333333333333', text: '/gmeow gm' },
      ],
    })

    expect(commands).toHaveLength(3)
    expect(commands[0]).toMatchObject({
      id: 'm-valid-1',
      sender: '0x1111111111111111111111111111111111111111',
    })
    expect(commands[1]).toMatchObject({
      id: 'm-valid-2',
      sender: '0x2222222222222222222222222222222222222222',
    })
    expect(commands[2]).toMatchObject({
      id: 'm-hermit',
      sender: '0x3333333333333333333333333333333333333333',
      text: '/gmeow gm',
    })
  })

  describe('bare gmeow from trusted sender', () => {
    const MANITO = '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5'
    const SELF = '0xab6d5c10b03300326cd7fab7267ae192842967b5'

    it('treats bare "gmeow" from Manito9v9 as a /gmeow command', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: MANITO, text: 'gmeow' },
        ],
      })
      expect(commands).toEqual([
        { id: 'm1', date: 100, sender: MANITO, text: '/gmeow' },
      ])
    })

    it('accepts case and surrounding whitespace variants', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: MANITO, text: 'GMEOW' },
          { id: 'm2', date: 101, sender: MANITO, text: '  Gmeow  ' },
          { id: 'm3', date: 102, sender: MANITO, text: '\tgmeow\n' },
        ],
      })
      expect(commands.map((c) => c.text)).toEqual(['/gmeow', '/gmeow', '/gmeow'])
    })

    it('does not trigger for other addresses sending bare gmeow', () => {
      const otherAddress = '0x4444444444444444444444444444444444444444'
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: otherAddress, text: 'gmeow' },
          { id: 'm2', date: 101, sender: otherAddress, text: 'GMEOW' },
        ],
      })
      expect(commands).toHaveLength(0)
    })

    it('does not trigger on bare gmeow with extra content even from Manito', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: MANITO, text: 'gmeow gm' },
          { id: 'm2', date: 101, sender: MANITO, text: 'hey gmeow' },
          { id: 'm3', date: 102, sender: MANITO, text: 'gmeow!' },
        ],
      })
      expect(commands).toHaveLength(0)
    })

    it('still routes a real /gmeow with args from any sender', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(),
        selfAddress: SELF,
        messages: [
          { id: 'm1', date: 100, sender: '0x5555555555555555555555555555555555555555', text: '/gmeow gm' },
          { id: 'm2', date: 101, sender: MANITO, text: '/gmeow' },
        ],
      })
      expect(commands).toHaveLength(2)
      expect(commands[0]).toMatchObject({ id: 'm1', text: '/gmeow gm' })
      expect(commands[1]).toMatchObject({ id: 'm2', text: '/gmeow' })
    })

    it('respects dedupe and self-skip even for trusted bare gmeow', () => {
      const commands = collectAlfaClubCommandMessages({
        seenMessageIds: new Set<string>(['m-seen']),
        selfAddress: SELF,
        messages: [
          { id: 'm-seen', date: 99, sender: MANITO, text: 'gmeow' },
          { id: 'm-self', date: 100, sender: SELF, text: 'gmeow' },
          { id: 'm-ok', date: 101, sender: MANITO, text: 'gmeow' },
        ],
      })
      expect(commands).toEqual([
        { id: 'm-ok', date: 101, sender: MANITO, text: '/gmeow' },
      ])
    })
  })
})

describe('buildAlfaClubOutboundFrame', () => {
  it('builds the canonical message websocket frame', () => {
    expect(
      buildAlfaClubOutboundFrame({
        roomId: '1043',
        text: 'hello',
      }),
    ).toEqual({
      type: 'message',
      value: {
        room: '1043',
        text: 'hello',
        attachments: [],
      },
    })
  })

  it('passes through validated public media attachments', () => {
    expect(
      buildAlfaClubOutboundFrame({
        roomId: '1043',
        text: '',
        attachments: [
          {
            url: 'https://media.tenor.com/rfbhh3Hh3DMAAAAC/mochi-mochimons.gif',
            dims: [498, 498],
            size: 1_468_750,
            type: 'tenor-gif',
            preview: '',
            duration: 2,
          },
        ],
      }),
    ).toEqual({
      type: 'message',
      value: {
        room: '1043',
        text: '',
        attachments: [
          {
            url: 'https://media.tenor.com/rfbhh3Hh3DMAAAAC/mochi-mochimons.gif',
            dims: [498, 498],
            size: 1_468_750,
            type: 'tenor-gif',
            preview: '',
            duration: 2,
          },
        ],
      },
    })
  })
})

describe('extractAlfaClubWsMessagesForTest', () => {
  it('keeps attachment-only photo messages from captured AlfaChat payloads', () => {
    const messages = extractAlfaClubWsMessagesForTest({
      type: 'message',
      value: {
        room: '1043',
        id: '9152e6a3-dfc9-4d13-833b-c755156f79b6',
        date: 1777141691499,
        sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
        text: '',
        attachments: [
          {
            url: 'https://volvarrdooikeahzzvqc.storage.supabase.co/storage/v1/object/public/attachments/1043/ff60038a-e8c3-4a39-874a-9863321ca593.jpeg',
            dims: [735, 734],
            type: 'photo',
            filename: 'ff60038a-e8c3-4a39-874a-9863321ca593.jpeg',
            mime_type: 'image/jpeg',
          },
        ],
      },
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      roomId: '1043',
      id: '9152e6a3-dfc9-4d13-833b-c755156f79b6',
      sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
      text: '',
      attachments: [
        {
          type: 'photo',
          filename: 'ff60038a-e8c3-4a39-874a-9863321ca593.jpeg',
          mime_type: 'image/jpeg',
        },
      ],
    })
  })

  it('keeps reply attachments on text messages', () => {
    const messages = extractAlfaClubWsMessagesForTest({
      room: '1043',
      id: 'ba301f4a-e109-447c-8b37-6eee91fee44b',
      date: 1777273576700,
      sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
      text: 'replying with another gif',
      attachments: [
        {
          url: 'https://media.tenor.com/gojal78Yfu8AAAAC/miau-cat.gif',
          dims: [487, 498],
          size: 2_449_893,
          type: 'tenor-gif',
          preview: '',
          duration: 0.9,
        },
      ],
      reply_attachments: [
        {
          url: 'https://media.tenor.com/rfbhh3Hh3DMAAAAC/mochi-mochimons.gif',
          dims: [498, 498],
          size: 1_468_750,
          type: 'tenor-gif',
          preview: '',
          duration: 2,
        },
      ],
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.attachments?.[0]).toMatchObject({
      type: 'tenor-gif',
      duration: 0.9,
    })
    expect(messages[0]?.replyAttachments?.[0]).toMatchObject({
      type: 'tenor-gif',
      duration: 2,
    })
  })
})

describe('isRoomHistoryAuthError', () => {
  it('matches 401 from fetchRoomHistory', () => {
    expect(_isRoomHistoryAuthErrorForTests(new Error('room_history_failed:401'))).toBe(true)
  })

  it('matches 403 from fetchRoomHistory', () => {
    // AlfaClub returns 403 when the JWT is authenticated but lacks permission
    // for the configured room (stale identity token, removed membership, etc.).
    // Treating 403 the same as 401 lets the bridge fall through to the env
    // JWT retry and websocket live-fallback paths instead of bubbling a 500.
    expect(_isRoomHistoryAuthErrorForTests(new Error('room_history_failed:403'))).toBe(true)
  })

  it('does not match other history failures', () => {
    expect(_isRoomHistoryAuthErrorForTests(new Error('room_history_failed:500'))).toBe(false)
    expect(_isRoomHistoryAuthErrorForTests(new Error('room_history_failed:timeout:abort'))).toBe(false)
    expect(_isRoomHistoryAuthErrorForTests(new Error('room_history_failed:unknown'))).toBe(false)
    expect(_isRoomHistoryAuthErrorForTests(new Error('something_else'))).toBe(false)
  })

  it('handles non-Error values', () => {
    expect(_isRoomHistoryAuthErrorForTests('room_history_failed:403')).toBe(true)
    expect(_isRoomHistoryAuthErrorForTests(null)).toBe(false)
  })
})

// Defense-in-depth filter added after a 2026-05-01 incident: a stale
// build of this bridge running in parallel with the canonical Vercel
// cron emitted "Hermit access denied." into AlfaClub room 1043 as a
// `keepr4626bot` reply. Under current main, PR #467's
// `isAlfaClubChatId` short-circuit prevents that string from ever
// being produced for an AlfaClub chatId; this filter is a leaf-level
// belt-and-suspenders so the user never sees it even when the
// surrounding stack is misconfigured.
describe('shouldSuppressDeterministicReply', () => {
  it('suppresses the canonical "Hermit access denied." string', () => {
    expect(_shouldSuppressDeterministicReplyForTests('Hermit access denied.')).toBe(true)
  })

  it('also suppresses the no-period variant (defensive)', () => {
    expect(_shouldSuppressDeterministicReplyForTests('Hermit access denied')).toBe(true)
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(_shouldSuppressDeterministicReplyForTests('  HERMIT ACCESS DENIED.  ')).toBe(true)
    expect(_shouldSuppressDeterministicReplyForTests('hermit access denied.')).toBe(true)
  })

  it('does NOT suppress unrelated bridge replies', () => {
    expect(_shouldSuppressDeterministicReplyForTests('No response generated.')).toBe(false)
    expect(_shouldSuppressDeterministicReplyForTests('gmeow')).toBe(false)
    expect(_shouldSuppressDeterministicReplyForTests('Hermit drafts room-ready copy.')).toBe(false)
    expect(_shouldSuppressDeterministicReplyForTests('Want me to remember your style?')).toBe(false)
  })

  it('does NOT suppress a Hermit reply that merely *mentions* "access denied" inside a longer message', () => {
    // Boundary: only the EXACT trimmed/lower string is suppressed.
    // A future Hermit creative reply that quotes the phrase in a
    // sentence should still go through.
    expect(
      _shouldSuppressDeterministicReplyForTests(
        'Hermit access denied is the historical bug we fixed in PR #467.',
      ),
    ).toBe(false)
  })

  it('does NOT suppress empty / whitespace-only / non-string-y inputs', () => {
    expect(_shouldSuppressDeterministicReplyForTests('')).toBe(false)
    expect(_shouldSuppressDeterministicReplyForTests('   ')).toBe(false)
  })
})

// AlfaClub's API origin is fronted by Cloudflare's browser-integrity
// check. A fetch that uses Node's default User-Agent (or only sends
// Authorization + Accept) is rejected with HTTP 403 / CF error 1010
// `browser_signature_banned`. The bridge sends a small, fixed bag of
// browser-like headers — these tests pin that contract.
describe('fetchRoomHistory — Cloudflare-friendly request shape', () => {
  type CapturedRequest = {
    url: string
    method: string
    headers: Record<string, string>
  }

  function installFetchSpy(opts: {
    status: number
    body?: unknown
    captured: CapturedRequest[]
  }) {
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    const stub = vi.fn(async (input: unknown, init?: { method?: string; headers?: Record<string, string> }) => {
      const url = typeof input === 'string' ? input : String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      opts.captured.push({
        url,
        method: init?.method ?? 'GET',
        headers,
      })
      const bodyText =
        typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body ?? { messages: [] })
      return new Response(bodyText, {
        status: opts.status,
        headers: { 'content-type': 'application/json' },
      })
    })
    ;(globalThis as { fetch?: typeof fetch }).fetch = stub as unknown as typeof fetch
    return () => {
      ;(globalThis as { fetch?: typeof fetch }).fetch = original
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends User-Agent / Accept / Origin / Referer / Sec-Fetch-* alongside Authorization Bearer', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }

    expect(captured).toHaveLength(1)
    const headers = captured[0]?.headers ?? {}
    // Authorization remains the only credential.
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
    // Browser-fingerprint headers — the Cloudflare WAF check.
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/)
    expect(headers['User-Agent']).not.toMatch(/node-fetch|undici|axios/i)
    expect(headers.Accept).toContain('application/json')
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
    expect(headers['Sec-Fetch-Mode']).toBe('cors')
    expect(headers['Sec-Fetch-Dest']).toBe('empty')
  })

  it('hits the documented endpoint shape (path + query params)', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }

    const url = new URL(captured[0]?.url ?? '')
    expect(url.origin + url.pathname).toBe(
      'https://api.alfaclub.app/api/websocket/room_history_paginate',
    )
    expect(url.searchParams.get('roomId')).toBe('1043')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('forward')).toBe('false')
    expect(captured[0]?.method).toBe('GET')
  })

  it('THROWS on HTTP 403 (Cloudflare 1010) — does NOT silently coerce to fetched:0', async () => {
    // Production regression 2026-05-01: a Cloudflare browser-signature
    // ban returned 403, the bridge funnelled it through wsLiveFallback
    // and reported `fetched: 0` with NO `errors[]` entry. The fetch
    // helper must surface the failure so the caller (runBridgeTick)
    // can record it.
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 403,
      body: '<html>Cloudflare Error 1010: browser_signature_banned</html>',
      captured,
    })
    try {
      await expect(
        _fetchRoomHistoryForTests({
          apiBaseUrl: 'https://api.alfaclub.app',
          roomId: '1043',
          jwt: 'fake-jwt-redacted',
          limit: 20,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow('room_history_failed:403')
    } finally {
      restore()
    }
    expect(captured).toHaveLength(1)
  })

  it('THROWS on HTTP 401 (auth) and HTTP 5xx (server) too', async () => {
    for (const status of [401, 500, 502, 503]) {
      const captured: CapturedRequest[] = []
      const restore = installFetchSpy({ status, body: 'nope', captured })
      try {
        await expect(
          _fetchRoomHistoryForTests({
            apiBaseUrl: 'https://api.alfaclub.app',
            roomId: '1043',
            jwt: 'fake-jwt-redacted',
            limit: 20,
            timeoutMs: 5_000,
          }),
        ).rejects.toThrow(`room_history_failed:${status}`)
      } finally {
        restore()
      }
    }
  })

  it('returns parsed messages on HTTP 200 with the expected body shape', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 200,
      body: {
        messages: [
          { id: 'a', date: 1700000000000, sender: '0xa', text: '/gmeow' },
          { id: 'b', date: 1700000010000, sender: '0xb', text: '/hermit setup' },
        ],
        nextCursor: null,
        prevCursor: null,
      },
      captured,
    })
    try {
      const result = await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe('a')
    } finally {
      restore()
    }
  })

  it('exports the common (origin-agnostic) browser-headers map with no secrets and a stable key set', () => {
    // Regression guard so a future refactor doesn't accidentally drop
    // any of the origin-agnostic headers. Origin / Referer /
    // Sec-Fetch-Site are NOT in this map — they're derived per-call
    // from `apiBaseUrl` by `resolveAlfaClubOriginHeaders`. See the
    // separate "origin-aware headers" describe block below.
    const keys = Object.keys(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS).sort()
    expect(keys).toEqual([
      'Accept',
      'Accept-Encoding',
      'Accept-Language',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'User-Agent',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
    ])
    // No `Authorization`/`Cookie`/etc. baked in — those are
    // per-request only. No host-cross-referencing headers either —
    // those are derived from `apiBaseUrl`.
    expect(keys).not.toContain('Authorization')
    expect(keys).not.toContain('Cookie')
    expect(keys).not.toContain('Set-Cookie')
    expect(keys).not.toContain('Origin')
    expect(keys).not.toContain('Referer')
    expect(keys).not.toContain('Sec-Fetch-Site')
    // Sanity: no token-shaped substring in any value.
    for (const value of Object.values(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS)) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{6,}/)
      expect(value).not.toMatch(/Bearer\s/i)
    }
  })
})

describe('fetchRoomHistory — origin-aware headers (PR #491 Codex review)', () => {
  type CapturedRequest = {
    url: string
    method: string
    headers: Record<string, string>
  }

  function installFetchSpy(opts: {
    status: number
    body?: unknown
    captured: CapturedRequest[]
  }) {
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    const stub = vi.fn(async (input: unknown, init?: { method?: string; headers?: Record<string, string> }) => {
      const url = typeof input === 'string' ? input : String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      opts.captured.push({
        url,
        method: init?.method ?? 'GET',
        headers,
      })
      const bodyText =
        typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body ?? { messages: [] })
      return new Response(bodyText, {
        status: opts.status,
        headers: { 'content-type': 'application/json' },
      })
    })
    ;(globalThis as { fetch?: typeof fetch }).fetch = stub as unknown as typeof fetch
    return () => {
      ;(globalThis as { fetch?: typeof fetch }).fetch = original
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('default production base (https://api.alfaclub.app) preserves Origin/Referer/Sec-Fetch-Site', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
  })

  it('staging non-AlfaClub base (https://staging-api.example.test) OMITS Origin/Referer/Sec-Fetch-Site', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://staging-api.example.test',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(headers.Origin).toBeUndefined()
    expect(headers.Referer).toBeUndefined()
    expect(headers['Sec-Fetch-Site']).toBeUndefined()
    // Common headers are still present — those don't cross-reference
    // a specific origin.
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/)
    expect(headers.Accept).toContain('application/json')
    expect(headers['Sec-Fetch-Mode']).toBe('cors')
    expect(headers['Sec-Fetch-Dest']).toBe('empty')
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
  })

  it('local replay base (http://localhost:3000) OMITS Origin/Referer/Sec-Fetch-Site', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'http://localhost:3000',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(headers.Origin).toBeUndefined()
    expect(headers.Referer).toBeUndefined()
    expect(headers['Sec-Fetch-Site']).toBeUndefined()
  })

  it('alfaclub-family page host (https://alfaclub.app) keeps the page-origin fingerprint', async () => {
    // Defensive: if a future deploy ever routes the API directly
    // through the page host (no `api.` prefix), we still want the
    // browser-fingerprint headers attached. The known-host check
    // strips `api.` if present and falls through otherwise.
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({ status: 200, body: { messages: [] }, captured })
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
  })

  it('a malformed apiBaseUrl OMITS the origin triplet (and does not throw)', async () => {
    // The fetch helper still tries to use the URL — `new URL('not a url',
    // ...)` will throw inside fetch — but the header-derivation step
    // must not crash before that. We assert this via the unit
    // `resolveAlfaClubOriginHeaders` call below.
    expect(resolveAlfaClubOriginHeaders('not a url')).toEqual({})
    expect(resolveAlfaClubOriginHeaders('')).toEqual({})
  })
})

// PR #491 follow-up: production Vercel still got 403 even with the
// browser-like headers. Add (a) sanitized diagnostic detail in the
// thrown error, (b) closer Chromium fingerprint headers, and (c) an
// optional `ALFACLUB_CHAT_API_PROXY_URL` escape hatch.
describe('fetchRoomHistory — sanitized 403/non-2xx error detail', () => {
  type CapturedRequest = {
    url: string
    method: string
    headers: Record<string, string>
  }

  function installFetchSpy(opts: {
    status: number
    body: string
    responseHeaders?: Record<string, string>
    captured: CapturedRequest[]
  }) {
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    const stub = vi.fn(async (input: unknown, init?: { method?: string; headers?: Record<string, string> }) => {
      const url = typeof input === 'string' ? input : String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      opts.captured.push({
        url,
        method: init?.method ?? 'GET',
        headers,
      })
      return new Response(opts.body, {
        status: opts.status,
        headers: {
          'content-type': 'application/json',
          ...(opts.responseHeaders ?? {}),
        },
      })
    })
    ;(globalThis as { fetch?: typeof fetch }).fetch = stub as unknown as typeof fetch
    return () => {
      ;(globalThis as { fetch?: typeof fetch }).fetch = original
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('captures Cloudflare cf-ray + html-error-code + cloudflare=true on a CF 1010 ban', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 403,
      body:
        '<html><head><title>Cloudflare</title></head><body>' +
        'Error 1010<br>Access denied<br>The site owner has blocked access ' +
        'based on your browser\'s signature.<br>Cloudflare Ray ID: 8e7c7e7e7e7e0001' +
        '</body></html>',
      responseHeaders: {
        'cf-ray': '8e7c7e7e7e7e0001-IAD',
        'cf-mitigated': 'challenge',
        'content-type': 'text/html; charset=utf-8',
      },
      captured,
    })
    try {
      await expect(
        _fetchRoomHistoryForTests({
          apiBaseUrl: 'https://api.alfaclub.app',
          roomId: '1043',
          jwt: 'fake-jwt-redacted',
          limit: 20,
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/^room_history_failed:403:.+/)
    } finally {
      restore()
    }
    // Re-spy and capture the actual error message text for further
    // assertions below.
    const captured2: CapturedRequest[] = []
    const restore2 = installFetchSpy({
      status: 403,
      body:
        '<html>Cloudflare Error 1010<br>Cloudflare Ray ID: 8e7c7e7e7e7e0001</html>',
      responseHeaders: {
        'cf-ray': '8e7c7e7e7e7e0001-IAD',
        'cf-mitigated': 'challenge',
        'cf-error-code': '1010',
        'content-type': 'text/html; charset=utf-8',
      },
      captured: captured2,
    })
    let message = ''
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    } finally {
      restore2()
    }
    expect(message).toContain('room_history_failed:403')
    expect(message).toContain('cf-ray=8e7c7e7e7e7e0001-IAD')
    expect(message).toContain('cf-mitigated=challenge')
    expect(message).toContain('cf-error-code=1010')
    expect(message).toContain('cloudflare=true')
    expect(message).toContain('html-error-code=1010')
    expect(message.length).toBeLessThanOrEqual(260)
  })

  it('captures structured JSON error.code/message from a non-CF 4xx', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 401,
      body: JSON.stringify({
        error: 'Unauthorized',
        code: 'invalid_jwt',
        details: { roomId: '1043' },
      }),
      responseHeaders: { 'content-type': 'application/json' },
      captured,
    })
    let message = ''
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    } finally {
      restore()
    }
    expect(message).toContain('room_history_failed:401')
    expect(message).toContain('code=invalid_jwt')
    expect(message).toContain('error="Unauthorized"')
  })

  it('redacts JWT-shaped substrings from any captured body excerpt', async () => {
    const fakeJwt =
      'header_xxxxxxx.payload_yyyyyyy.signature_zzzzzzz'
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 500,
      body: `gateway error: token=${fakeJwt}`,
      responseHeaders: { 'content-type': 'text/plain' },
      captured,
    })
    let message = ''
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    } finally {
      restore()
    }
    expect(message).toContain('room_history_failed:500')
    expect(message).not.toContain(fakeJwt)
    expect(message).toContain('<redacted-jwt>')
  })

  it('truncates non-2xx detail to ≤ 200 chars in the error message tail', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy({
      status: 502,
      body: 'a'.repeat(2000),
      responseHeaders: { 'content-type': 'text/plain' },
      captured,
    })
    let message = ''
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    } finally {
      restore()
    }
    // The whole error string is `room_history_failed:502:<detail>`.
    // The `<detail>` portion is ≤ 200 chars by construction.
    const detail = message.replace(/^room_history_failed:502:/, '')
    expect(detail.length).toBeLessThanOrEqual(200)
  })
})

describe('Browser fingerprint headers — Chromium client-hints triple', () => {
  it('includes sec-ch-ua / sec-ch-ua-mobile / sec-ch-ua-platform consistent with the UA', () => {
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['sec-ch-ua']).toMatch(/Chromium.*v="124"/)
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['sec-ch-ua-mobile']).toBe('?0')
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['sec-ch-ua-platform']).toBe('"macOS"')
    // UA must declare the same Chrome major (124) and macOS platform.
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['User-Agent']).toContain('Chrome/124')
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['User-Agent']).toContain('Mac OS X')
  })

  it('includes a stock Accept-Encoding negotiated set', () => {
    expect(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS['Accept-Encoding']).toBe('gzip, deflate, br')
  })

  it('still has no secrets baked in', () => {
    for (const value of Object.values(_ALFACLUB_API_BROWSER_HEADERS_FOR_TESTS)) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{6,}/)
      expect(value).not.toMatch(/Bearer\s/i)
    }
  })
})

describe('ALFACLUB_CHAT_API_PROXY_URL — optional escape hatch for Cloudflare-banned egress', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('readAlfaClubChatBridgeFlags parses ALFACLUB_CHAT_API_PROXY_URL when set', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_API_PROXY_URL: 'https://relay.example.com',
    })
    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.apiProxyUrl).toBe('https://relay.example.com')
  })

  it('rejects http:// (cleartext) proxy URLs', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_API_PROXY_URL: 'http://relay.example.com',
    })
    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.apiProxyUrl).toBeNull()
  })

  it('rejects malformed proxy URL', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_BRIDGE_ENABLED: '1',
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_CHAT_JWT: 'token-xyz',
      ALFACLUB_CHAT_API_PROXY_URL: 'not a url',
    })
    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.apiProxyUrl).toBeNull()
  })

  it('resolveAlfaClubApiCallBaseUrl prefers proxy over base when set', () => {
    expect(
      resolveAlfaClubApiCallBaseUrl({
        apiBaseUrl: 'https://api.alfaclub.app',
        apiProxyUrl: 'https://relay.example.com',
      }),
    ).toBe('https://relay.example.com')
  })

  it('resolveAlfaClubApiCallBaseUrl falls back to base when proxy unset', () => {
    expect(
      resolveAlfaClubApiCallBaseUrl({
        apiBaseUrl: 'https://api.alfaclub.app',
        apiProxyUrl: null,
      }),
    ).toBe('https://api.alfaclub.app')
  })

  it('fetchRoomHistory hits the proxy URL (path/query unchanged) when configured', async () => {
    const captured: { url: string; headers: Record<string, string> }[] = []
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    ;(globalThis as { fetch?: typeof fetch }).fetch = vi.fn(
      async (input: unknown, init?: { method?: string; headers?: Record<string, string> }) => {
        captured.push({
          url: typeof input === 'string' ? input : String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
        })
        return new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    ) as unknown as typeof fetch

    try {
      // Production-shape call: routing URL = proxy origin,
      // fingerprintBaseUrl = upstream AlfaClub API base.
      // Codex review on PR #492: the request must be SENT to the
      // proxy, but the upstream Cloudflare WAF on `api.alfaclub.app`
      // still inspects the browser fingerprint, so Origin/Referer/
      // Sec-Fetch-Site MUST stay attached.
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://relay.example.com',
        fingerprintBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      ;(globalThis as { fetch?: typeof fetch }).fetch = original
    }

    expect(captured).toHaveLength(1)
    const url = new URL(captured[0]?.url ?? '')
    expect(url.origin).toBe('https://relay.example.com')
    expect(url.pathname).toBe('/api/websocket/room_history_paginate')
    expect(url.searchParams.get('roomId')).toBe('1043')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('forward')).toBe('false')
    expect(captured[0]?.headers.Authorization).toBe('Bearer fake-jwt-redacted')
    // Routing-vs-fingerprint separation: request is sent to the
    // proxy (relay.example.com), but the upstream WAF on
    // `api.alfaclub.app` still inspects the fingerprint headers,
    // so they MUST stay attached even though the routing host is
    // not on the AlfaClub-family allowlist.
    expect(captured[0]?.headers.Origin).toBe('https://alfaclub.app')
    expect(captured[0]?.headers.Referer).toBe('https://alfaclub.app/')
    expect(captured[0]?.headers['Sec-Fetch-Site']).toBe('same-site')
    expect(captured[0]?.headers['User-Agent']).toMatch(/Mozilla\/5\.0/)
    expect(captured[0]?.headers['sec-ch-ua']).toMatch(/Chromium.*v="124"/)
  })
})

// Codex review on PR #492 (this PR): callers in `runBridgeTick` and
// `executeCommandBatch` were passing the proxy URL as `apiBaseUrl` to
// `buildAlfaClubApiHeaders` via `resolveAlfaClubApiCallBaseUrl`,
// which derived Origin/Referer/Sec-Fetch-Site from the proxy
// hostname (an unknown host) and produced `{}` — silently weakening
// the browser fingerprint when the proxy escape hatch was active.
// The fix decouples *routing* (where the request is sent) from
// *fingerprint* (which hostname the Origin/Referer triplet
// represents): proxy escape hatch keeps the upstream AlfaClub
// fingerprint, direct custom non-AlfaClub bases keep the safe
// "omit triplet" behavior.
describe('routing-vs-fingerprint separation (PR #492 Codex review)', () => {
  type CapturedRequest = {
    url: string
    method: string
    headers: Record<string, string>
  }

  function installFetchSpy(captured: CapturedRequest[]) {
    const original = (globalThis as { fetch?: typeof fetch }).fetch
    const stub = vi.fn(async (input: unknown, init?: { method?: string; headers?: Record<string, string> }) => {
      captured.push({
        url: typeof input === 'string' ? input : String(input),
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
      })
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    ;(globalThis as { fetch?: typeof fetch }).fetch = stub as unknown as typeof fetch
    return () => {
      ;(globalThis as { fetch?: typeof fetch }).fetch = original
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolveAlfaClubFingerprintBaseUrl always returns the upstream apiBaseUrl, ignoring the proxy', () => {
    expect(
      resolveAlfaClubFingerprintBaseUrl({
        apiBaseUrl: 'https://api.alfaclub.app',
        apiProxyUrl: 'https://relay.example.com',
      }),
    ).toBe('https://api.alfaclub.app')
    expect(
      resolveAlfaClubFingerprintBaseUrl({
        apiBaseUrl: 'https://api.alfaclub.app',
        apiProxyUrl: null,
      }),
    ).toBe('https://api.alfaclub.app')
    // Custom non-AlfaClub base with no proxy: fingerprint base is
    // still the same custom base — `resolveAlfaClubOriginHeaders`
    // will return `{}` because the host is not on the
    // alfaclub-family allowlist, which is the desired safe behavior.
    expect(
      resolveAlfaClubFingerprintBaseUrl({
        apiBaseUrl: 'https://staging-api.example.test',
        apiProxyUrl: null,
      }),
    ).toBe('https://staging-api.example.test')
  })

  it('direct default API call gets AlfaClub Origin/Referer/Sec-Fetch-Site headers', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://api.alfaclub.app',
        fingerprintBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(captured[0]?.url.startsWith('https://api.alfaclub.app/')).toBe(true)
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
  })

  it('direct custom non-AlfaClub base omits Origin/Referer/Sec-Fetch-Site', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://staging-api.example.test',
        fingerprintBaseUrl: 'https://staging-api.example.test',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(captured[0]?.url.startsWith('https://staging-api.example.test/')).toBe(true)
    expect(headers.Origin).toBeUndefined()
    expect(headers.Referer).toBeUndefined()
    expect(headers['Sec-Fetch-Site']).toBeUndefined()
    // Common headers stay (UA + Accept + Sec-Fetch-Mode/Dest + Authorization).
    expect(headers['User-Agent']).toMatch(/Mozilla\/5\.0/)
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
  })

  it('proxy routing with upstream AlfaClub fingerprint sends request to proxy AND keeps AlfaClub fingerprint headers', async () => {
    // The core regression. Pre-fix:
    //   buildAlfaClubApiHeaders(apiBaseUrl: <proxy>) → resolved Origin
    //   from the proxy host (unknown) and emitted `{}`. The proxy
    //   forwarded the request unchanged, so Cloudflare on
    //   `api.alfaclub.app` saw the request without Origin/Referer/
    //   Sec-Fetch-Site — same weak fingerprint that triggered the
    //   1010 ban in the first place.
    //
    // Post-fix: routing URL = proxy, fingerprint base = upstream =
    // headers describe a `https://alfaclub.app` page, matching the
    // alfaclub.app web client.
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://relay.example.com',
        fingerprintBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    // Routing: request is sent to the proxy.
    expect(captured[0]?.url.startsWith('https://relay.example.com/')).toBe(true)
    // Fingerprint: WAF-facing headers describe the alfaclub.app
    // page, not the proxy.
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
  })

  it('proxy routing with custom non-AlfaClub fingerprint base omits the triplet (does not invent alfaclub.app)', async () => {
    // Defensive: an operator who runs both a proxy AND points
    // `apiBaseUrl` at a non-AlfaClub host (e.g. they're proxying to
    // a staging API too) gets the safe "omit triplet" behavior, not
    // a contradictory `Origin: https://alfaclub.app` to a service
    // that has nothing to do with alfaclub.app.
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _fetchRoomHistoryForTests({
        apiBaseUrl: 'https://relay.example.com',
        fingerprintBaseUrl: 'https://staging-api.example.test',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        limit: 20,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(captured[0]?.url.startsWith('https://relay.example.com/')).toBe(true)
    expect(headers.Origin).toBeUndefined()
    expect(headers.Referer).toBeUndefined()
    expect(headers['Sec-Fetch-Site']).toBeUndefined()
  })

  it('markReadMessage uses the same routing-vs-fingerprint separation as fetchRoomHistory', async () => {
    // Mirrors the proxy test above for the second proxy-aware
    // codepath in this file (`update_read_msg`). Without this guard
    // a future refactor could fix `fetchRoomHistory` and forget
    // `markReadMessage`, re-opening the original review issue for
    // read receipts only.
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _markReadMessageForTests({
        apiBaseUrl: 'https://relay.example.com',
        fingerprintBaseUrl: 'https://api.alfaclub.app',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        messageDate: 1_777_000_000_000,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    expect(captured).toHaveLength(1)
    const headers = captured[0]?.headers ?? {}
    expect(captured[0]?.url.startsWith('https://relay.example.com/')).toBe(true)
    expect(captured[0]?.url).toContain('/api/websocket/update_read_msg')
    expect(captured[0]?.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
    expect(headers.Origin).toBe('https://alfaclub.app')
    expect(headers.Referer).toBe('https://alfaclub.app/')
    expect(headers['Sec-Fetch-Site']).toBe('same-site')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('markReadMessage on direct custom non-AlfaClub base omits Origin/Referer/Sec-Fetch-Site', async () => {
    const captured: CapturedRequest[] = []
    const restore = installFetchSpy(captured)
    try {
      await _markReadMessageForTests({
        apiBaseUrl: 'https://staging-api.example.test',
        fingerprintBaseUrl: 'https://staging-api.example.test',
        roomId: '1043',
        jwt: 'fake-jwt-redacted',
        messageDate: 1_777_000_000_000,
        timeoutMs: 5_000,
      })
    } finally {
      restore()
    }
    const headers = captured[0]?.headers ?? {}
    expect(headers.Origin).toBeUndefined()
    expect(headers.Referer).toBeUndefined()
    expect(headers['Sec-Fetch-Site']).toBeUndefined()
    expect(headers.Authorization).toBe('Bearer fake-jwt-redacted')
  })
})
