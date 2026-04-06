import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  computeAcceptedFromAppAccessStatus,
  getInitialTelegramMiniAppEntryResolution,
  hasTelegramLinkEntryContext,
  hasTelegramLinkQueryContext,
  resolveTelegramMiniAppEntryBootstrap,
} from './App'

describe('app access resolution', () => {
  it('accepts approved app access status', () => {
    expect(computeAcceptedFromAppAccessStatus('approved')).toBe(true)
  })

  it('rejects missing or pending app access status', () => {
    expect(computeAcceptedFromAppAccessStatus(null)).toBe(false)
    expect(computeAcceptedFromAppAccessStatus('pending')).toBe(false)
  })
})

describe('telegram link query context', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts valid tg link token query context', () => {
    expect(hasTelegramLinkQueryContext('?tgEntry=link&tgLinkToken=token-123')).toBe(true)
  })

  it('rejects invalid tg link query context', () => {
    expect(hasTelegramLinkQueryContext('?tgEntry=link')).toBe(false)
    expect(hasTelegramLinkQueryContext('?tgEntry=other&tgLinkToken=token-123')).toBe(false)
  })

  it('accepts stored tg link context even after query cleanup', () => {
    const storage = new Map<string, string>([
      [
        'cv_tg_link_context_v1',
        JSON.stringify({
          linkToken: 'token-123',
          chatId: '-1001',
          telegramUsername: 'akita',
          savedAtMs: Date.now(),
        }),
      ],
    ])
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as any)

    expect(hasTelegramLinkEntryContext('')).toBe(true)
  })

  it('starts in checking mode when telegram entrypoint context has not been hydrated yet', () => {
    vi.stubGlobal('window', {
      Telegram: undefined,
      sessionStorage: {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as any)

    expect(getInitialTelegramMiniAppEntryResolution('')).toBe('checking')
  })

  it('resolves telegram entry once bootstrap loads the Telegram WebApp context', async () => {
    const storage = new Map<string, string>()
    const windowStub: any = {
      Telegram: undefined,
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    }
    vi.stubGlobal('window', windowStub)

    const bootstrapTelegramWebApp = vi.fn(async () => {
      windowStub.Telegram = {
        WebApp: {
          initData: 'user=%7B%22id%22%3A1602772244%7D&hash=abc',
        },
      }
    })

    await expect(resolveTelegramMiniAppEntryBootstrap({ search: '', bootstrapTelegramWebApp })).resolves.toBe(true)
    expect(bootstrapTelegramWebApp).toHaveBeenCalledTimes(1)
  })

  it('fails closed when telegram entry bootstrap completes without any Telegram context', async () => {
    vi.stubGlobal('window', {
      Telegram: undefined,
      sessionStorage: {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    } as any)

    await expect(resolveTelegramMiniAppEntryBootstrap({ search: '', bootstrapTelegramWebApp: async () => {} })).resolves.toBe(false)
  })
})
