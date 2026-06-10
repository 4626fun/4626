import { describe, expect, it } from 'vitest'

import {
  detectProliquidSignalKind,
  matchesProliquidSource,
  readProliquidSignalConfig,
  sanitizeProliquidSignalText,
} from './proliquidSignals.js'

describe('readProliquidSignalConfig', () => {
  it('parses comma-separated source handles and urls', () => {
    const config = readProliquidSignalConfig({
      PROLIQUID_SIGNALS_ENABLED: '1',
      PROLIQUID_SIGNALS_WEBHOOK_SECRET: 'abc',
      PROLIQUID_SIGNALS_SOURCES:
        'https://t.me/proliquid_liquidations,@proliquid_whales,https://t.me/c/3709479662/2',
      PROLIQUID_SIGNALS_ROOM_ID: '1043',
    })
    expect(config.enabled).toBe(true)
    expect(config.sources.length).toBe(3)
    expect(config.sources[0]?.chatHandle).toBe('@proliquid_liquidations')
    expect(config.sources[2]?.chatId).toBe('-1003709479662')
    expect(config.sources[2]?.threadId).toBe(2)
    expect(config.destinationRoomId).toBe('1043')
  })
})

describe('matchesProliquidSource', () => {
  const config = readProliquidSignalConfig({
    PROLIQUID_SIGNALS_ENABLED: '1',
    PROLIQUID_SIGNALS_WEBHOOK_SECRET: 'abc',
    PROLIQUID_SIGNALS_SOURCES: 'https://t.me/proliquid_whales,https://t.me/c/3709479662/2',
  })

  it('matches by channel handle when chat id differs', () => {
    expect(
      matchesProliquidSource({
        chatId: '-1001111111111',
        chatUsername: 'proliquid_whales',
        config,
      }),
    ).toBe(true)
  })

  it('matches by chat id + thread id', () => {
    expect(
      matchesProliquidSource({
        chatId: '-1003709479662',
        messageThreadId: 2,
        config,
      }),
    ).toBe(true)
    expect(
      matchesProliquidSource({
        chatId: '-1003709479662',
        messageThreadId: 3,
        config,
      }),
    ).toBe(false)
  })
})

describe('sanitizeProliquidSignalText', () => {
  it('blocks command-like text by removing leading slash', () => {
    const sanitized = sanitizeProliquidSignalText('/arena trade btc')
    expect(sanitized.blockedCommandPrefix).toBe('/arena')
    expect(sanitized.normalizedText.startsWith('/')).toBe(false)
    expect(sanitized.normalizedText).toContain('arena trade btc')
  })

  it('keeps normal signal text unchanged', () => {
    const sanitized = sanitizeProliquidSignalText('BTC > 500k$ liquidation')
    expect(sanitized.blockedCommandPrefix).toBeNull()
    expect(sanitized.normalizedText).toBe('BTC > 500k$ liquidation')
  })
})

describe('detectProliquidSignalKind', () => {
  it('classifies expected channel names', () => {
    expect(detectProliquidSignalKind('@proliquid_liquidations')).toBe('liquidations')
    expect(detectProliquidSignalKind('@proliquid_whales')).toBe('whales')
    expect(detectProliquidSignalKind('@proliquid_copy_trading')).toBe('copy_trading')
  })
})
