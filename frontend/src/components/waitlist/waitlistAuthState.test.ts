import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isRecoveryRequiredAuthError,
  runWaitlistPrivyLogout,
  shouldAutoStartWaitlistPrivyAuth,
  shouldStopWaitlistAutoAuthRetry,
} from './waitlistAuthState'

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

describe('isRecoveryRequiredAuthError', () => {
  it('detects recovery-required from status, flags, code, and message', () => {
    expect(isRecoveryRequiredAuthError({ status: 409 })).toBe(true)
    expect(isRecoveryRequiredAuthError({ recoveryRequired: true })).toBe(true)
    expect(isRecoveryRequiredAuthError({ code: 'RECOVERY_REQUIRED_EMAIL_BOUND' })).toBe(true)
    expect(isRecoveryRequiredAuthError(new Error('this email is already linked to another account'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isRecoveryRequiredAuthError({ status: 500, code: 'INTERNAL' })).toBe(false)
    expect(isRecoveryRequiredAuthError(new Error('network timeout'))).toBe(false)
  })
})

describe('shouldStopWaitlistAutoAuthRetry', () => {
  it('stops auto retry on session mismatch or recovery required', () => {
    expect(
      shouldStopWaitlistAutoAuthRetry({
        isSessionMismatch: true,
        isRecoveryRequired: false,
      }),
    ).toBe(true)

    expect(
      shouldStopWaitlistAutoAuthRetry({
        isSessionMismatch: false,
        isRecoveryRequired: true,
      }),
    ).toBe(true)
  })

  it('allows auto retry for non-auth bootstrap failures', () => {
    expect(
      shouldStopWaitlistAutoAuthRetry({
        isSessionMismatch: false,
        isRecoveryRequired: false,
      }),
    ).toBe(false)
  })
})

describe('runWaitlistPrivyLogout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns quickly when logout is unavailable or rejects', async () => {
    await expect(runWaitlistPrivyLogout({ logout: null })).resolves.toBeUndefined()

    const rejectingLogout = vi.fn(async () => {
      throw new Error('blocked')
    })
    await expect(runWaitlistPrivyLogout({ logout: rejectingLogout, timeoutMs: 20 })).resolves.toBeUndefined()
    expect(rejectingLogout).toHaveBeenCalledTimes(1)
  })

  it('times out if logout never resolves', async () => {
    vi.useFakeTimers()
    const neverResolvingLogout = vi.fn(() => new Promise<void>(() => {}))

    const promise = runWaitlistPrivyLogout({
      logout: neverResolvingLogout,
      timeoutMs: 75,
    })

    await vi.advanceTimersByTimeAsync(75)
    await expect(promise).resolves.toBeUndefined()
    expect(neverResolvingLogout).toHaveBeenCalledTimes(1)
  })
})
