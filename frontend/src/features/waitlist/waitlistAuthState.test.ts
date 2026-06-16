import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '@/lib/api/apiBase'

import {
  isAlreadyLoggedInAuthError,
  isEmailAlreadyLinkedAuthError,
  isRecoveryRequiredAuthError,
  runWaitlistPrivyLogout,
} from './waitlistAuthState'

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(async () => ({ ok: true })),
}))

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

describe('isEmailAlreadyLinkedAuthError', () => {
  it('detects Privy duplicate email-link errors', () => {
    expect(isEmailAlreadyLinkedAuthError(new Error('User already has an account of type email linked.'))).toBe(true)
    expect(isEmailAlreadyLinkedAuthError({ message: 'already has an account of type email linked' })).toBe(true)
    expect(isEmailAlreadyLinkedAuthError('Account of type email is linked to this user')).toBe(true)
  })

  it('returns false for unrelated messages', () => {
    expect(isEmailAlreadyLinkedAuthError(new Error('Failed to fetch'))).toBe(false)
    expect(isEmailAlreadyLinkedAuthError({ message: 'Recovery required' })).toBe(false)
  })
})

describe('isAlreadyLoggedInAuthError', () => {
  it('detects Privy "already logged in" login errors', () => {
    expect(
      isAlreadyLoggedInAuthError(new Error('Attempted to log in, but user is already logged in. Use a `link` helper instead.')),
    ).toBe(true)
    expect(isAlreadyLoggedInAuthError({ message: 'already logged in, use a link helper' })).toBe(true)
    expect(isAlreadyLoggedInAuthError('Use a link helper')).toBe(true)
    expect(isAlreadyLoggedInAuthError(new Error('Error linking account'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isAlreadyLoggedInAuthError(new Error('Failed to fetch'))).toBe(false)
    expect(isAlreadyLoggedInAuthError({ message: 'Recovery required' })).toBe(false)
  })
})

describe('runWaitlistPrivyLogout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.mocked(apiFetch).mockClear()
  })

  it('returns quickly when logout is unavailable or rejects', async () => {
    await expect(runWaitlistPrivyLogout({ logout: null })).resolves.toBeUndefined()

    const rejectingLogout = vi.fn(async () => {
      throw new Error('blocked')
    })
    await expect(runWaitlistPrivyLogout({ logout: rejectingLogout, timeoutMs: 20 })).resolves.toBeUndefined()
    expect(rejectingLogout).toHaveBeenCalledTimes(1)
  })

  it('skips calling Privy logout when the caller marks the SDK session unavailable', async () => {
    const logout = vi.fn(async () => undefined)

    await expect(
      runWaitlistPrivyLogout({
        logout,
        timeoutMs: 20,
        shouldLogout: false,
      } as any),
    ).resolves.toBeUndefined()

    expect(logout).not.toHaveBeenCalled()
  })

  it('skips Privy logout when no access token is available', async () => {
    const logout = vi.fn(async () => undefined)
    const readToken = vi.fn(async () => null)

    await expect(
      runWaitlistPrivyLogout({
        logout,
        readToken,
        shouldLogout: true,
      }),
    ).resolves.toBeUndefined()

    expect(readToken).toHaveBeenCalledTimes(1)
    expect(logout).not.toHaveBeenCalled()
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

  it('clears the app session before recovery retries', async () => {
    const store = new Map<string, string>([['cv_siwe_session_token', 'token-123']])
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
      }),
    })
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    vi.stubGlobal(
      'CustomEvent',
      class {
        constructor(public type: string) {}
      },
    )

    await expect(runWaitlistPrivyLogout({ logout: null, timeoutMs: 20 })).resolves.toBeUndefined()

    expect(store.get('cv_siwe_session_token')).toBeUndefined()
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
  })
})
