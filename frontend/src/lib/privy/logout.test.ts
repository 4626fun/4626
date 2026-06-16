import { describe, expect, it, vi } from 'vitest'

import { isBenignPrivyLogoutError, safePrivyLogout, shouldAttemptPrivyLogout } from './logout'

describe('isBenignPrivyLogoutError', () => {
  it('treats 400/401 as benign for logout', () => {
    expect(isBenignPrivyLogoutError({ status: 400 })).toBe(true)
    expect(isBenignPrivyLogoutError({ response: { status: 401 } })).toBe(true)
  })

  it('matches common stale-session logout messages', () => {
    expect(isBenignPrivyLogoutError(new Error('Bad Request'))).toBe(true)
    expect(isBenignPrivyLogoutError(new Error('No active session'))).toBe(true)
  })

  it('keeps unrelated failures non-benign', () => {
    expect(isBenignPrivyLogoutError(new Error('Upstream timeout'))).toBe(false)
  })
})

describe('shouldAttemptPrivyLogout', () => {
  it('returns false when token reader returns empty', async () => {
    await expect(shouldAttemptPrivyLogout(async () => null)).resolves.toBe(false)
  })

  it('returns true when token reader fails', async () => {
    await expect(
      shouldAttemptPrivyLogout(async () => {
        throw new Error('token read failed')
      }),
    ).resolves.toBe(true)
  })
})

describe('safePrivyLogout', () => {
  it('skips logout when token reader says no active token', async () => {
    const logout = vi.fn(async () => undefined)
    await expect(
      safePrivyLogout({
        logout,
        readToken: async () => null,
      }),
    ).resolves.toBeUndefined()
    expect(logout).not.toHaveBeenCalled()
  })

  it('swallows benign logout errors and rethrows non-benign ones', async () => {
    await expect(
      safePrivyLogout({
        logout: async () => {
          throw Object.assign(new Error('Bad Request'), { status: 400 })
        },
      }),
    ).resolves.toBeUndefined()

    await expect(
      safePrivyLogout({
        logout: async () => {
          throw new Error('unexpected crash')
        },
      }),
    ).rejects.toThrow('unexpected crash')
  })
})
