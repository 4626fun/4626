import { describe, expect, it } from 'vitest'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import {
  computeAdverseDrawdownPct,
  resolveDrawdownBasedDipAddUsd,
  resolveDrawdownCurveMultiplier,
  resolveMaxCounterNotionalUsd,
} from './counterTradeSizing.js'
import type { CounterWalletPositionLeg } from './counterTradeEngine.js'

function makeRuntime(overrides: Partial<CounterTradeRuntimeConfig> = {}): CounterTradeRuntimeConfig {
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
    ...overrides,
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

describe('counterTradeSizing', () => {
  it('uses target pct when below ceiling', () => {
    expect(
      resolveMaxCounterNotionalUsd({
        runtime: makeRuntime(),
        accountValueUsd: 10_000,
        strictInverseParity: true,
      }),
    ).toBe(1_000)
  })

  it('computes side-aware adverse drawdown', () => {
    expect(
      computeAdverseDrawdownPct({ side: 'long', entryPx: 100, markPx: 80 }),
    ).toBe(20)
    expect(
      computeAdverseDrawdownPct({ side: 'short', entryPx: 100, markPx: 120 }),
    ).toBe(20)
    expect(
      computeAdverseDrawdownPct({ side: 'long', entryPx: 100, markPx: 110 }),
    ).toBe(0)
  })

  it('clamps drawdown curve at full size when drawdown exceeds D', () => {
    expect(
      resolveDrawdownCurveMultiplier({
        adverseDrawdownPct: 80,
        maxDrawdownForFullSizePct: 40,
        alpha: 1.5,
      }),
    ).toBe(1)
  })

  it('returns zero curve multiplier at zero drawdown', () => {
    expect(
      resolveDrawdownCurveMultiplier({
        adverseDrawdownPct: 0,
        maxDrawdownForFullSizePct: 40,
        alpha: 1.5,
      }),
    ).toBe(0)
  })

  it('sizes dip add from fund pct and drawdown curve', () => {
    const addUsd = resolveDrawdownBasedDipAddUsd({
      runtime: makeRuntime(),
      accountValueUsd: 10_000,
      leg: makeLeg(),
    })
    expect(addUsd).toBeCloseTo(353.55, 1)
  })

  it('returns null when fund snapshot is missing', () => {
    expect(
      resolveDrawdownBasedDipAddUsd({
        runtime: makeRuntime(),
        accountValueUsd: null,
        leg: makeLeg(),
      }),
    ).toBeNull()
  })

  it('returns null when leg entry is missing', () => {
    expect(
      resolveDrawdownBasedDipAddUsd({
        runtime: makeRuntime(),
        accountValueUsd: 10_000,
        leg: makeLeg({ entryPx: null }),
      }),
    ).toBeNull()
  })
})
