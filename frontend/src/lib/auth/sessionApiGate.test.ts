import { describe, expect, it } from 'vitest'

import { canSignWithSession, canUseSessionApi } from './sessionApiGate'

describe('canUseSessionApi', () => {
  it('requires both hydration and a session', () => {
    expect(canUseSessionApi({ sessionHydrated: false, hasSession: false })).toBe(false)
    expect(canUseSessionApi({ sessionHydrated: true, hasSession: false })).toBe(false)
    expect(canUseSessionApi({ sessionHydrated: false, hasSession: true })).toBe(false)
    expect(canUseSessionApi({ sessionHydrated: true, hasSession: true })).toBe(true)
  })
})

describe('canSignWithSession', () => {
  it('requires session API readiness plus a matching connected wallet', () => {
    expect(
      canSignWithSession({
        sessionHydrated: true,
        hasSession: true,
        isConnected: false,
        walletMatchesSession: false,
      }),
    ).toBe(false)

    expect(
      canSignWithSession({
        sessionHydrated: true,
        hasSession: true,
        isConnected: true,
        walletMatchesSession: false,
      }),
    ).toBe(false)

    expect(
      canSignWithSession({
        sessionHydrated: true,
        hasSession: true,
        isConnected: true,
        walletMatchesSession: true,
      }),
    ).toBe(true)
  })

  it('does not treat a matching wallet as enough without a hydrated session', () => {
    expect(
      canSignWithSession({
        sessionHydrated: false,
        hasSession: true,
        isConnected: true,
        walletMatchesSession: true,
      }),
    ).toBe(false)
  })
})
