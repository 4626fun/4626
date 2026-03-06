import { describe, expect, it, vi } from 'vitest'

import { isUnauthorizedCrossAppLinkError, performZoraCrossAppAuth } from './zoraCrossApp'

describe('isUnauthorizedCrossAppLinkError', () => {
  it('treats cross-app oauth 401s as recoverable unauthorized errors', () => {
    expect(isUnauthorizedCrossAppLinkError(new Error('POST /oauth/init cross_app 401 unauthorized'))).toBe(true)
    expect(isUnauthorizedCrossAppLinkError({ status: 403 })).toBe(true)
    expect(isUnauthorizedCrossAppLinkError(new Error('plain network error'))).toBe(false)
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
