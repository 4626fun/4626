import { describe, expect, it } from 'vitest'

import { deriveWaitlistEntryCtaState } from './JoinWaitlistCta'

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
})
