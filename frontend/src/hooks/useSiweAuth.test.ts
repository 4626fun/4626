import { describe, expect, it } from 'vitest'

import { PRIVY_INTERACTIVE_LOGIN_METHODS, deriveSiweSessionState, shouldResetPrivyBridgeState } from './useSiweAuth'

describe('PRIVY_INTERACTIVE_LOGIN_METHODS', () => {
  it('prefers email/social before wallet for explicit Privy sign-in', () => {
    expect(PRIVY_INTERACTIVE_LOGIN_METHODS).toEqual(['email', 'google', 'twitter', 'telegram', 'wallet'])
  })
})

describe('shouldResetPrivyBridgeState', () => {
  it('resets for invalid or missing Privy auth tokens', () => {
    expect(shouldResetPrivyBridgeState('Invalid Privy auth token')).toBe(true)
    expect(shouldResetPrivyBridgeState('Missing Privy auth token')).toBe(true)
    expect(shouldResetPrivyBridgeState('Privy token expired')).toBe(true)
    expect(shouldResetPrivyBridgeState('Privy verification failed')).toBe(true)
  })

  it('does NOT reset for bare unauthorized/forbidden (too broad)', () => {
    expect(shouldResetPrivyBridgeState('Unauthorized')).toBe(false)
    expect(shouldResetPrivyBridgeState('Forbidden')).toBe(false)
    expect(shouldResetPrivyBridgeState('401 Unauthorized')).toBe(false)
  })

  it('does not reset for generic non-Privy errors', () => {
    expect(shouldResetPrivyBridgeState('Network error')).toBe(false)
    expect(shouldResetPrivyBridgeState('Request failed')).toBe(false)
    expect(shouldResetPrivyBridgeState('')).toBe(false)
  })
})

describe('deriveSiweSessionState', () => {
  it('treats a restored auth address as an active session even without a connected wallet', () => {
    expect(
      deriveSiweSessionState({
        connectedAddress: null,
        authAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      }),
    ).toEqual({
      sessionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      hasSession: true,
      walletMatchesSession: false,
    })
  })

  it('marks walletMatchesSession only when the connected wallet equals the restored session', () => {
    expect(
      deriveSiweSessionState({
        connectedAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        authAddress: '0xAB6D5C10B03300326CD7FAB7267AE192842967B5',
      }),
    ).toEqual({
      sessionAddress: '0xAB6D5C10B03300326CD7FAB7267AE192842967B5',
      hasSession: true,
      walletMatchesSession: true,
    })
  })

  it('reports no session when authAddress is missing', () => {
    expect(
      deriveSiweSessionState({
        connectedAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        authAddress: null,
      }),
    ).toEqual({
      sessionAddress: null,
      hasSession: false,
      walletMatchesSession: false,
    })
  })
})
