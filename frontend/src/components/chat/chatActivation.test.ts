import { describe, expect, it } from 'vitest'

import { hasChatDeepLinkSearch } from './chatActivation'

describe('hasChatDeepLinkSearch', () => {
  it('detects chat deep-link params', () => {
    expect(hasChatDeepLinkSearch('?chatAction=foo')).toBe(true)
    expect(hasChatDeepLinkSearch('?chatPeer=0x123')).toBe(true)
    expect(hasChatDeepLinkSearch('?chatName=akita')).toBe(true)
  })

  it('returns false for unrelated or empty search strings', () => {
    expect(hasChatDeepLinkSearch('')).toBe(false)
    expect(hasChatDeepLinkSearch('?foo=bar')).toBe(false)
    expect(hasChatDeepLinkSearch('?next=%2Fswap')).toBe(false)
  })
})
