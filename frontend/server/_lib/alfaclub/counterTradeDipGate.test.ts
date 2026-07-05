import { describe, expect, it } from 'vitest'
import {
  isDipAddLiqSafeAfterAdd,
  projectLegLiqDistancePctAfterAdd,
  projectLiquidationPxAfterAdd,
} from './counterTradeDefense.js'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import type { CounterWalletPositionLeg } from './counterTradeEngine.js'

function makeRuntime(): CounterTradeRuntimeConfig {
  return {
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
    spotSweepEnabled: true,
    spotSweepMinUsd: 1,
    userSiloDefenseEnabled: false,
    userSiloHlAgentPrivateKey: null,
    userSiloMasterAddress: null,
    roomId: '1659',
    chatPostEnabled: true,
    chatPostRoomId: '1659',
    minUserNotionalUsd: 25,
    cooldownMs: 120_000,
    hourlyActionCap: 12,
    dailyNotionalCapUsd: 7_500,
    maxCounterNotionalPctOfFund: 10,
    maxCounterNotionalCeilingPctOfFund: 25,
    minOrderNotionalUsd: 10,
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
    subaccountsEnabled: false,
    subaccounts: { trend: null, meanRevert: null, event: null },
    riskProfile: {
      riskPerTradeBps: 100,
      dailyLossCapBps: 300,
      maxDrawdownPauseBps: 1000,
      stopDistancePctByStrategy: { trend: 2.5, meanRevert: 1.5, event: 4 },
    },
    inverseRebalanceScalePct: 100,
    dipDrawdownFullSizePct: 40,
    dipDrawdownCurveAlpha: 1.5,
    maxDipAddsPerLeg: 3,
    dipPreAddLiqSafetyMarginPct: 2,
  }
}

function makeLeg(overrides: Partial<CounterWalletPositionLeg> = {}): CounterWalletPositionLeg {
  return {
    coin: 'BTC',
    side: 'short',
    entryPx: 100,
    positionValue: 300,
    unrealizedPnl: -60,
    liquidationPx: 200,
    leverage: 6,
    ...overrides,
  }
}

describe('pre-add liquidation projection', () => {
  it('projects a liquidation price after an add on the correct side of mark', () => {
    const projected = projectLiquidationPxAfterAdd({
      leg: makeLeg(),
      addNotionalUsd: 100,
    })
    expect(projected).not.toBeNull()
    expect(projected!).toBeGreaterThan(120)
  })

  it('shrinks projected liq distance after an add on a losing leg', () => {
    const before = projectLegLiqDistancePctAfterAdd({ leg: makeLeg(), addNotionalUsd: 1 })
    const after = projectLegLiqDistancePctAfterAdd({ leg: makeLeg(), addNotionalUsd: 500 })
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!).toBeLessThan(before!)
  })

  it('passes liq gate when projected distance stays above threshold', () => {
    const gate = isDipAddLiqSafeAfterAdd({
      leg: makeLeg(),
      addNotionalUsd: 100,
      runtime: makeRuntime(),
    })
    expect(gate.ok).toBe(true)
    if (gate.ok) {
      expect(gate.projectedLiqDistancePct).toBeGreaterThan(14)
    }
  })

  it('blocks liq gate when leg is already too close to liquidation', () => {
    const gate = isDipAddLiqSafeAfterAdd({
      leg: makeLeg({ liquidationPx: 121 }),
      addNotionalUsd: 100,
      runtime: makeRuntime(),
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.reason).toBe('too_close')
    }
  })
})
