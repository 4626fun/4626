import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatTelegramToAlfaclubBody,
  matchesTelegramToAlfaclubSource,
  readTelegramToAlfaclubRelayConfig,
  relayTelegramMessageToAlfaClub,
} from './telegramToAlfaclubRelay.js'

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
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
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
        replyToMessageId: 'telegram:-1003709479662:42',
      }),
    )
  })
})
