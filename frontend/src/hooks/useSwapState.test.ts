import { describe, expect, it } from 'vitest'

import { parseSwapSlippagePct, SWAP_SLIPPAGE_UI_MAX_PCT } from '@/hooks/useSwapState'

describe('parseSwapSlippagePct', () => {
  it('passes through user slippage up to the UI max', () => {
    expect(parseSwapSlippagePct('25')).toBe(25)
    expect(parseSwapSlippagePct('10')).toBe(10)
    expect(parseSwapSlippagePct(String(SWAP_SLIPPAGE_UI_MAX_PCT))).toBe(SWAP_SLIPPAGE_UI_MAX_PCT)
  })

  it('does not silently cap high slippage to 5%', () => {
    expect(parseSwapSlippagePct('25')).not.toBe(5)
  })

  it('falls back for invalid input', () => {
    expect(parseSwapSlippagePct('')).toBe(0.5)
    expect(parseSwapSlippagePct('abc')).toBe(0.5)
  })
})
