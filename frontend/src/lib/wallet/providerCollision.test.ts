import { afterEach, describe, expect, it } from 'vitest'

import { detectEthereumProviderCollision } from './providerCollision'

const originalWindow = (globalThis as any).window

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as any).window
  } else {
    ;(globalThis as any).window = originalWindow
  }
})

function setTestWindow(value: unknown) {
  ;(globalThis as any).window = value
}

describe('detectEthereumProviderCollision', () => {
  it('returns no collision when window is unavailable', () => {
    delete (globalThis as any).window
    expect(detectEthereumProviderCollision()).toEqual({
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      persistedCollisionSignal: false,
      shouldDisableInjectedConnector: false,
    })
  })

  it('flags collision for own getter-only window.ethereum', () => {
    const win = {}
    Object.defineProperty(win, 'ethereum', {
      configurable: true,
      enumerable: true,
      get: () => ({ providers: [] }),
    })
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.lockedEthereumProviderGlobal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('flags collision for own non-writable window.ethereum data descriptor', () => {
    const win = {}
    Object.defineProperty(win, 'ethereum', {
      configurable: true,
      enumerable: true,
      writable: false,
      value: { providers: [] },
    })
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.lockedEthereumProviderGlobal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('flags collision for inherited getter-only window.ethereum', () => {
    const proto = {}
    Object.defineProperty(proto, 'ethereum', {
      configurable: true,
      enumerable: true,
      get: () => ({ providers: [] }),
    })
    const win = Object.create(proto)
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.lockedEthereumProviderGlobal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('flags collision for inherited non-writable window.ethereum data descriptor', () => {
    const proto = {}
    Object.defineProperty(proto, 'ethereum', {
      configurable: true,
      enumerable: true,
      writable: false,
      value: { providers: [] },
    })
    const win = Object.create(proto)
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.lockedEthereumProviderGlobal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('flags collision when multiple injected providers are present', () => {
    const win = {
      ethereum: {
        providers: [{ id: 'a' }, { id: 'b' }],
      },
    }
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.hasMultipleInjectedProviders).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('handles ethereum getter errors safely', () => {
    const win = {}
    Object.defineProperty(win, 'ethereum', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error('getter failure')
      },
    })
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.hasMultipleInjectedProviders).toBe(false)
    expect(state.lockedEthereumProviderGlobal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })

  it('disables injected connector when a recent collision signal is persisted', () => {
    const localStorage = {
      getItem: (key: string) => (key === 'cv:wallet-provider-collision-at' ? String(Date.now()) : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }
    const win = {
      ethereum: { providers: [{ id: 'single' }] },
      localStorage,
      sessionStorage: localStorage,
    }
    setTestWindow(win)

    const state = detectEthereumProviderCollision()
    expect(state.hasMultipleInjectedProviders).toBe(false)
    expect(state.lockedEthereumProviderGlobal).toBe(false)
    expect(state.persistedCollisionSignal).toBe(true)
    expect(state.shouldDisableInjectedConnector).toBe(true)
  })
})
