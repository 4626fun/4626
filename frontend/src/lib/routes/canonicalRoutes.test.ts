import { describe, expect, it } from 'vitest'

import {
  CANONICAL_EXPLORE_ROUTE,
  CANONICAL_SWAP_ROUTE,
} from './canonicalRoutes'

describe('canonical routes', () => {
  it('exports stable canonical route constants', () => {
    expect(CANONICAL_SWAP_ROUTE).toBe('/swap')
    expect(CANONICAL_EXPLORE_ROUTE).toBe('/explore/creators')
  })
})

