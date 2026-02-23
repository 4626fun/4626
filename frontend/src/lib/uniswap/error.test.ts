import { describe, expect, it } from 'vitest'

import { normalizeUniswapError } from './error'

describe('normalizeUniswapError', () => {
  it('maps insufficient funds', () => {
    expect(normalizeUniswapError('insufficient funds for gas').code).toBe('INSUFFICIENT_FUNDS')
  })

  it('maps approval', () => {
    expect(normalizeUniswapError('approval required').code).toBe('APPROVAL_REQUIRED')
  })

  it('falls back safely', () => {
    const normalized = normalizeUniswapError('weird edge case')
    expect(normalized.code).toBe('UNKNOWN')
    expect(normalized.message).toContain('weird edge case')
  })
})
