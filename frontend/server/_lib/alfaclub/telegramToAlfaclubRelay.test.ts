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
  it('includes username and optional prefix', () => {
    expect(
      formatTelegramToAlfaclubBody({
        text: '/alfa status',
        username: 'akitav',
        prefix: '[TG]',
      }),
    ).toBe('[TG] @akitav: /alfa status')
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
        text: '@akitav: /alfa status',
        replyToMessageId: 'telegram:-1003709479662:42',
      }),
    )
  })
})
