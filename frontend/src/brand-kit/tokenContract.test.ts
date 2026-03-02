import { describe, expect, it } from 'vitest'

import { brandTokens } from '@4626/brand-kit/tokens'

describe('brand token contract', () => {
  it('uses canonical electric-blue palette', () => {
    expect(brandTokens.primary).toBe('#0052FF')
    expect(brandTokens.hover).toBe('#004AD9')
    expect(brandTokens.accent).toBe('#3B82F6')
  })
})
