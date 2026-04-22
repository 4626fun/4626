import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'
import {
  buildAlfaClubOutboundFrame,
  collectAlfaClubCommandMessages,
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
    })

    const flags = readAlfaClubChatBridgeFlags()
    expect(flags.enabled).toBe(true)
    expect(flags.killSwitch).toBe(false)
    expect(flags.roomId).toBe('1043')
    expect(flags.jwt).toBe('token-xyz')
    expect(flags.groupId).toBe('alfa-room-main')
    expect(flags.pollIntervalMs).toBe(7000)
    expect(flags.historyLimit).toBe(35)
    expect(flags.sendTimeoutMs).toBe(9000)
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
      ],
    })

    expect(commands).toHaveLength(2)
    expect(commands[0]).toMatchObject({
      id: 'm-valid-1',
      sender: '0x1111111111111111111111111111111111111111',
    })
    expect(commands[1]).toMatchObject({
      id: 'm-valid-2',
      sender: '0x2222222222222222222222222222222222222222',
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
})
