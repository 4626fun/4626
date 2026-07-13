import { describe, expect, it } from 'vitest'

import {
  buildAlfaClubSeedCandidate,
  quoteAlfaClubPoolBuy,
  quoteAlfaClubPoolSell,
} from './lpSeedMath'

describe('AlfaClub LP seed math', () => {
  it('matches the pool buy and sell formulas with integer rounding', () => {
    expect(
      quoteAlfaClubPoolBuy({
        creatorCoinReserve: 10_000n,
        keyReserve: 10n,
        keyAmount: 1n,
        feeBps: 690n,
      }),
    ).toBe(1_195n)
    expect(
      quoteAlfaClubPoolSell({
        creatorCoinReserve: 10_000n,
        keyReserve: 10n,
        keyAmount: 1n,
        feeBps: 690n,
      }),
    ).toBe(847n)
  })

  it('seeds the reserve ratio at the converted primary midpoint', () => {
    const candidate = buildAlfaClubSeedCandidate({
      primaryBuyBondingToken: 112_640_000n,
      primarySellBondingToken: 89_302_500n,
      creatorCoinPriceBondingToken: 10_000n,
      creatorCoinDecimals: 18,
      keyAmount: 10n,
      feeBps: 690n,
    })

    expect(candidate.primaryMidBondingToken).toBe(100_971_250n)
    expect(candidate.creatorCoinPerKey).toBe(10_097_125_000_000_000_000_000n)
    expect(candidate.creatorCoinAmount).toBe(
      candidate.creatorCoinPerKey * candidate.keyAmount,
    )
    expect(candidate.oneKeyBuy).toBeGreaterThan(candidate.creatorCoinPerKey)
    expect(candidate.oneKeySell).toBeLessThan(candidate.creatorCoinPerKey)
  })

  it('rejects a one-key seed because it cannot quote a one-key buy', () => {
    expect(() =>
      buildAlfaClubSeedCandidate({
        primaryBuyBondingToken: 2n,
        primarySellBondingToken: 1n,
        creatorCoinPriceBondingToken: 1n,
        creatorCoinDecimals: 18,
        keyAmount: 1n,
        feeBps: 690n,
      }),
    ).toThrow('seed_inputs_must_be_positive')
  })

  it('preserves sub-micro USDC Creator Coin price precision', () => {
    const candidate = buildAlfaClubSeedCandidate({
      primaryBuyBondingToken: 112_640_000n,
      primarySellBondingToken: 89_302_500n,
      creatorCoinPriceBondingToken: 1_613_652_510_939n,
      bondingTokenScale: 10n ** 6n,
      creatorCoinPriceScale: 10n ** 18n,
      creatorCoinDecimals: 18,
      keyAmount: 10n,
      feeBps: 690n,
    })

    expect(candidate.creatorCoinPerKey).toBeGreaterThan(
      62_000_000n * 10n ** 18n,
    )
  })
})
