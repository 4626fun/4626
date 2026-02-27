import { describe, expect, it } from 'vitest'

import { normalizeUniswapError } from './error'

describe('normalizeUniswapError', () => {
  it('maps insufficient funds for gas', () => {
    expect(normalizeUniswapError('insufficient funds for gas').code).toBe('INSUFFICIENT_GAS')
  })

  it('maps insufficient token balance', () => {
    expect(normalizeUniswapError('insufficient token balance').code).toBe('INSUFFICIENT_FUNDS')
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
