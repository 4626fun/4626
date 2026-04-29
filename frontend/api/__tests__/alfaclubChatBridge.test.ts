import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'
import {
  _isRoomHistoryAuthErrorForTests,
  buildAlfaClubOutboundFrame,
  collectAlfaClubCommandMessages,
  extractAlfaClubWsMessagesForTest,
  readAlfaClubChatBridgeFlags,
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
