import { describe, expect, it } from 'vitest'

import { normalizeZoraCoinType, splitZoraHoldingsByCoinType, zoraCoinTypeLabel } from './coinType'

describe('normalizeZoraCoinType', () => {
  it('maps Zora API coin types', () => {
    expect(normalizeZoraCoinType('CREATOR')).toBe('CREATOR')
    expect(normalizeZoraCoinType('content')).toBe('CONTENT')
    expect(normalizeZoraCoinType('TREND')).toBe('TREND')
    expect(normalizeZoraCoinType('unknown')).toBe('CREATOR')
  })
})

describe('splitZoraHoldingsByCoinType', () => {
  it('routes trend coins out of the creator bucket', () => {
    const rows = [
      { coinType: 'CREATOR' as const, usdValue: 10, amount: 1, symbol: 'agent' },
      { coinType: 'TREND' as const, usdValue: 56, amount: 2, symbol: 'b20' },
      { coinType: 'CONTENT' as const, usdValue: 25, amount: 3, symbol: 'V0' },
    ]
    const split = splitZoraHoldingsByCoinType(rows)
    expect(split.creator.map((row) => row.symbol)).toEqual(['agent'])
    expect(split.trend.map((row) => row.symbol)).toEqual(['b20'])
    expect(split.content.map((row) => row.symbol)).toEqual(['V0'])
  })
})

describe('zoraCoinTypeLabel', () => {
  it('labels trend coins distinctly from creator coins', () => {
    expect(zoraCoinTypeLabel('TREND')).toBe('Trend coin')
    expect(zoraCoinTypeLabel('CREATOR')).toBe('Creator coin')
  })
})
