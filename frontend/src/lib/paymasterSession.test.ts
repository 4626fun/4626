import { describe, expect, it, vi } from 'vitest'

import { ensureWalletAlignedPaymasterSession, ensureWalletAlignedPaymasterSessionDetailed } from './paymasterSession'

describe('ensureWalletAlignedPaymasterSession', () => {
  it('returns immediately when the current SIWE session already matches the connected wallet', async () => {
    const signIn = vi.fn()
    const signInWithPrivyToken = vi.fn()
    const getPrivyAccessToken = vi.fn()

    const ok = await ensureWalletAlignedPaymasterSession({
      hasMatchingSiweSession: true,
      preferWalletSession: true,
      signIn,
      signInWithPrivyToken,
      getPrivyAccessToken,
    })

    expect(ok).toBe(true)
    expect(signIn).not.toHaveBeenCalled()
    expect(signInWithPrivyToken).not.toHaveBeenCalled()
    expect(getPrivyAccessToken).not.toHaveBeenCalled()
  })

  it('prefers a wallet-backed SIWE sign-in when requested', async () => {
    const signIn = vi.fn(async () => '0x1234')
    const signInWithPrivyToken = vi.fn(async () => '0x5678')
    const getPrivyAccessToken = vi.fn(async () => 'privy-token')

    const ok = await ensureWalletAlignedPaymasterSession({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      signIn,
      signInWithPrivyToken,
      getPrivyAccessToken,
    })

    expect(ok).toBe(true)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(signInWithPrivyToken).not.toHaveBeenCalled()
    expect(getPrivyAccessToken).not.toHaveBeenCalled()
  })

  it('falls back to the Privy bridge when wallet-backed sign-in is unavailable', async () => {
    const signInWithPrivyToken = vi.fn(async () => '0x5678')
    const getPrivyAccessToken = vi.fn(async () => 'privy-token')

    const ok = await ensureWalletAlignedPaymasterSession({
      hasMatchingSiweSession: false,
      preferWalletSession: false,
      signInWithPrivyToken,
      getPrivyAccessToken,
    })

    expect(ok).toBe(true)
    expect(getPrivyAccessToken).toHaveBeenCalledTimes(1)
    expect(signInWithPrivyToken).toHaveBeenCalledWith('privy-token')
  })

  it('falls back to the Privy bridge when wallet-backed sign-in fails', async () => {
    const signIn = vi.fn(async () => {
      throw new Error('wallet rejected')
    })
    const signInWithPrivyToken = vi.fn(async () => '0x5678')
    const getPrivyAccessToken = vi.fn(async () => 'privy-token')

    const ok = await ensureWalletAlignedPaymasterSession({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      signIn,
      signInWithPrivyToken,
      getPrivyAccessToken,
    })

    expect(ok).toBe(true)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(getPrivyAccessToken).toHaveBeenCalledTimes(1)
    expect(signInWithPrivyToken).toHaveBeenCalledWith('privy-token')
  })

  it('returns false when neither strategy can establish a session', async () => {
    const signIn = vi.fn(async () => null)

    const ok = await ensureWalletAlignedPaymasterSession({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      signIn,
      signInWithPrivyToken: null,
      getPrivyAccessToken: null,
    })

    expect(ok).toBe(false)
    expect(signIn).toHaveBeenCalledTimes(1)
  })
})

describe('ensureWalletAlignedPaymasterSessionDetailed', () => {
  it('returns a concrete reason when Privy bridge is unavailable', async () => {
    const result = await ensureWalletAlignedPaymasterSessionDetailed({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      signIn: async () => null,
      signInWithPrivyToken: null,
      getPrivyAccessToken: null,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'wallet_signin_did_not_return_address',
    })
  })

  it('returns a concrete reason when Privy token cannot be read', async () => {
    const result = await ensureWalletAlignedPaymasterSessionDetailed({
      hasMatchingSiweSession: false,
      preferWalletSession: false,
      signInWithPrivyToken: async () => '0x1234',
      getPrivyAccessToken: async () => null,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'missing_privy_access_token',
    })
  })

  it('returns a concrete reason when wallet sign-in path fails before Privy bridge', async () => {
    const result = await ensureWalletAlignedPaymasterSessionDetailed({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      signIn: async () => null,
      signInWithPrivyToken: null,
      getPrivyAccessToken: null,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'wallet_signin_did_not_return_address',
    })
  })

  it('can disable Privy fallback and require wallet session only', async () => {
    const result = await ensureWalletAlignedPaymasterSessionDetailed({
      hasMatchingSiweSession: false,
      preferWalletSession: true,
      allowPrivyBridgeFallback: false,
      signIn: async () => null,
      signInWithPrivyToken: async () => '0x1234',
      getPrivyAccessToken: async () => 'privy-token',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'wallet_signin_did_not_return_address',
    })
  })
})
