import { describe, expect, it } from 'vitest'

import { formatHoldingAmount, parseZoraProfileBalance } from './zoraWalletHoldings.js'

describe('zoraWalletHoldings helpers', () => {
  it('parses human-readable Zora profile balances', () => {
    expect(parseZoraProfileBalance('1250.5')).toBe(1250.5)
    expect(parseZoraProfileBalance('0')).toBe(0)
  })

  it('parses large integer balances as wei', () => {
    expect(parseZoraProfileBalance('1000000000000000000')).toBe(1)
  })

  it('formats holding amounts for swap rows', () => {
    expect(formatHoldingAmount(1250.5)).toBe('1,250.5')
    expect(formatHoldingAmount(0)).toBe('0')
  })
})
