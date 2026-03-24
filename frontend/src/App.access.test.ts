import { afterEach, describe, expect, it, vi } from 'vitest'

import { computeAcceptedFromAllowlist, hasTelegramLinkEntryContext, hasTelegramLinkQueryContext, resolveAllowlistMode } from './App'

describe('allowlist access resolution', () => {
  it('fails closed when allowlist mode is unresolved', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: null, modeFromAddress: null })
    expect(mode).toBe('unknown')
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: true })).toBe(false)
  })

  it('accepts all sessions when allowlist mode is disabled', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: 'disabled', modeFromAddress: null })
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: false })).toBe(true)
  })

  it('requires address allowlist approval when mode is enforced', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: 'enforced', modeFromAddress: null })
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: false })).toBe(false)
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: true })).toBe(true)
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
})
