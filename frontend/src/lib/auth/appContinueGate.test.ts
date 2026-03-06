import { describe, expect, it } from 'vitest'

import { shouldNavigateAfterWaitlistHandoff, shouldWaitForPrivyRehydrationAfterHandoff } from './appContinueGate'

describe('shouldNavigateAfterWaitlistHandoff', () => {
  it('waits for app-origin Privy auth when SIWE is restored but Privy is not authenticated yet', () => {
    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)
  })

  it('navigates once both SIWE and Privy are ready on the app origin', () => {
    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: true,
      }),
    ).toBe(true)
  })

  it('does not block on Privy when the Privy client is disabled', () => {
    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'disabled',
        privyReady: false,
        privyAuthenticated: false,
      }),
    ).toBe(true)
  })
})

describe('shouldWaitForPrivyRehydrationAfterHandoff', () => {
  it('waits silently when SIWE is restored but Privy is still catching up', () => {
    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(true)
  })

  it('does not wait once Privy is authenticated', () => {
    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: true,
      }),
    ).toBe(false)
  })

  it('does not wait before handoff redemption or without a restored SIWE session', () => {
    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: false,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)

    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: true,
        siweAuthAddress: null,
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)
  })
})
