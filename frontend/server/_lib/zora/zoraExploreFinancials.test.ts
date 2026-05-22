import { describe, expect, it } from 'vitest'

import { preferHigherMetric } from './zoraExploreFinancials.js'

describe('zoraExploreFinancials', () => {
  it('prefers the higher canonical or Zora explore metric', () => {
    expect(preferHigherMetric(5733.39, 494592.77)).toBe(494592.77)
    expect(preferHigherMetric(11_028_824.87, 9_500_000)).toBe(11_028_824.87)
    expect(preferHigherMetric(null, 1200)).toBe(1200)
    expect(preferHigherMetric(500, null)).toBe(500)
  })
})
