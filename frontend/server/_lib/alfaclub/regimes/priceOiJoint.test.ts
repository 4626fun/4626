import { describe, expect, it } from 'vitest'

import { classifyPriceOiJoint, fineRegimeFromJoint } from './priceOiJoint.js'
import { toCoarseRegime } from './regimeTaxonomy.js'

describe('priceOiJoint', () => {
  it('maps the four joint cells only when both deltas exist', () => {
    expect(classifyPriceOiJoint({ priceDelta: 0.01, oiDelta: 100 })).toBe('new_longs')
    expect(classifyPriceOiJoint({ priceDelta: 0.01, oiDelta: -100 })).toBe('short_covering')
    expect(classifyPriceOiJoint({ priceDelta: -0.01, oiDelta: 100 })).toBe('new_shorts')
    expect(classifyPriceOiJoint({ priceDelta: -0.01, oiDelta: -100 })).toBe('long_unwind')
    expect(classifyPriceOiJoint({ priceDelta: 0.01, oiDelta: null })).toBe('unknown')
  })

  it('refuses false precision without ΔOI and maps coarse labels', () => {
    const fine = fineRegimeFromJoint({
      cell: 'unknown',
      fundingRate: 0.0003,
      fundingZ: null,
      oiParticipationHigh: true,
      exhaustionHint: true,
      cascadeHint: false,
    })
    expect(fine).toBe('long_exhaustion')
    expect(toCoarseRegime(fine)).toBe('crowded-longs')
  })
})
