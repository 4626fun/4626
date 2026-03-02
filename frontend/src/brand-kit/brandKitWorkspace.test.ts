import { describe, expect, it } from 'vitest'

import { BRAND_KIT_VERSION } from '@4626/brand-kit'

describe('brand kit workspace package', () => {
  it('exports BRAND_KIT_VERSION as a string', () => {
    expect(typeof BRAND_KIT_VERSION).toBe('string')
  })
})
