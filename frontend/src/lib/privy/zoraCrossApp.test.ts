import { describe, expect, it, vi } from 'vitest'

import {
  isLocalhostPrivyCustomDomainConfigError,
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

  it('detects 401/403 on localhost during oauth flows as config issue', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: 'localhost' } }
    expect(isLocalhostPrivyCustomDomainConfigError({ status: 401 })).toBe(true)
    expect(isLocalhostPrivyCustomDomainConfigError(new Error('POST /api/v1/oauth/link 401'))).toBe(true)
    expect(isLocalhostPrivyCustomDomainConfigError({ status: 403, message: 'redirect not allowed' })).toBe(true)
  })

  it('detects explicit redirect url not allowed messages on localhost', () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: '127.0.0.1' } }
    expect(isLocalhostPrivyCustomDomainConfigError(new Error('redirect url is not allowed'))).toBe(true)
  })
})

describe('performZoraCrossAppAuth localhost short-circuit', () => {
  it('immediately throws helpful message on localhost without calling the link fn', async () => {
    const originalWindow = globalThis.window
    // @ts-expect-error test shim
    globalThis.window = { location: { hostname: 'localhost' } }

    const linkFn = vi.fn()
    const loginFn = vi.fn()

    await expect(
      performZoraCrossAppAuth({
        privyAuthed: true,
        appId: 'zora-app-id',
        linkCrossAppAccount: linkFn,
        loginWithCrossAppAccount: loginFn,
      })
    ).rejects.toThrow(/Privy localhost \+ custom domain/)

    expect(linkFn).not.toHaveBeenCalled()
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
