// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/features/waitlist/waitlistHandoff', () => ({
  bridgePrivySession: vi.fn(),
}))

vi.mock('@/features/waitlist/waitlistAuthState', () => ({
  runWaitlistPrivyLogout: vi.fn(async () => undefined),
  isAlreadyLoggedInAuthError: vi.fn(() => false),
}))

vi.mock('@/lib/privy/accessToken', () => ({
  readPrivyAccessTokenWithRetries: vi.fn(),
}))

import { apiFetch } from '@/lib/api/apiBase'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { readPrivyAccessTokenWithRetries } from '@/lib/privy/accessToken'
import {
  establishWaitlistSessionAfterPrivyAuth,
  isWaitlistWalletSignInCancellation,
  mapWaitlistWalletSignInError,
  runWaitlistReturningWalletSignIn,
} from './waitlistPrivySession'

const mockPrivy = {
  ready: true,
  authenticated: true,
  getAccessToken: vi.fn(async () => 'privy-token'),
  logout: vi.fn(async () => undefined),
}

describe('waitlistPrivySession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readPrivyAccessTokenWithRetries).mockResolvedValue('privy-token')
    vi.mocked(bridgePrivySession).mockResolvedValue({
      ok: true,
      address: '0xabc1234567890123456789012345678901234567',
    })
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/api/waitlist/bootstrap') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { requiresPrivyAuth: false } }),
        } as Response
      }
      if (path === '/api/auth/me') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { address: '0xabc1234567890123456789012345678901234567' } }),
        } as Response
      }
      return { ok: false, json: async () => null } as Response
    })
  })

  it('establishWaitlistSessionAfterPrivyAuth returns bridged address without auth/me round-trip', async () => {
    const address = await establishWaitlistSessionAfterPrivyAuth({ privy: mockPrivy })
    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(bridgePrivySession).toHaveBeenCalledWith('privy-token')
    expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path === '/api/auth/me')).toBe(false)
  })

  it('mapWaitlistWalletSignInError maps wallet-bound recovery', () => {
    const error = new Error('Recovery required') as Error & { code?: string }
    error.code = 'RECOVERY_REQUIRED_WALLET_BOUND'
    expect(mapWaitlistWalletSignInError(error)).toBe(
      'This wallet is linked to another account. Sign in with email.',
    )
  })

  it('runWaitlistReturningWalletSignIn clears an existing Privy token before wallet modal', async () => {
    const login = vi.fn()
    let tokenReads = 0
    vi.mocked(readPrivyAccessTokenWithRetries).mockImplementation(async () => {
      tokenReads += 1
      return tokenReads === 1 ? 'privy-token' : 'privy-token'
    })

    const address = await runWaitlistReturningWalletSignIn({
      privy: { ...mockPrivy, authenticated: true },
      login,
    })
    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(runWaitlistPrivyLogout).toHaveBeenCalledWith(
      expect.objectContaining({ shouldLogout: true }),
    )
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ loginMethods: ['wallet'] }),
    )
  })

  it('runWaitlistReturningWalletSignIn opens wallet login when unauthenticated', async () => {
    const login = vi.fn()
    let tokenReads = 0
    vi.mocked(readPrivyAccessTokenWithRetries).mockImplementation(async () => {
      tokenReads += 1
      return tokenReads === 1 ? null : 'privy-token'
    })

    const address = await runWaitlistReturningWalletSignIn({
      privy: { ...mockPrivy, authenticated: false },
      login,
    })
    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ loginMethods: ['wallet'] }),
    )
    expect(runWaitlistPrivyLogout).not.toHaveBeenCalled()
  })

  it('runWaitlistReturningWalletSignIn deduplicates concurrent calls', async () => {
    const login = vi.fn()
    let tokenReads = 0
    vi.mocked(readPrivyAccessTokenWithRetries).mockImplementation(async () => {
      tokenReads += 1
      return tokenReads <= 1 ? null : 'privy-token'
    })

    const [first, second] = await Promise.all([
      runWaitlistReturningWalletSignIn({
        privy: { ...mockPrivy, authenticated: false },
        login,
      }),
      runWaitlistReturningWalletSignIn({
        privy: { ...mockPrivy, authenticated: false },
        login,
      }),
    ])

    expect(first).toBe('0xabc1234567890123456789012345678901234567')
    expect(second).toBe(first)
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('isWaitlistWalletSignInCancellation detects user cancellation', () => {
    expect(isWaitlistWalletSignInCancellation(new Error('User rejected request'))).toBe(true)
    expect(isWaitlistWalletSignInCancellation(new Error('Sign-in cancelled.'))).toBe(true)
    expect(isWaitlistWalletSignInCancellation(new Error('No account found for this wallet.'))).toBe(false)
  })
})
