import { describe, expect, it } from 'vitest'

import {
  deriveWaitlistEntryCtaState,
  shouldEscalateBootstrapErrorToWaitlist,
  shouldFallbackJoinWaitlistEntry,
} from './JoinWaitlistCta'

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
          appAccessStatus: null,
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
          appAccessStatus: null,
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
          appAccessStatus: null,
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: false,
      }),
    ).toBe('continue_setup')
  })

  it('keeps continue setup until admin approval exists', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          appAccessStatus: 'pending',
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: true,
      }),
    ).toBe('continue_setup')
  })

  it('shows open app only after admin approval and wallet readiness', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: true,
      }),
    ).toBe('open_app')
  })

  it('keeps approved accounts in continue setup until owner delegation is ready', () => {
    expect(
      deriveWaitlistEntryCtaState({
        authenticated: true,
        account: {
          emailVerified: true,
          appAccessStatus: 'approved',
          accountSignals: { canonicalCswAddress: '0x123' },
        },
        ownerDelegationReady: false,
      }),
    ).toBe('continue_setup')
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

describe('shouldEscalateBootstrapErrorToWaitlist', () => {
  it('escalates 409 bootstrap failures into waitlist flow', () => {
    expect(
      shouldEscalateBootstrapErrorToWaitlist({
        status: 409,
        payload: null,
      }),
    ).toBe(true)
  })

  it('escalates explicit recovery-required payloads', () => {
    expect(
      shouldEscalateBootstrapErrorToWaitlist({
        status: 400,
        payload: {
          success: false,
          error: 'Recovery required',
          code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
          recoveryRequired: true,
        },
      }),
    ).toBe(true)
  })

  it('does not escalate generic bootstrap failures', () => {
    expect(
      shouldEscalateBootstrapErrorToWaitlist({
        status: 500,
        payload: {
          success: false,
          error: 'Failed to bootstrap waitlist account',
        },
      }),
    ).toBe(false)
  })
})
