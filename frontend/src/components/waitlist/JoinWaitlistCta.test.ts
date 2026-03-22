import { describe, expect, it } from 'vitest'

import { deriveWaitlistEntryCtaState, shouldFallbackJoinWaitlistEntry } from './JoinWaitlistCta'

describe('deriveWaitlistEntryCtaState', () => {
  it('shows join waitlist for unauthenticated users', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: false,
        account: null,
        ownerDelegationReady: false,
      }),
    ).toBe('join')
  })

  it('shows join waitlist until email is verified', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: false,
          accountSignals: { canonicalCswAddress: null },
        },
        ownerDelegationReady: false,
      }),
    ).toBe('join')
  })

  it('shows continue setup for verified-email accounts without a canonical csw', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: null },
        },
        ownerDelegationReady: false,
      }),
    ).toBe('continue_setup')
  })

  it('keeps continue setup until owner delegation is ready', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: false,
      }),
    ).toBe('continue_setup')
  })

  it('shows open app once a canonical csw exists and owner delegation is ready', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: true,
      }),
    ).toBe('open_app')
  })

  it('falls back to the waitlist modal when Privy is not ready for join auth', () => {
    expect(
      shouldFallbackJoinWaitlistEntry({
        ctaState: 'join',
        privyClientStatus: 'loading',
      }),
    ).toBe(true)

    expect(
      shouldFallbackJoinWaitlistEntry({
        ctaState: 'join',
        privyClientStatus: 'disabled',
      }),
    ).toBe(true)

    expect(
      shouldFallbackJoinWaitlistEntry({
        ctaState: 'join',
        privyClientStatus: 'ready',
      }),
    ).toBe(false)

    expect(
      shouldFallbackJoinWaitlistEntry({
        ctaState: 'continue_setup',
        privyClientStatus: 'loading',
      }),
    ).toBe(false)
  })
})
