import { describe, expect, it } from 'vitest'

import {
  computeBufferRatio,
  deriveCounterTradeDefenseActions,
  formatDefenseAlertPost,
  formatDefenseRoomPost,
} from './counterTradeDefense.js'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import type { HyperliquidClearinghouseState } from './hyperliquid.js'

const RUNTIME: CounterTradeRuntimeConfig = {
  enabled: true,
  exitEnabled: true,
  defenseEnabled: true,
  defendLiqDistancePct: 12,
  defendReduceFraction: 0.25,
  harvestTriggerRoiPct: 50,
  harvestFraction: 0.25,
  minReduceNotionalUsd: 15,
  minBufferRatio: 0.2,
  maxDefenseActionsPerTick: 2,
  userSiloDefenseEnabled: false,
  userSiloHlAgentPrivateKey: null,
  userSiloMasterAddress: null,
  roomId: '1659',
  chatPostEnabled: true,
  chatPostRoomId: '1659',
  minUserNotionalUsd: 1,
  cooldownMs: 120_000,
  hourlyActionCap: 12,
  dailyNotionalCapUsd: 7_500,
  maxCounterNotionalPerTradeUsd: 750,
  globalMaxLeverage: 12,
  favoredMultiplier: 1.35,
  neutralMultiplier: 1,
  unfavoredMultiplier: 0.75,
  favoredNotionalRatio: 0.6,
  neutralNotionalRatio: 0.45,
  unfavoredNotionalRatio: 0.3,
  neutralBiasLeverageCap: 8,
  favoredBiasLeverageCap: 10,
  unfavoredBiasLeverageCap: 6,
  liquidationMinDistancePct: 8,
  eventLookbackMs: 45 * 60_000,
  runLimitPerIdentity: 20,
}

type Leg = NonNullable<HyperliquidClearinghouseState['assetPositions']>[number]

function makeState(params: {
  accountValueUsd?: number | null
  withdrawableUsd?: number | null
  legs?: Leg[]
}): HyperliquidClearinghouseState {
  return {
    accountValueUsd: params.accountValueUsd === undefined ? 10_000 : params.accountValueUsd,
    totalNtlPosUsd: null,
    totalRawUsdUsd: null,
    withdrawableUsd: params.withdrawableUsd === undefined ? 5_000 : params.withdrawableUsd,
    assetPositions: params.legs ?? [],
  }
}

// Short losing leg: entry 100, pnl -50 on $1000 leg → mark ≈ 105.
// liquidationPx 115 → distance ≈ 9.5% (defend zone, not escalated).
const LOSING_SHORT_DEFEND: Leg = {
  coin: 'BTC',
  side: 'short',
  entryPx: 100,
  positionValue: 1_000,
  unrealizedPnl: -50,
  liquidationPx: 115,
  leverage: 5,
}

// Same leg but liquidationPx 110 → distance ≈ 4.8% (inside half threshold → escalated).
const LOSING_SHORT_ESCALATED: Leg = {
  ...LOSING_SHORT_DEFEND,
  liquidationPx: 110,
}

// Winning long: entry 100, pnl +120, 5x → margin $200 → ROI 60% ≥ 50% trigger.
// mark ≈ 112, liq 80 → distance ≈ 28.6% (healthy).
const WINNING_LONG_HARVEST: Leg = {
  coin: 'ETH',
  side: 'long',
  entryPx: 100,
  positionValue: 1_000,
  unrealizedPnl: 120,
  liquidationPx: 80,
  leverage: 5,
}

// Healthy leg: far from liq, low ROI → no action.
const HEALTHY_LEG: Leg = {
  coin: 'SOL',
  side: 'long',
  entryPx: 100,
  positionValue: 1_000,
  unrealizedPnl: 10,
  liquidationPx: 50,
  leverage: 5,
}

describe('computeBufferRatio', () => {
  it('returns withdrawable / accountValue clamped to [0, 1]', () => {
    expect(computeBufferRatio(makeState({ accountValueUsd: 1_000, withdrawableUsd: 250 }))).toBeCloseTo(
      0.25,
      6,
    )
    expect(computeBufferRatio(makeState({ accountValueUsd: 100, withdrawableUsd: 500 }))).toBe(1)
    expect(computeBufferRatio(makeState({ accountValueUsd: 100, withdrawableUsd: -5 }))).toBe(0)
  })

  it('returns null when fields are missing or account value is non-positive', () => {
    expect(computeBufferRatio(null)).toBeNull()
    expect(computeBufferRatio(makeState({ accountValueUsd: null }))).toBeNull()
    expect(computeBufferRatio(makeState({ withdrawableUsd: null }))).toBeNull()
    expect(computeBufferRatio(makeState({ accountValueUsd: 0, withdrawableUsd: 10 }))).toBeNull()
  })
})

describe('deriveCounterTradeDefenseActions', () => {
  it('returns nothing when defense is disabled or there are no legs', () => {
    expect(
      deriveCounterTradeDefenseActions({
        state: makeState({ legs: [LOSING_SHORT_DEFEND] }),
        runtime: { ...RUNTIME, defenseEnabled: false },
      }),
    ).toEqual([])
    expect(deriveCounterTradeDefenseActions({ state: makeState({}), runtime: RUNTIME })).toEqual([])
    expect(deriveCounterTradeDefenseActions({ state: null, runtime: RUNTIME })).toEqual([])
  })

  it('leaves healthy legs alone', () => {
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [HEALTHY_LEG] }),
      runtime: RUNTIME,
    })
    expect(actions).toEqual([])
  })

  it('partially reduces a leg inside the defend threshold', () => {
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [LOSING_SHORT_DEFEND] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('defend_reduce')
    expect(actions[0].coin).toBe('BTC')
    expect(actions[0].side).toBe('short')
    expect(actions[0].fullClose).toBe(false)
    expect(actions[0].reduceNotionalUsd).toBeCloseTo(250, 6)
    expect(actions[0].liqDistancePct).not.toBeNull()
    expect(actions[0].liqDistancePct!).toBeLessThanOrEqual(RUNTIME.defendLiqDistancePct)
  })

  it('escalates the reduce fraction when inside half the defend threshold', () => {
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [LOSING_SHORT_ESCALATED] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('defend_reduce')
    // 0.25 fraction doubled to 0.5 → $500 of the $1000 leg.
    expect(actions[0].reduceNotionalUsd).toBeCloseTo(500, 6)
  })

  it('fully closes a dust leg instead of leaving an unreducible remainder', () => {
    const tinyLeg: Leg = { ...LOSING_SHORT_ESCALATED, positionValue: 25, unrealizedPnl: -1.25 }
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [tinyLeg] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(1)
    expect(actions[0].fullClose).toBe(true)
    expect(actions[0].reduceNotionalUsd).toBeCloseTo(25, 6)
  })

  it('harvests partial profit off a winner above the ROI trigger', () => {
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [WINNING_LONG_HARVEST] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('harvest_take_profit')
    expect(actions[0].coin).toBe('ETH')
    expect(actions[0].fullClose).toBe(false)
    expect(actions[0].reduceNotionalUsd).toBeCloseTo(250, 6)
    expect(actions[0].unrealizedRoiPct).toBeCloseTo(60, 6)
  })

  it('never full-closes a healthy winner via harvest (dust winners are skipped)', () => {
    const dustWinner: Leg = { ...WINNING_LONG_HARVEST, positionValue: 25, unrealizedPnl: 3 }
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [dustWinner] }),
      runtime: RUNTIME,
    })
    expect(actions).toEqual([])
  })

  it('does not harvest below the ROI trigger', () => {
    const modestWinner: Leg = { ...WINNING_LONG_HARVEST, unrealizedPnl: 80 } // ROI 40% < 50%
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [modestWinner] }),
      runtime: RUNTIME,
    })
    expect(actions).toEqual([])
  })

  it('prioritizes defends over harvests and respects the per-tick cap', () => {
    const secondLoser: Leg = { ...LOSING_SHORT_DEFEND, coin: 'SOL', liquidationPx: 110 }
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [WINNING_LONG_HARVEST, LOSING_SHORT_DEFEND, secondLoser] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(2)
    expect(actions.every((a) => a.type === 'defend_reduce')).toBe(true)
    // Most urgent (smallest liq distance) first.
    expect(actions[0].coin).toBe('SOL')
    expect(actions[1].coin).toBe('BTC')
  })

  it('floors small partial reduces to the minimum order size', () => {
    // 25% of $80 = $20 ≥ $15 floor; but 25% of $50 = $12.50 → floored to $15.
    const smallLeg: Leg = { ...LOSING_SHORT_DEFEND, positionValue: 50, unrealizedPnl: -2.5 }
    const actions = deriveCounterTradeDefenseActions({
      state: makeState({ legs: [smallLeg] }),
      runtime: RUNTIME,
    })
    expect(actions).toHaveLength(1)
    expect(actions[0].fullClose).toBe(false)
    expect(actions[0].reduceNotionalUsd).toBeCloseTo(15, 6)
  })
})

describe('formatDefenseRoomPost', () => {
  it('formats a defend post with liq distance and buffer', () => {
    const text = formatDefenseRoomPost({
      action: {
        type: 'defend_reduce',
        coin: 'BTC',
        side: 'short',
        reduceNotionalUsd: 250,
        fullClose: false,
        positionValueUsd: 1_000,
        liqDistancePct: 9.5,
        unrealizedRoiPct: -25,
      },
      bufferRatio: 0.24,
    })
    expect(text).toContain('🛡️ Defense: reduced Short BTC by ~$250.00 of $1000.00')
    expect(text).toContain('Liq distance 9.5%')
    expect(text).toContain('Silo buffer 24% of equity')
  })

  it('formats a harvest post with ROI', () => {
    const text = formatDefenseRoomPost({
      action: {
        type: 'harvest_take_profit',
        coin: 'ETH',
        side: 'long',
        reduceNotionalUsd: 250,
        fullClose: false,
        positionValueUsd: 1_000,
        liqDistancePct: 28.6,
        unrealizedRoiPct: 60,
      },
      bufferRatio: null,
    })
    expect(text).toContain('🌾 Harvest: took ~$250.00 off winning Long ETH')
    expect(text).toContain('Unrealized ROI +60%')
    expect(text).not.toContain('Silo buffer')
  })

  it('tags user-silo actions so room posts distinguish the two wallets', () => {
    const text = formatDefenseRoomPost({
      action: {
        type: 'defend_reduce',
        coin: 'BTC',
        side: 'long',
        reduceNotionalUsd: 250,
        fullClose: false,
        positionValueUsd: 1_000,
        liqDistancePct: 5.2,
        unrealizedRoiPct: -25,
      },
      bufferRatio: 0.2,
      silo: 'user',
    })
    expect(text).toContain('🛡️ Defense (user silo): reduced Long BTC')
  })
})

describe('formatDefenseAlertPost', () => {
  it('formats an advisory defend alert with suggested reduce size', () => {
    const text = formatDefenseAlertPost({
      action: {
        type: 'defend_reduce',
        coin: 'BTC',
        side: 'long',
        reduceNotionalUsd: 500,
        fullClose: false,
        positionValueUsd: 1_000,
        liqDistancePct: 5.3,
        unrealizedRoiPct: -25,
      },
      bufferRatio: 0.2,
      silo: 'user',
    })
    expect(text).toContain('⚠️ Defense alert (user silo): Long BTC is 5.3% from liquidation')
    expect(text).toContain('Suggested: reduce ~$500.00 of $1000.00')
    expect(text).toContain('Silo buffer 20% of equity')
  })

  it('suggests a full close for dust legs and formats harvest alerts', () => {
    const dustText = formatDefenseAlertPost({
      action: {
        type: 'defend_reduce',
        coin: 'BTC',
        side: 'short',
        reduceNotionalUsd: 25,
        fullClose: true,
        positionValueUsd: 25,
        liqDistancePct: 4.8,
        unrealizedRoiPct: -25,
      },
      bufferRatio: null,
    })
    expect(dustText).toContain('Suggested: close the leg (~$25.00)')

    const harvestText = formatDefenseAlertPost({
      action: {
        type: 'harvest_take_profit',
        coin: 'ETH',
        side: 'long',
        reduceNotionalUsd: 250,
        fullClose: false,
        positionValueUsd: 1_000,
        liqDistancePct: 28.6,
        unrealizedRoiPct: 60,
      },
      bufferRatio: null,
      silo: 'user',
    })
    expect(harvestText).toContain('🌾 Harvest alert (user silo): Long ETH is up +60% ROI')
    expect(harvestText).toContain('Suggested: take ~$250.00 off')
  })
})
