import { afterEach, describe, expect, it, vi } from 'vitest'

// Note: we intentionally import the module under test lazily per test so we can
// control the window/localStorage environment cleanly.

describe('swap preferences persistence', () => {
  afterEach(() => {
    // Avoid leaking stubbed globals (window/localStorage) into other test files.
    vi.unstubAllGlobals()
  })

  it('defaults to embedded signer + UniswapX enabled when storage empty', async () => {
    vi.resetModules()
    vi.stubGlobal('window', { localStorage: { getItem: () => null } } as any)

    const mod = await import('./swapPreferences')

    expect(mod.readPreferredCanonicalSignerMode()).toBe('privy-embedded')
    expect(mod.readPreferredRouteMode()).toBe('classic+uniswapx')
  })

  it('reads and writes canonical signer mode', async () => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    } as any)

    const mod = await import('./swapPreferences')

    expect(mod.readPreferredCanonicalSignerMode()).toBe('privy-embedded')
    mod.writePreferredCanonicalSignerMode('connected-owner')
    expect(mod.readPreferredCanonicalSignerMode()).toBe('connected-owner')
  })

  it('reads and writes route mode', async () => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    } as any)

    const mod = await import('./swapPreferences')

    expect(mod.readPreferredRouteMode()).toBe('classic+uniswapx')
    mod.writePreferredRouteMode('classic-only')
    expect(mod.readPreferredRouteMode()).toBe('classic-only')
  })

  it('ignores invalid stored values safely', async () => {
    vi.resetModules()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => {
          if (k.includes('signer')) return 'lol'
          if (k.includes('routes')) return 'weird'
          return null
        },
      },
    } as any)

    const mod = await import('./swapPreferences')

    expect(mod.readPreferredCanonicalSignerMode()).toBe('privy-embedded')
    expect(mod.readPreferredRouteMode()).toBe('classic+uniswapx')
  })
})

