import { describe, expect, it } from 'vitest'

import { matchesCoinSearchQuery, normalizeCoinSearchQuery } from './exploreShared'

describe('normalizeCoinSearchQuery', () => {
  it('strips leading $ before matching', () => {
    const normalized = normalizeCoinSearchQuery('$akita')
    expect(normalized.withoutAt).toBe('akita')
    expect(
      matchesCoinSearchQuery(
        { symbol: 'AKITA', name: 'AKITA', address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' },
        '$akita',
        { includeQueryVariants: true },
      ),
    ).toBe(true)
  })
})
