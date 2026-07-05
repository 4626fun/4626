import { describe, expect, it } from 'vitest'
import {
  classifyCounterTradeFillAction,
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
  deriveUserPositionChangePct,
  findCounterPositionForCoin,
  isExitFillAction,
  resolveCounterTradeStrategyForPreset,
} from './counterTradeEngine.js'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
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
    subaccounts: {
      trend: null,
      meanRevert: null,
      event: null,
    },
    riskProfile: {
      riskPerTradeBps: 100,
      dailyLossCapBps: 300,
      maxDrawdownPauseBps: 1000,
      stopDistancePctByStrategy: {
        trend: 2.5,
        meanRevert: 1.5,
        event: 4,
      },
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
    coin: 'BTC',
    px: 100,
    sz: 2,
    dir: 'Open Long 6x',
    side: 'long',
    startPosition: 0,
    leverage: null,
    ...overrides,
  }
}

describe('counterTradeEngine', () => {
  it('derives executable opposite-side decision for favored bearish direction', () => {
    const decision = deriveCounterTradeDecision({
      bias: 'bearish',
      preset: 'balanced',
      fill: makeFill(),
      userNotionalUsd: 200,
      userLeverage: 6,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
    })
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.counterSide).toBe('short')
    expect(decision.counterLeverage).toBeGreaterThan(6)
    expect(decision.counterNotionalUsd).toBeGreaterThan(0)
  })

  it('uses strict inverse parity for entry opens without bias sizing modifiers', () => {
    const decision = deriveCounterTradeDecision({
      bias: 'bullish',
      preset: 'defensive',
      fill: makeFill(),
      userNotionalUsd: 200,
      userLeverage: 6,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
      strictInverseParity: true,
    })
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.mirrorAction).toBe('open')
    expect(decision.counterSide).toBe('short')
    expect(decision.counterLeverage).toBe(6)
    expect(decision.counterNotionalUsd).toBe(200)
  })

  it('derives user position change pct from fill transition math', () => {
    expect(
      deriveUserPositionChangePct(
        makeFill({ dir: 'Buy', side: 'long', startPosition: 2, sz: 0.5 }),
        'add',
      ),
    ).toBe(0.25)
    expect(
      deriveUserPositionChangePct(
        makeFill({ dir: 'Sell', side: 'short', startPosition: 2, sz: 0.5 }),
        'reduce',
      ),
    ).toBe(0.25)
  })

  it('delegates strict inverse add/reduce to the rebalance lane', () => {
    const addDecision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill({ dir: 'Buy', side: 'long', startPosition: 2, sz: 0.5 }),
      userNotionalUsd: 50,
      userLeverage: 6,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
      strictInverseParity: true,
    })
    expect(addDecision.ok).toBe(false)
    if (addDecision.ok) return
    expect(addDecision.reason).toBe('fill_action_not_counterable')
    expect(addDecision.fillAction).toBe('add')
  })

  it('skips when user notional is below configured minimum', () => {
    const decision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill(),
      userNotionalUsd: 10,
      userLeverage: 5,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
    })
    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.reason).toBe('below_min_notional')
  })

  it('builds deterministic event keys from fill payload', () => {
    const fill = makeFill({ time: 123, px: 42, sz: 0.5, dir: 'Open Short 3x', side: 'short' })
    const key = deriveEventKeyFromFill({
      walletAddress: '0x1111111111111111111111111111111111111111',
      fill,
    })
    expect(key).toContain('|123|')
    expect(key).toContain('|BTC|42|0.5|Open Short 3x|')
  })

  it('classifies position transitions across open/add/reduce/close', () => {
    expect(
      classifyCounterTradeFillAction(
        makeFill({ dir: 'Open Long 6x', side: 'long', startPosition: 0, sz: 1 }),
      ),
    ).toBe('entry')
    expect(
      classifyCounterTradeFillAction(
        makeFill({ dir: 'Buy', side: 'long', startPosition: 1, sz: 1 }),
      ),
    ).toBe('add')
    expect(
      classifyCounterTradeFillAction(
        makeFill({ dir: 'Sell', side: 'short', startPosition: 2, sz: 0.5 }),
      ),
    ).toBe('reduce')
    expect(
      classifyCounterTradeFillAction(
        makeFill({ dir: 'Sell', side: 'short', startPosition: 1, sz: 1 }),
      ),
    ).toBe('close')
  })

  it('skips non-counterable fill actions', () => {
    const reduceDecision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill({ dir: 'Sell', side: 'short', startPosition: 2, sz: 0.5 }),
      userNotionalUsd: 200,
      userLeverage: 4,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
    })
    expect(reduceDecision.ok).toBe(false)
    if (!reduceDecision.ok) {
      expect(reduceDecision.reason).toBe('fill_action_not_counterable')
    }

    const closeDecision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill({ dir: 'Close Short', side: 'short', startPosition: -1, sz: 1 }),
      userNotionalUsd: 200,
      userLeverage: 4,
      runtime: makeRuntime(),
      counterWalletState: { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] },
      strictInverseParity: true,
    })
    expect(closeDecision.ok).toBe(false)
    if (!closeDecision.ok) {
      expect(closeDecision.reason).toBe('fill_action_not_counterable')
      expect(closeDecision.fillAction).toBe('close')
    }
  })

  it('flags only close and liquidated fill actions as exits', () => {
    expect(isExitFillAction('close')).toBe(true)
    expect(isExitFillAction('liquidated')).toBe(true)
    expect(isExitFillAction('entry')).toBe(false)
    expect(isExitFillAction('add')).toBe(false)
    expect(isExitFillAction('reduce')).toBe(false)
  })

  it('finds the bot position leg for a coin case-insensitively', () => {
    const state = {
      assetPositions: [
        { coin: 'ETH', side: 'long', positionValue: 120, entryPx: null, liquidationPx: null },
        { coin: 'BTC', side: 'short', positionValue: 350, entryPx: null, liquidationPx: null },
      ],
    } as unknown as HyperliquidClearinghouseState

    expect(findCounterPositionForCoin(state, 'btc')).toEqual({
      coin: 'BTC',
      side: 'short',
      positionValue: 350,
    })
  })

  it('maps presets to strategy sleeves deterministically', () => {
    expect(resolveCounterTradeStrategyForPreset('defensive')).toBe('meanRevert')
    expect(resolveCounterTradeStrategyForPreset('balanced')).toBe('trend')
    expect(resolveCounterTradeStrategyForPreset('aggressive')).toBe('event')
  })
})
