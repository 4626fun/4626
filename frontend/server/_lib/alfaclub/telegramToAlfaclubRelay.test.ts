import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatTelegramToAlfaclubBody,
  matchesTelegramToAlfaclubSource,
  readTelegramToAlfaclubRelayConfig,
  relayTelegramMessageToAlfaClub,
} from './telegramToAlfaclubRelay.js'
import type { AlfaClubRoomChannelBinding } from './roomChannelBindings.js'

const {
  claimIngressMock,
  linkIngressMock,
  lookupTelegramBindingMock,
} = vi.hoisted(() => ({
  claimIngressMock: vi.fn(async () => ({ claimed: true, ingress: {} })),
  linkIngressMock: vi.fn(async () => ({})),
  lookupTelegramBindingMock: vi.fn(
    async (): Promise<{ available: boolean; binding: AlfaClubRoomChannelBinding | null }> => ({
      available: true,
      binding: null,
    }),
  ),
}))

vi.mock('./chatBridge.js', () => ({
  readAlfaClubChatBridgeFlags: vi.fn(() => ({
    botToken: 'alfa_bot_test',
    apiBaseUrl: 'https://api.alfaclub.app',
    apiProxyUrl: null,
    apiProxySecret: null,
    sendTimeoutMs: 10_000,
  })),
  sendAlfaClubRoomText: vi.fn(async () => ({ lane: 'bot_token_without_reply_id' })),
}))

vi.mock('./crossChannelIngress.js', () => ({
  claimAlfaClubCrossChannelIngress: claimIngressMock,
  linkAlfaClubCrossChannelIngress: linkIngressMock,
}))

vi.mock('./roomChannelBindings.js', () => ({
  lookupEnabledAlfaClubRoomChannelBindingByTelegram: lookupTelegramBindingMock,
}))

import { sendAlfaClubRoomText } from './chatBridge.js'

describe('readTelegramToAlfaclubRelayConfig', () => {
  it('parses t.me/c URLs into supergroup chat id and topic', () => {
    const config = readTelegramToAlfaclubRelayConfig({
      TELEGRAM_TO_ALFACLUB_ENABLED: '1',
      TELEGRAM_TO_ALFACLUB_CHAT_ID: 'https://t.me/c/3709479662/2',
      TELEGRAM_TO_ALFACLUB_ROOM_ID: '1043',
    })
    expect(config.enabled).toBe(true)
    expect(config.sourceChatId).toBe('-1003709479662')
    expect(config.sourceThreadId).toBe(2)
    expect(config.roomId).toBe('1043')
  })
})

describe('matchesTelegramToAlfaclubSource', () => {
  const config = {
    enabled: true,
    sourceChatId: '-1003709479662',
    sourceThreadId: 2,
    roomId: '1043',
    prefix: '',
    textOnly: false,
  }

  it('matches chat and topic', () => {
    expect(
      matchesTelegramToAlfaclubSource({
        chatId: '-1003709479662',
        messageThreadId: 2,
        config,
      }),
    ).toBe(true)
  })

  it('rejects wrong topic', () => {
    expect(
      matchesTelegramToAlfaclubSource({
        chatId: '-1003709479662',
        messageThreadId: 9,
        config,
      }),
    ).toBe(false)
  })
})

describe('formatTelegramToAlfaclubBody', () => {
  it('puts slash commands first so the bridge can detect them', () => {
    expect(
      formatTelegramToAlfaclubBody({
        text: '/alfa status',
        username: 'akitav',
        prefix: '[TG]',
      }),
    ).toBe('[TG] /alfa status\n(tg @akitav)')
  })

  it('keeps attribution prefix form for non-command chatter', () => {
    expect(
      formatTelegramToAlfaclubBody({
        text: 'Trend signal pair',
        username: 'akitav',
        prefix: '',
      }),
    ).toBe('@akitav: Trend signal pair')
  })

  it('truncates very long relay bodies', () => {
    const long = 'x'.repeat(5_000)
    const out = formatTelegramToAlfaclubBody({ text: long, maxChars: 100 })
    expect(out.length).toBeLessThanOrEqual(100)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('relayTelegramMessageToAlfaClub', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('posts to AlfaClub when source matches', async () => {
    const result = await relayTelegramMessageToAlfaClub({
      chatId: '-1003709479662',
      messageId: 42,
      messageThreadId: 2,
      text: '/alfa status',
      username: 'akitav',
      userId: '123',
      config: {
        enabled: true,
        sourceChatId: '-1003709479662',
        sourceThreadId: 2,
        roomId: '1043',
        prefix: '',
        textOnly: false,
      },
    })
    expect(result.status).toBe('relayed')
    expect(sendAlfaClubRoomText).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '1043',
        text: '/alfa status\n(tg @akitav)',
        replyToMessageId: 'telegram:-1003709479662:2:42',
      }),
    )
  })

  it('uses the registry source mapping before the legacy environment fallback', async () => {
    lookupTelegramBindingMock.mockResolvedValueOnce({
      available: true,
      binding: {
        roomId: '202',
        enabled: true,
        rolloutStatus: 'enabled',
        telegram: { enabled: true, chatId: '-100999', threadId: '7' },
        xmtp: { enabled: false, groupId: null, syntheticKeeprVaultAddress: null },
        createdAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    })

    const result = await relayTelegramMessageToAlfaClub({
      chatId: '-100999',
      messageId: 88,
      messageThreadId: 7,
      text: 'room two only',
      username: 'member',
      userId: '42',
    })

    expect(result).toMatchObject({ status: 'relayed', roomId: '202' })
    expect(claimIngressMock).toHaveBeenCalledWith({
      sourceChannel: 'telegram',
      sourceMessageId: '-100999:7:88',
      sourceConversationId: '-100999:7',
      targetRoomId: '202',
    })
    expect(sendAlfaClubRoomText).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: '202', replyToMessageId: 'telegram:-100999:7:88' }),
    )
  })

  it('denies before claiming when an injected issuer policy rejects the Telegram user', async () => {
    const result = await relayTelegramMessageToAlfaClub({
      chatId: '-1003709479662',
      messageId: 99,
      messageThreadId: 2,
      text: 'not authorized',
      userId: '77',
      config: {
        enabled: true,
        sourceChatId: '-1003709479662',
        sourceThreadId: 2,
        roomId: '1043',
        prefix: '',
        textOnly: false,
      },
      validateIssuer: vi.fn(async () => null),
    })

    expect(result).toEqual({ status: 'skipped', reason: 'issuer_not_authorized' })
    expect(claimIngressMock).not.toHaveBeenCalled()
    expect(sendAlfaClubRoomText).not.toHaveBeenCalled()
  })
})
