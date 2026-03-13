import { describe, expect, it } from 'vitest'

import { readTelegramMiniAppLinkContext, stripTelegramMiniAppLinkParams } from './telegramMiniAppLink'

describe('telegramMiniAppLink', () => {
  it('reads link context from Telegram deep-link params', () => {
    const params = new URLSearchParams({
      tgMiniApp: '1',
      tgEntry: 'link',
      chatAction: 'link-account',
      tgChatId: '-100123',
      tgLinkToken: 'token-abc',
      tgUsername: 'akita',
    })

    expect(readTelegramMiniAppLinkContext(params)).toEqual({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: 'akita',
    })
  })

  it('returns null for non-link entries', () => {
    const params = new URLSearchParams({
      tgEntry: 'trade',
      tgLinkToken: 'token-abc',
    })

    expect(readTelegramMiniAppLinkContext(params)).toBeNull()
  })

  it('returns null when tgLinkToken is missing', () => {
    const params = new URLSearchParams({
      tgEntry: 'link',
    })

    expect(readTelegramMiniAppLinkContext(params)).toBeNull()
  })

  it('strips telegram linking params while preserving unrelated query fields', () => {
    const params = new URLSearchParams({
      tgMiniApp: '1',
      tgEntry: 'link',
      tgLinkToken: 'token-abc',
      tgUsername: 'akita',
      token: '0x1234',
      share: '0xabcd',
    })

    const cleaned = stripTelegramMiniAppLinkParams(params)
    expect(cleaned.get('tgEntry')).toBeNull()
    expect(cleaned.get('tgLinkToken')).toBeNull()
    expect(cleaned.get('token')).toBe('0x1234')
    expect(cleaned.get('share')).toBe('0xabcd')
  })
})

