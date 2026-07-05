import { describe, expect, it } from 'vitest'

import { hasZoraReadOnlySignals } from './zoraReadOnlyResolve'

describe('hasZoraReadOnlySignals', () => {
  it('returns true when canonical CSW, handle, or creator coin is present', () => {
    expect(hasZoraReadOnlySignals(null)).toBe(false)
    expect(hasZoraReadOnlySignals({ canonicalCswAddress: '0xabc', creatorCoin: null, zoraHandle: null })).toBe(
      true,
    )
    expect(
      hasZoraReadOnlySignals({
        canonicalCswAddress: null,
        creatorCoin: null,
        zoraHandle: '@creator',
      }),
    ).toBe(true)
    expect(
      hasZoraReadOnlySignals({
        canonicalCswAddress: null,
        creatorCoin: { address: '0xdef', name: null, symbol: null, imageUrl: null },
        zoraHandle: null,
      }),
    ).toBe(true)
  })
})
