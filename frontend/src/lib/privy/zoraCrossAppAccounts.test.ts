import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  consumeWaitlistZoraOAuthPending,
  isPrivyZoraCrossAppLinked,
  isZoraCrossAppOAuthReturnLocation,
  markWaitlistZoraOAuthPending,
} from './zoraCrossAppAccounts'

describe('zoraCrossAppAccounts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tracks pending Zora OAuth in sessionStorage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    })

    markWaitlistZoraOAuthPending()
    expect(consumeWaitlistZoraOAuthPending()).toBe(true)
    expect(consumeWaitlistZoraOAuthPending()).toBe(false)
  })

  it('detects oauth return query params', () => {
    expect(isZoraCrossAppOAuthReturnLocation({ search: '?code=abc&state=xyz', hash: '' })).toBe(true)
    expect(isZoraCrossAppOAuthReturnLocation({ search: '', hash: '' })).toBe(false)
  })

  it('detects Privy cross_app linked accounts for Zora', () => {
    expect(
      isPrivyZoraCrossAppLinked({
        linkedAccounts: [{ type: 'cross_app', providerAppId: 'clpgf04wn04hnkw0fv1m11mnb' }],
      }),
    ).toBe(true)
    expect(isPrivyZoraCrossAppLinked({ linkedAccounts: [{ type: 'email' }] })).toBe(false)
  })
})
