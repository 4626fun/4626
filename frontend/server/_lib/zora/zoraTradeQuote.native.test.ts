import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { toZoraTradeCurrency } from './zoraTradeQuote.js'

describe('toZoraTradeCurrency', () => {
  it('maps the canonical native ETH sentinel to eth', () => {
    expect(
      toZoraTradeCurrency('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'),
    ).toEqual({ type: 'eth' })
  })

  it('maps the legacy truncated eth funding sentinel to eth', () => {
    expect(toZoraTradeCurrency('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).toEqual({
      type: 'eth',
    })
  })

  it('maps the zero address to eth', () => {
    expect(
      toZoraTradeCurrency('0x0000000000000000000000000000000000000000'),
    ).toEqual({ type: 'eth' })
  })

  it('maps erc20 addresses', () => {
    const address = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'
    expect(toZoraTradeCurrency(address)).toEqual({
      type: 'erc20',
      address: getAddress(address),
    })
  })
})
