import { describe, expect, it } from 'vitest'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { derivePairedLegRebalancePlan } from './counterTradeRebalance.js'
import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'

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
    maxCounterNotionalCeilingPctOfFund: 25,
    maxCounterNotionalPctOfFund: 10,
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

function makeFill(overrides: Partial<HyperliquidUserFillDetailed> = {}): HyperliquidUserFillDetailed {
  return {
    closedPnl: 0,
    fee: 0,
    time: 1_720_000_000_000,
    coin: 'HYPE',
    px: 100,
    sz: 0.5,
    dir: 'Buy',
    side: 'long',
    startPosition: 2,
    leverage: 6,
    ...overrides,
  }
}

describe('derivePairedLegRebalancePlan', () => {
  it('harvests the winning leg and dips the losing leg by position-change pct', () => {
    const userWalletState = {
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: 80,
          entryPx: 100,
          liquidationPx: 80,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: -120,
          entryPx: 100,
          liquidationPx: 200,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ dir: 'Buy', side: 'long', startPosition: 2, sz: 0.5 }),
      fillAction: 'add',
      runtime: makeRuntime(),
      userWalletState,
      botWalletState,
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.rebalancePct).toBe(0.25)
    expect(plan.harvest?.silo).toBe('user')
    expect(plan.harvest?.side).toBe('long')
    expect(plan.harvest?.reduceNotionalUsd).toBe(100)
    expect(plan.dip?.silo).toBe('bot')
    expect(plan.dip?.side).toBe('short')
    expect(plan.dip?.addNotionalUsd).toBeCloseTo(88.39, 1)
  })

  it('scales dip notional by the inverse rebalance percentage', () => {
    const runtime = { ...makeRuntime(), inverseRebalanceScalePct: 50 }
    const userWalletState = {
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: 80,
          entryPx: 100,
          liquidationPx: 80,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: -60,
          entryPx: 100,
          liquidationPx: 200,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ startPosition: 2, sz: 0.5 }),
      fillAction: 'add',
      runtime,
      userWalletState,
      botWalletState,
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.rebalancePct).toBe(0.125)
    expect(plan.dip?.addNotionalUsd).toBeCloseTo(44.19, 1)
  })

  it('keeps the maximum notional cap after applying rebalance scaling', () => {
    const userWalletState = {
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: 80,
          entryPx: 100,
          liquidationPx: 80,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 1_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: -60,
          entryPx: 100,
          liquidationPx: 200,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ startPosition: 1, sz: 1 }),
      fillAction: 'add',
      runtime: makeRuntime(),
      userWalletState,
      botWalletState,
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.rebalancePct).toBe(1)
    expect(plan.dip?.addNotionalUsd).toBe(100)
  })

  it('blocks dip when max adds per leg is reached', () => {
    const userWalletState = {
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: 80,
          entryPx: 100,
          liquidationPx: 80,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: -60,
          entryPx: 100,
          liquidationPx: 200,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ dir: 'Buy', side: 'long', startPosition: 2, sz: 0.5 }),
      fillAction: 'add',
      runtime: makeRuntime(),
      userWalletState,
      botWalletState,
      dipAddsUsed: 3,
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('max_dip_adds')
  })

  it('blocks dip when pre-add liquidation gate fails', () => {
    const userWalletState = {
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: 80,
          entryPx: 100,
          liquidationPx: 80,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: -60,
          entryPx: 100,
          liquidationPx: 121,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ dir: 'Buy', side: 'long', startPosition: 2, sz: 0.5 }),
      fillAction: 'add',
      runtime: makeRuntime(),
      userWalletState,
      botWalletState,
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(['liq_gate_blocked', 'liq_gate_unprojectable']).toContain(plan.reason)
  })

  it('flips harvest/dip when the short leg is winning', () => {
    const userWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'long',
          positionValue: 400,
          unrealizedPnl: -50,
          entryPx: 100,
          liquidationPx: 60,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState
    const botWalletState = {
      accountValueUsd: 10_000,
      assetPositions: [
        {
          coin: 'HYPE',
          side: 'short',
          positionValue: 300,
          unrealizedPnl: 40,
          entryPx: 100,
          liquidationPx: 200,
          leverage: 6,
        },
      ],
    } as unknown as HyperliquidClearinghouseState

    const plan = derivePairedLegRebalancePlan({
      fill: makeFill({ dir: 'Sell', side: 'short', startPosition: -2, sz: 0.5 }),
      fillAction: 'reduce',
      runtime: makeRuntime(),
      userWalletState,
      botWalletState,
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.harvest?.silo).toBe('bot')
    expect(plan.harvest?.side).toBe('short')
    expect(plan.dip?.silo).toBe('user')
    expect(plan.dip?.side).toBe('long')
  })

  it('skips when both legs are flat', () => {
    const leg = {
      coin: 'HYPE',
      side: 'long' as const,
      positionValue: 200,
      unrealizedPnl: 0,
      entryPx: 100,
      liquidationPx: 80,
      leverage: 6,
    }
    const plan = derivePairedLegRebalancePlan({
      fill: makeFill(),
      fillAction: 'add',
      runtime: makeRuntime(),
      userWalletState: { assetPositions: [leg] } as unknown as HyperliquidClearinghouseState,
      botWalletState: {
        assetPositions: [{ ...leg, side: 'short' }],
      } as unknown as HyperliquidClearinghouseState,
    })
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('no_winner_or_loser')
  })
})
