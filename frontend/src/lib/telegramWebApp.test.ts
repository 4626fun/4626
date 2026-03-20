import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureTelegramMiniAppSession, readPrivyTelegramLaunchParams } from './telegramWebApp'

type MockWindowState = {
  Telegram?: { WebApp?: { initData?: string } }
  sessionStorage: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
  }
}

function installMockWindow(initData: string): () => void {
  const storage = new Map<string, string>()
  const mockWindow: MockWindowState = {
    Telegram: { WebApp: { initData } },
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
    let resolveFetch: ((value: any) => void) | null = null
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    const firstPromise = ensureTelegramMiniAppSession({ fetcher })
    const secondPromise = ensureTelegramMiniAppSession({ fetcher })
    await Promise.resolve()

    expect(fetcher).toHaveBeenCalledTimes(1)

    resolveFetch?.({
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
})
