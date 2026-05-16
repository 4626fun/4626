import { describe, expect, it } from 'vitest'

import { brandTokens } from '@4626/brand-kit/tokens'

describe('brand token contract', () => {
  it('uses canonical electric-blue palette', () => {
    expect(brandTokens.primary).toBe('#1C5CF2')
    expect(brandTokens.hover).toBe('#3F81FF')
    expect(brandTokens.accent).toBe('#F59E0B')
  })
})
