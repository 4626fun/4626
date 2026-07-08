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
  resetWaitlistReturningWalletSignInForTests,
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
    resetWaitlistReturningWalletSignInForTests()
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

  it('establishWaitlistSessionAfterPrivyAuth calls ensureEmbeddedWallet before bridging the session', async () => {
    const callOrder: string[] = []
    vi.mocked(bridgePrivySession).mockImplementation(async () => {
      callOrder.push('bridge')
      return { ok: true, address: '0xabc1234567890123456789012345678901234567' }
    })
    const ensureEmbeddedWallet = vi.fn(async () => {
      callOrder.push('ensureEmbeddedWallet')
      return { address: '0xabc1234567890123456789012345678901234567', created: true }
    })

    const address = await establishWaitlistSessionAfterPrivyAuth({ privy: mockPrivy, ensureEmbeddedWallet })

    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(ensureEmbeddedWallet).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['ensureEmbeddedWallet', 'bridge'])
  })

  it('establishWaitlistSessionAfterPrivyAuth retries ensureEmbeddedWallet on a transient failure and still succeeds', async () => {
    vi.useFakeTimers()
    const ensureEmbeddedWallet = vi
      .fn()
      // Mirrors the real failure mode: `ensureEmbeddedWallet()` throws when its
      // internal `authenticated` ref snapshot is one render behind, then succeeds
      // once React catches up.
      .mockRejectedValueOnce(new Error('Sign in with Privy before provisioning your embedded wallet.'))
      .mockResolvedValueOnce({ address: '0xabc1234567890123456789012345678901234567', created: true })

    const promise = establishWaitlistSessionAfterPrivyAuth({ privy: mockPrivy, ensureEmbeddedWallet })
    await vi.runAllTimersAsync()
    const address = await promise

    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(ensureEmbeddedWallet).toHaveBeenCalledTimes(2)
    expect(bridgePrivySession).toHaveBeenCalledWith('privy-token')
    vi.useRealTimers()
  })

  it('establishWaitlistSessionAfterPrivyAuth still bridges the session after ensureEmbeddedWallet exhausts all retries', async () => {
    vi.useFakeTimers()
    const ensureEmbeddedWallet = vi.fn(async () => {
      throw new Error('Privy embedded wallet provisioning did not complete. Retry in a moment.')
    })

    const promise = establishWaitlistSessionAfterPrivyAuth({ privy: mockPrivy, ensureEmbeddedWallet })
    await vi.runAllTimersAsync()
    const address = await promise

    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(ensureEmbeddedWallet).toHaveBeenCalledTimes(4)
    expect(bridgePrivySession).toHaveBeenCalledWith('privy-token')
    vi.useRealTimers()
  })

  it('establishWaitlistSessionAfterPrivyAuth does not require ensureEmbeddedWallet (wallet sign-in path)', async () => {
    const address = await establishWaitlistSessionAfterPrivyAuth({ privy: mockPrivy })
    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(bridgePrivySession).toHaveBeenCalledWith('privy-token')
  })

  it('mapWaitlistWalletSignInError maps wallet-bound recovery', () => {
    const error = new Error('Recovery required') as Error & { code?: string }
    error.code = 'RECOVERY_REQUIRED_WALLET_BOUND'
    expect(mapWaitlistWalletSignInError(error)).toBe(
      'This wallet is linked to another account. Sign in with email.',
    )
  })

  it('runWaitlistReturningWalletSignIn clears an existing Privy token before wallet modal', async () => {
    const login = vi.fn(() => {
      // Wallet modal completed.
    })
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
    let authenticated = false
    const login = vi.fn(() => {
      authenticated = true
    })

    const address = await runWaitlistReturningWalletSignIn({
      privy: {
        ...mockPrivy,
        get authenticated() {
          return authenticated
        },
      },
      login,
    })
    expect(address).toBe('0xabc1234567890123456789012345678901234567')
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ loginMethods: ['wallet'] }),
    )
    expect(runWaitlistPrivyLogout).not.toHaveBeenCalled()
  })

  it('runWaitlistReturningWalletSignIn deduplicates concurrent calls', async () => {
    let authenticated = false
    const login = vi.fn(() => {
      authenticated = true
    })

    const privy = {
      ...mockPrivy,
      get authenticated() {
        return authenticated
      },
    }

    const [first, second] = await Promise.all([
      runWaitlistReturningWalletSignIn({
        privy,
        login,
      }),
      runWaitlistReturningWalletSignIn({
        privy,
        login,
      }),
    ])

    expect(first).toBe('0xabc1234567890123456789012345678901234567')
    expect(second).toBe(first)
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('runWaitlistReturningWalletSignIn does not call getAccessToken while signed out before login', async () => {
    vi.useFakeTimers()
    const login = vi.fn()
    vi.mocked(readPrivyAccessTokenWithRetries).mockClear()

    const promise = runWaitlistReturningWalletSignIn({
      privy: { ...mockPrivy, authenticated: false },
      login,
    })

    const rejection = expect(promise).rejects.toThrow('Sign-in cancelled.')
    await vi.runAllTimersAsync()
    await rejection

    expect(readPrivyAccessTokenWithRetries).not.toHaveBeenCalled()
    expect(login).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('runWaitlistReturningWalletSignIn surfaces login() failures immediately', async () => {
    const login = vi.fn(() => {
      throw new Error('Privy modal unavailable')
    })

    await expect(
      runWaitlistReturningWalletSignIn({
        privy: { ...mockPrivy, authenticated: false },
        login,
      }),
    ).rejects.toThrow('Privy modal unavailable')

    expect(readPrivyAccessTokenWithRetries).not.toHaveBeenCalled()
  })

  it('isWaitlistWalletSignInCancellation detects user cancellation', () => {
    expect(isWaitlistWalletSignInCancellation(new Error('User rejected request'))).toBe(true)
    expect(isWaitlistWalletSignInCancellation(new Error('Sign-in cancelled.'))).toBe(true)
    expect(isWaitlistWalletSignInCancellation(new Error('No account found for this wallet.'))).toBe(false)
  })
})
