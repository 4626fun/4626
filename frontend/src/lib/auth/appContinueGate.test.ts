import { describe, expect, it } from 'vitest'

import { shouldNavigateAfterAppEntryHandoff, shouldWaitForPrivyRehydrationAfterHandoff } from './appContinueGate'

describe('shouldNavigateAfterAppEntryHandoff', () => {
  it('navigates once SIWE session is established, even if Privy is not authenticated', () => {
    expect(
      shouldNavigateAfterAppEntryHandoff({
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(true)
  })

  it('navigates when both SIWE and Privy are ready', () => {
    expect(
      shouldNavigateAfterAppEntryHandoff({
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: true,
      }),
    ).toBe(true)
  })

  it('does not block on Privy when the Privy client is disabled', () => {
    expect(
      shouldNavigateAfterAppEntryHandoff({
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'disabled',
        privyReady: false,
        privyAuthenticated: false,
      }),
    ).toBe(true)
  })

  it('waits when SIWE session is not yet established', () => {
    expect(
      shouldNavigateAfterAppEntryHandoff({
        siweAuthAddress: null,
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)
  })
})

describe('shouldWaitForPrivyRehydrationAfterHandoff', () => {
  it('never waits — Privy rehydration is lazy after cross-origin handoff', () => {
    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: true,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)
  })

  it('does not wait when Privy is authenticated', () => {
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

  it('does not wait before handoff redemption', () => {
    expect(
      shouldWaitForPrivyRehydrationAfterHandoff({
        handoffRedeemed: false,
        siweAuthAddress: '0x1234567890123456789012345678901234567890',
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)
  })
})
