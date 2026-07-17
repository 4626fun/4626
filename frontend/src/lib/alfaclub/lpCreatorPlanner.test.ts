import { parseUnits } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  ROOM_CREATOR_COIN_DEFAULTS,
  buildLpCreatorPlannerSeries,
  evaluateLpCreatorDeposit,
} from '@/lib/alfaclub/lpCreatorPlanner'

describe('buildLpCreatorPlannerSeries', () => {
  it('keeps the requested planner series length for explicit key counts', () => {
    const series = buildLpCreatorPlannerSeries({
      primaryBuyBondingToken: 9_000_000n,
      primarySellBondingToken: 5_000_000n,
      creatorCoinPriceBondingToken: parseUnits('2', 18),
      creatorCoinDecimals: 18,
      roomType: 1,
      keyCounts: [2, 3, 5],
    })

    expect(series).toHaveLength(3)
    expect(series.map((point) => point.keys)).toEqual([2, 3, 5])
  })
})

describe('evaluateLpCreatorDeposit', () => {
  it('flags when a manual override makes the LP cheaper to buy and richer to sell', () => {
    const outcome = evaluateLpCreatorDeposit({
      keyAmount: 5n,
      primaryBuyBondingToken: 9_000_000n,
      primarySellBondingToken: 5_000_000n,
      creatorCoinPriceBondingToken: parseUnits('2', 18),
      creatorCoinDecimals: 18,
      roomType: 1,
      creatorCoinAmountRaw: parseUnits('16', 18),
    })

    expect(outcome.buyPrefersLp).toBe(true)
    expect(outcome.sellPrefersLp).toBe(true)
    expect(outcome.lpBuyOneUsdc).toBeLessThan(outcome.curveBuyOneUsdc)
    expect(outcome.lpSellOneUsdc).toBeGreaterThan(outcome.curveSellOneUsdc)
  })
})

describe('ROOM_CREATOR_COIN_DEFAULTS', () => {
  it('includes the room 1659 creator coin default', () => {
    expect(ROOM_CREATOR_COIN_DEFAULTS['1659']).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
  })
})
