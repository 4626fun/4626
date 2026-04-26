import { describe, expect, it } from 'vitest'

import { filterHiddenInjectedConnectors, selectPreferredWalletConnector } from './wagmiConnectorSelection'

describe('wagmiConnectorSelection', () => {
  it('filters injected connectors only when the collision guard asks for it', () => {
    const connectors = [
      { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' },
      { id: 'io.metamask', name: 'MetaMask' },
      { id: 'injected', name: 'Injected' },
      { id: 'rabby', name: 'Rabby' },
    ]

    expect(filterHiddenInjectedConnectors(connectors, false)).toEqual(connectors)
    expect(filterHiddenInjectedConnectors(connectors, true).map((connector) => connector.id)).toEqual([
      'coinbaseWalletSDK',
      'io.metamask',
      'rabby',
    ])
  })

  it('prefers the targeted Rabby connector before generic injected fallbacks', () => {
    const connectors = [
      { id: 'injected', name: 'Injected' },
      { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' },
      { id: 'rabby', name: 'Rabby' },
    ]

    expect(selectPreferredWalletConnector(connectors)?.id).toBe('rabby')
  })

  it('falls back to Coinbase or Base before other named connectors', () => {
    expect(
      selectPreferredWalletConnector([
        { id: 'foo', name: 'Foo Wallet' },
        { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' },
      ])?.id,
    ).toBe('coinbaseWalletSDK')

    expect(
      selectPreferredWalletConnector([
        { id: 'foo', name: 'Foo Wallet' },
        { id: 'base-account', name: 'Base Account' },
      ])?.id,
    ).toBe('base-account')
  })

  it('returns null when there are no connectors', () => {
    expect(selectPreferredWalletConnector([])).toBeNull()
  })
})
