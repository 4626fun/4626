import { describe, expect, it } from 'vitest'

import {
  CANONICAL_EXPLORE_ROUTE,
  CANONICAL_SWAP_ROUTE,
  resolveLegacyRedirect,
} from './canonicalRoutes'

describe('canonical route redirects', () => {
  it('redirects legacy home and trade to canonical swap', () => {
    expect(resolveLegacyRedirect('/home')).toBe(CANONICAL_SWAP_ROUTE)
    expect(resolveLegacyRedirect('/trade')).toBe(CANONICAL_SWAP_ROUTE)
  })

  it('redirects legacy dashboard to canonical explore route', () => {
    expect(resolveLegacyRedirect('/dashboard')).toBe(CANONICAL_EXPLORE_ROUTE)
  })

  it('returns null for non-legacy routes', () => {
    expect(resolveLegacyRedirect('/swap')).toBeNull()
    expect(resolveLegacyRedirect('/portfolio')).toBeNull()
  })
})

