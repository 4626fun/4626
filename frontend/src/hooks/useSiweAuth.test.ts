import { describe, expect, it } from 'vitest'

import {
  PRIVY_INTERACTIVE_LOGIN_METHODS,
  deriveInitialAuthSessionState,
  deriveSiweSessionState,
  shouldAutoBridgeConnectedPrivySession,
  shouldAutoBridgeRestoredPrivySession,
  shouldResetPrivyBridgeState,
} from './useSiweAuth'

describe('PRIVY_INTERACTIVE_LOGIN_METHODS', () => {
  it('prefers email before wallet for explicit Privy sign-in', () => {
    expect(PRIVY_INTERACTIVE_LOGIN_METHODS).toEqual(['email', 'wallet'])
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

describe('deriveInitialAuthSessionState', () => {
  it('hydrates from a fresh shared session snapshot', () => {
    expect(
      deriveInitialAuthSessionState({
        address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        resolvedAt: 10_000,
        now: 20_000,
        ttlMs: 30_000,
      }),
    ).toEqual({
      authAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      sessionHydrated: true,
    })
  })

  it('does not trust a stale shared session snapshot', () => {
    expect(
      deriveInitialAuthSessionState({
        address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        resolvedAt: 10_000,
        now: 50_001,
        ttlMs: 30_000,
      }),
    ).toEqual({
      authAddress: null,
      sessionHydrated: false,
    })
  })

  it('can preserve a fresh signed-out hydration state', () => {
    expect(
      deriveInitialAuthSessionState({
        address: null,
        resolvedAt: 10_000,
        now: 20_000,
        ttlMs: 30_000,
      }),
    ).toEqual({
      authAddress: null,
      sessionHydrated: true,
    })
  })
})

describe('shouldAutoBridgeConnectedPrivySession', () => {
  it('does not auto-bridge when an app session already exists for a different address', () => {
    expect(
      shouldAutoBridgeConnectedPrivySession({
        isConnected: true,
        address: '0x1111111111111111111111111111111111111111',
        authAddress: '0x2222222222222222222222222222222222222222',
        busy: false,
        privyReady: true,
        privyAuthenticated: true,
        hasPrivyAccessTokenReader: true,
        skipAutoBridge: false,
        attemptedForAddress: '',
      }),
    ).toBe(false)
  })

  it('allows a connected-wallet auto-bridge only when no app session exists yet', () => {
    expect(
      shouldAutoBridgeConnectedPrivySession({
        isConnected: true,
        address: '0x1111111111111111111111111111111111111111',
        authAddress: null,
        busy: false,
        privyReady: true,
        privyAuthenticated: true,
        hasPrivyAccessTokenReader: true,
        skipAutoBridge: false,
        attemptedForAddress: '',
      }),
    ).toBe(true)
  })

  it('does not auto-bridge again for an address already attempted', () => {
    expect(
      shouldAutoBridgeConnectedPrivySession({
        isConnected: true,
        address: '0x1111111111111111111111111111111111111111',
        authAddress: null,
        busy: false,
        privyReady: true,
        privyAuthenticated: true,
        hasPrivyAccessTokenReader: true,
        skipAutoBridge: false,
        attemptedForAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toBe(false)
  })
})

describe('shouldAutoBridgeRestoredPrivySession', () => {
  it('guards auto-bridge when a global attempt already ran', () => {
    expect(
      shouldAutoBridgeRestoredPrivySession({
        authAddress: '0x1111111111111111111111111111111111111111',
        busy: false,
        privyReady: true,
        privyAuthenticated: true,
        hasPrivyAccessTokenReader: true,
        skipAutoBridge: false,
        hasStoredSessionToken: false,
        alreadyAttempted: true,
      }),
    ).toBe(false)
  })

  it('allows one restored-session bridge when bearer token is missing', () => {
    expect(
      shouldAutoBridgeRestoredPrivySession({
        authAddress: '0x1111111111111111111111111111111111111111',
        busy: false,
        privyReady: true,
        privyAuthenticated: true,
        hasPrivyAccessTokenReader: true,
        skipAutoBridge: false,
        hasStoredSessionToken: false,
        alreadyAttempted: false,
      }),
    ).toBe(true)
  })
})
