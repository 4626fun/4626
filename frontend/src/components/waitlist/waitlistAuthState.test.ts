import { describe, expect, it } from 'vitest'

import { shouldAutoStartWaitlistPrivyAuth } from './waitlistAuthState'

describe('shouldAutoStartWaitlistPrivyAuth', () => {
  it('starts waitlist auth only on the auth step when Privy is ready and not authenticated', () => {
    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: true,
        privyAuthed: false,
        busy: false,
        authAttemptInFlight: false,
        authAutoAttempted: false,
      }),
    ).toBe(true)
  })

  it('does not auto-start when already authenticated, busy, or already attempting auth', () => {
    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: true,
        privyAuthed: true,
        busy: false,
        authAttemptInFlight: false,
        authAutoAttempted: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: true,
        privyAuthed: false,
        busy: true,
        authAttemptInFlight: false,
        authAutoAttempted: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: true,
        privyAuthed: false,
        busy: false,
        authAttemptInFlight: true,
        authAutoAttempted: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: true,
        privyAuthed: false,
        busy: false,
        authAttemptInFlight: false,
        authAutoAttempted: true,
      }),
    ).toBe(false)
  })

  it('does not auto-start outside the auth step or before Privy is ready', () => {
    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'email',
        privyReady: true,
        privyAuthed: false,
        busy: false,
        authAttemptInFlight: false,
        authAutoAttempted: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartWaitlistPrivyAuth({
        step: 'auth',
        privyReady: false,
        privyAuthed: false,
        busy: false,
        authAttemptInFlight: false,
        authAutoAttempted: false,
      }),
    ).toBe(false)
  })
})
