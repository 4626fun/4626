import { describe, expect, it, vi } from 'vitest'

import {
  isLocalhostPrivyCustomDomainConfigError,
  isMissingPrivyAuthTokenError,
  isRecoverableCrossAppAuthError,
  isUserRejectedCrossAppAuthError,
  isUnauthorizedCrossAppLinkError,
  performZoraCrossAppAuth,
} from './zoraCrossApp'

describe('isUnauthorizedCrossAppLinkError', () => {
  it('treats cross-app oauth 401s as recoverable unauthorized errors', () => {
    expect(isUnauthorizedCrossAppLinkError(new Error('POST /oauth/init cross_app 401 unauthorized'))).toBe(true)
    expect(isUnauthorizedCrossAppLinkError({ status: 403 })).toBe(true)
    expect(isUnauthorizedCrossAppLinkError(new Error('plain network error'))).toBe(false)
  })
})

describe('isRecoverableCrossAppAuthError', () => {
  it('treats generic Privy cross-app auth failures as recoverable', () => {
    expect(isRecoverableCrossAppAuthError(new Error('Authentication failed'))).toBe(true)
    expect(
      isRecoverableCrossAppAuthError(
        new Error('There was an issue connecting your Zora account. Please try again.'),
      ),
    ).toBe(true)
    expect(
      isRecoverableCrossAppAuthError(new Error('Authentication failed: Invalid code during cross-app auth flow.')),
    ).toBe(true)
    expect(isRecoverableCrossAppAuthError(new Error('Popup blocked by browser settings'))).toBe(true)
    expect(isRecoverableCrossAppAuthError(new Error('window.open failed for cross-app flow'))).toBe(true)
    expect(isRecoverableCrossAppAuthError(new Error('Error linking account'))).toBe(true)
    expect(isRecoverableCrossAppAuthError(new Error('plain network error'))).toBe(false)
  })
})

describe('isLocalhostPrivyCustomDomainConfigError', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    // @ts-expect-error test cleanup
    globalThis.window = originalWindow
  })

  it('returns false off localhost', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: '4626.fun' } }
    expect(isLocalhostPrivyCustomDomainConfigError({ status: 401, message: 'oauth/link 401' })).toBe(false)
  })

  it('detects redirect-config 401/403 on localhost as config issue', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: 'localhost' } }
    expect(
      isLocalhostPrivyCustomDomainConfigError(
        new Error('POST /api/v1/oauth/link 401 redirect url is not allowed'),
      ),
    ).toBe(true)
    expect(isLocalhostPrivyCustomDomainConfigError({ status: 403, message: 'redirect not allowed' })).toBe(true)
  })

  it('detects explicit redirect url not allowed messages on localhost', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: '127.0.0.1' } }
    expect(isLocalhostPrivyCustomDomainConfigError(new Error('redirect url is not allowed'))).toBe(true)
  })

  it('does not classify missing-auth-token 401s as config issue', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: 'localhost' } }
    expect(
      isLocalhostPrivyCustomDomainConfigError(
        new Error('POST /api/v1/oauth/link 401 unauthorized {"error":"Missing auth token."}'),
      ),
    ).toBe(false)
  })
})

describe('isMissingPrivyAuthTokenError', () => {
  it('detects missing auth token failures', () => {
    expect(isMissingPrivyAuthTokenError(new Error('Missing auth token.'))).toBe(true)
    expect(isMissingPrivyAuthTokenError({ message: 'missing auth token' })).toBe(true)
    expect(isMissingPrivyAuthTokenError(new Error('redirect url is not allowed'))).toBe(false)
  })
})

describe('performZoraCrossAppAuth localhost behavior', () => {
  it('does not short-circuit localhost when cross-app auth succeeds', async () => {
    const originalWindow = globalThis.window
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: 'localhost' } }

    const linkFn = vi.fn(async () => {})
    const loginFn = vi.fn(async () => {})

    await performZoraCrossAppAuth({
      privyAuthed: true,
      appId: 'zora-app-id',
      linkCrossAppAccount: linkFn,
      loginWithCrossAppAccount: loginFn,
    })
    expect(linkFn).toHaveBeenCalledTimes(1)
    expect(loginFn).not.toHaveBeenCalled()

    // @ts-expect-error test cleanup
    globalThis.window = originalWindow
  })
})

describe('isUserRejectedCrossAppAuthError', () => {
  it('detects user-cancelled cross-app auth attempts', () => {
    expect(isUserRejectedCrossAppAuthError(new Error('client_error: User rejected request'))).toBe(true)
    expect(isUserRejectedCrossAppAuthError(new Error('User denied request'))).toBe(true)
    expect(isUserRejectedCrossAppAuthError(new Error('request was canceled by user'))).toBe(true)
    expect(isUserRejectedCrossAppAuthError(new Error('plain network error'))).toBe(false)
  })
})

describe('performZoraCrossAppAuth', () => {
  it('prefers link when Privy is authenticated and link is available', async () => {
    const linkCrossAppAccount = vi.fn(async () => {})
    const loginWithCrossAppAccount = vi.fn(async () => {})
    const sanitizeRedirect = vi.fn(() => vi.fn())

    await performZoraCrossAppAuth({
      privyAuthed: true,
      appId: 'zora-app-id',
      linkCrossAppAccount,
      loginWithCrossAppAccount,
      sanitizeRedirect,
      isRedirectUrlNotAllowedError: () => false,
    })

    expect(linkCrossAppAccount).toHaveBeenCalledWith({ appId: 'zora-app-id' })
    expect(loginWithCrossAppAccount).not.toHaveBeenCalled()
    expect(sanitizeRedirect).toHaveBeenCalledTimes(1)
  })

  it('falls back to login when link fails with an unauthorized cross-app error', async () => {
    const linkCrossAppAccount = vi.fn(async () => {
      throw new Error('oauth/init cross_app 401 unauthorized')
    })
    const loginWithCrossAppAccount = vi.fn(async () => {})
    const sanitizeRedirect = vi.fn(() => vi.fn())

    await performZoraCrossAppAuth({
      privyAuthed: true,
      appId: 'zora-app-id',
      linkCrossAppAccount,
      loginWithCrossAppAccount,
      sanitizeRedirect,
      isRedirectUrlNotAllowedError: () => false,
    })

    expect(linkCrossAppAccount).toHaveBeenCalledTimes(1)
    expect(loginWithCrossAppAccount).toHaveBeenCalledWith({ appId: 'zora-app-id' })
    expect(sanitizeRedirect).toHaveBeenCalledTimes(2)
  })

  it('falls back to login when link fails with generic auth copy', async () => {
    const linkCrossAppAccount = vi.fn(async () => {
      throw new Error('There was an issue connecting your Zora account. Please try again.')
    })
    const loginWithCrossAppAccount = vi.fn(async () => {})
    const sanitizeRedirect = vi.fn(() => vi.fn())

    await performZoraCrossAppAuth({
      privyAuthed: true,
      appId: 'zora-app-id',
      linkCrossAppAccount,
      loginWithCrossAppAccount,
      sanitizeRedirect,
      isRedirectUrlNotAllowedError: () => false,
    })

    expect(linkCrossAppAccount).toHaveBeenCalledTimes(1)
    expect(loginWithCrossAppAccount).toHaveBeenCalledWith({ appId: 'zora-app-id' })
    expect(sanitizeRedirect).toHaveBeenCalledTimes(2)
  })

  it('falls back to login when link fails with generic viem wallet RPC copy', async () => {
    const linkCrossAppAccount = vi.fn(async () => {
      throw new Error('An unknown RPC error occurred. Details: Unable to connect to wallet Version: viem@2.45.1')
    })
    const loginWithCrossAppAccount = vi.fn(async () => {})
    const sanitizeRedirect = vi.fn(() => vi.fn())

    await performZoraCrossAppAuth({
      privyAuthed: true,
      appId: 'zora-app-id',
      linkCrossAppAccount,
      loginWithCrossAppAccount,
      sanitizeRedirect,
      isRedirectUrlNotAllowedError: () => false,
    })

    expect(linkCrossAppAccount).toHaveBeenCalledTimes(1)
    expect(loginWithCrossAppAccount).toHaveBeenCalledWith({ appId: 'zora-app-id' })
    expect(sanitizeRedirect).toHaveBeenCalledTimes(2)
  })

  it('uses login directly when the user is not already Privy-authenticated', async () => {
    const loginWithCrossAppAccount = vi.fn(async () => {})
    const sanitizeRedirect = vi.fn(() => vi.fn())

    await performZoraCrossAppAuth({
      privyAuthed: false,
      appId: 'zora-app-id',
      linkCrossAppAccount: null,
      loginWithCrossAppAccount,
      sanitizeRedirect,
      isRedirectUrlNotAllowedError: () => false,
    })

    expect(loginWithCrossAppAccount).toHaveBeenCalledWith({ appId: 'zora-app-id' })
    expect(sanitizeRedirect).toHaveBeenCalledTimes(1)
  })
})
