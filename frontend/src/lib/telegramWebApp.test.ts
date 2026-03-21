import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ensureTelegramMiniAppSession,
  hasTelegramMiniAppEntrypointContext,
  readPrivyTelegramLaunchParams,
  switchTelegramMiniAppInlineQuery,
} from './telegramWebApp'

type MockWindowState = {
  Telegram?: {
    WebApp?: {
      initData?: string
      switchInlineQuery?: (query: string, chooseChatTypes?: string[]) => void
    }
  }
  sessionStorage: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
  }
}

function installMockWindow(
  initData: string,
  initialStorage?: Record<string, string>,
  webAppOverrides?: Partial<NonNullable<MockWindowState['Telegram']>['WebApp']>,
): () => void {
  const storage = new Map<string, string>(Object.entries(initialStorage ?? {}))
  const mockWindow: MockWindowState = {
    Telegram: { WebApp: { initData, ...webAppOverrides } },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
  }
  const previousWindow = (globalThis as any).window
  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
    writable: true,
  })
  return () => {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as any).window
      return
    }
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true,
    })
  }
}

describe('telegramWebApp mini app session bootstrap', () => {
  let restoreWindow: (() => void) | null = null

  afterEach(() => {
    restoreWindow?.()
    restoreWindow = null
    vi.restoreAllMocks()
  })

  it('creates and caches mini app sessions', async () => {
    restoreWindow = installMockWindow('auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=abc')
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          sessionToken: 'mini-session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
          telegramUserId: '42',
          telegramUsername: 'akita',
          chatId: null,
          chatType: null,
          chatInstance: null,
        },
      }),
    })

    const first = await ensureTelegramMiniAppSession({ fetcher })
    const second = await ensureTelegramMiniAppSession({ fetcher })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent mini app session bootstrap requests', async () => {
    restoreWindow = installMockWindow('auth_date=1710001111&user=%7B%22id%22%3A42%7D&hash=dedupe')
    let resolveFetch!: (value: any) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve as (value: any) => void
        }),
    )

    const firstPromise = ensureTelegramMiniAppSession({ fetcher })
    const secondPromise = ensureTelegramMiniAppSession({ fetcher })
    await Promise.resolve()

    expect(fetcher).toHaveBeenCalledTimes(1)

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          sessionToken: 'mini-session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
          telegramUserId: '42',
          telegramUsername: 'akita',
          chatId: null,
          chatType: null,
          chatInstance: null,
        },
      }),
    })

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns a typed failure when initData is missing', async () => {
    restoreWindow = installMockWindow('')
    const fetcher = vi.fn()
    const result = await ensureTelegramMiniAppSession({ fetcher })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.statusCode).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('builds Privy launch params from Telegram initData', () => {
    restoreWindow = installMockWindow('auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=abc')
    expect(readPrivyTelegramLaunchParams()).toEqual({
      initDataRaw: 'auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=abc',
    })
  })

  it('returns null launch params when Telegram initData is missing', () => {
    restoreWindow = installMockWindow('')
    expect(readPrivyTelegramLaunchParams()).toBeNull()
  })

  it('treats live Telegram initData as valid Telegram entry context', () => {
    restoreWindow = installMockWindow('auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=abc')
    expect(hasTelegramMiniAppEntrypointContext()).toBe(true)
  })

  it('treats a fresh stored mini app session as valid Telegram entry context', async () => {
    restoreWindow = installMockWindow('', {
      cv_tg_miniapp_session_v1: JSON.stringify({
        initData: 'auth_date=1710000000&user=%7B%22id%22%3A42%7D&hash=abc',
        sessionToken: 'mini-session-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
        telegramUserId: '42',
        telegramUsername: 'akita',
        chatId: null,
        chatType: null,
        chatInstance: null,
      }),
    })

    expect(hasTelegramMiniAppEntrypointContext()).toBe(true)
  })

  it('rejects non-Telegram entry context when initData and fresh session are absent', () => {
    restoreWindow = installMockWindow('')
    expect(hasTelegramMiniAppEntrypointContext()).toBe(false)
  })

  it('switches the current chat into inline mode when Telegram exposes switchInlineQuery', () => {
    const switchInlineQuery = vi.fn()
    restoreWindow = installMockWindow('', undefined, { switchInlineQuery })

    expect(
      switchTelegramMiniAppInlineQuery({
        query: 'ai What should I do next?',
        chatTypes: [],
      }),
    ).toBe(true)
    expect(switchInlineQuery).toHaveBeenCalledWith('ai What should I do next?', [])
  })

  it('returns false when inline switching is unavailable', () => {
    restoreWindow = installMockWindow('')
    expect(switchTelegramMiniAppInlineQuery({ query: '' })).toBe(false)
  })
})
