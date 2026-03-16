import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  runWaitlistPrivyLogout,
  shouldAutoStartWaitlistPrivyAuth,
  shouldStopWaitlistAutoAuthRetry,
  shouldShowWaitlistTelegramCta,
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

describe('shouldShowWaitlistTelegramCta', () => {
  it('shows Telegram fallback only on auth step when not busy and not in recovery mode', () => {
    expect(
      shouldShowWaitlistTelegramCta({
        step: 'auth',
        busy: false,
        recoveryRequired: false,
        isTelegramMiniApp: true,
      }),
    ).toBe(true)
  })

  it('hides Telegram fallback while busy, during recovery, outside auth step, or outside Telegram Mini App', () => {
    expect(
      shouldShowWaitlistTelegramCta({
        step: 'auth',
        busy: true,
        recoveryRequired: false,
        isTelegramMiniApp: true,
      }),
    ).toBe(false)

    expect(
      shouldShowWaitlistTelegramCta({
        step: 'auth',
        busy: false,
        recoveryRequired: true,
        isTelegramMiniApp: true,
      }),
    ).toBe(false)

    expect(
      shouldShowWaitlistTelegramCta({
        step: 'email',
        busy: false,
        recoveryRequired: false,
        isTelegramMiniApp: true,
      }),
    ).toBe(false)

    expect(
      shouldShowWaitlistTelegramCta({
        step: 'auth',
        busy: false,
        recoveryRequired: false,
        isTelegramMiniApp: false,
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
