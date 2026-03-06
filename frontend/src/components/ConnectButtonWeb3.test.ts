import { describe, expect, it } from 'vitest'

import { deriveConnectButtonState } from './ConnectButtonWeb3'

describe('deriveConnectButtonState', () => {
  it('stays in hydrating mode until the session has finished loading', () => {
    expect(
      deriveConnectButtonState({
        sessionHydrated: false,
        isConnected: false,
        connectedAddress: null,
        sessionAddress: null,
      }),
    ).toBe('hydrating')
  })

  it('shows the restored-session state when a 4626 session exists without a connected wallet', () => {
    expect(
      deriveConnectButtonState({
        sessionHydrated: true,
        isConnected: false,
        connectedAddress: null,
        sessionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      }),
    ).toBe('session-restored')
  })

  it('prefers the connected-wallet state when a wallet is connected', () => {
    expect(
      deriveConnectButtonState({
        sessionHydrated: true,
        isConnected: true,
        connectedAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        sessionAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toBe('connected-wallet')
  })

  it('shows signed-out when hydration is complete and no session or wallet exists', () => {
    expect(
      deriveConnectButtonState({
        sessionHydrated: true,
        isConnected: false,
        connectedAddress: null,
        sessionAddress: null,
      }),
    ).toBe('signed-out')
  })
})
