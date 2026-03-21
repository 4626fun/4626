import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearStoredTelegramMiniAppLinkContext,
  persistTelegramMiniAppLinkContext,
  readStoredTelegramMiniAppLinkContext,
  readTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
} from './telegramMiniAppLink'

function stubWindowSessionStorage(initial?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial ?? {}))
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => (store.has(key) ? String(store.get(key)) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  } as any)
  return store
}

describe('telegramMiniAppLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
      tgZoraBranch: 'need',
      tgCswIntent: 'need',
      token: '0x1234',
      share: '0xabcd',
    })

    const cleaned = stripTelegramMiniAppLinkParams(params)
    expect(cleaned.get('tgEntry')).toBeNull()
    expect(cleaned.get('tgLinkToken')).toBeNull()
    expect(cleaned.get('tgZoraBranch')).toBeNull()
    expect(cleaned.get('tgCswIntent')).toBeNull()
    expect(cleaned.get('token')).toBe('0x1234')
    expect(cleaned.get('share')).toBe('0xabcd')
  })

  it('persists and restores link context through session storage', () => {
    stubWindowSessionStorage()
    persistTelegramMiniAppLinkContext({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: 'akita',
    })

    expect(readStoredTelegramMiniAppLinkContext()).toEqual({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: 'akita',
    })
  })

  it('clears stored link context', () => {
    stubWindowSessionStorage()
    persistTelegramMiniAppLinkContext({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: 'akita',
    })
    clearStoredTelegramMiniAppLinkContext()
    expect(readStoredTelegramMiniAppLinkContext()).toBeNull()
  })

  it('resolves context from URL and persists it for post-auth recovery', () => {
    const store = stubWindowSessionStorage()
    const params = new URLSearchParams({
      tgMiniApp: '1',
      tgEntry: 'link',
      tgLinkToken: 'token-abc',
      tgChatId: '-100123',
    })
    expect(resolveTelegramMiniAppLinkContext(params)).toEqual({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: null,
    })

    const raw = store.get('cv_tg_link_context_v1')
    expect(typeof raw).toBe('string')
    const parsed = JSON.parse(String(raw))
    expect(parsed.linkToken).toBe('token-abc')
  })

  it('resolves context from stored session when URL params are absent', () => {
    const now = Date.now()
    stubWindowSessionStorage({
      cv_tg_link_context_v1: JSON.stringify({
        linkToken: 'token-abc',
        chatId: '-100123',
        telegramUsername: 'akita',
        savedAtMs: now,
      }),
    })
    const params = new URLSearchParams()
    expect(resolveTelegramMiniAppLinkContext(params)).toEqual({
      linkToken: 'token-abc',
      chatId: '-100123',
      telegramUsername: 'akita',
    })
  })
})
