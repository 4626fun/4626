import { describe, expect, it } from 'vitest'

import { deriveWaitlistEntryCtaState } from './JoinWaitlistCta'

describe('deriveWaitlistEntryCtaState', () => {
  it('shows join waitlist for unauthenticated users', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: false,
        account: null,
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
      }),
    ).toBe('continue_setup')
  })

  it('shows open app once a canonical csw exists', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
      }),
    ).toBe('open_app')
  })
})
