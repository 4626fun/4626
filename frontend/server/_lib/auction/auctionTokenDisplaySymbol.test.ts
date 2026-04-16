import { describe, expect, it } from 'vitest'

import { auctionTokenDisplaySymbol } from './auctionTokenDisplaySymbol.js'

describe('auctionTokenDisplaySymbol', () => {
  it('maps ws-prefixed wrapped share tickers to ■-prefixed display', () => {
    expect(auctionTokenDisplaySymbol('wsAKITA')).toBe('\u25A0AKITA')
    expect(auctionTokenDisplaySymbol('WSAKITA')).toBe('\u25A0AKITA')
  })

  it('leaves conventional symbols unchanged', () => {
    expect(auctionTokenDisplaySymbol('SHARE')).toBe('SHARE')
    expect(auctionTokenDisplaySymbol('USDC')).toBe('USDC')
    expect(auctionTokenDisplaySymbol('WETH')).toBe('WETH')
  })

  it('preserves an already share-prefixed symbol', () => {
    expect(auctionTokenDisplaySymbol('\u25A0AKITA')).toBe('\u25A0AKITA')
  })
})
