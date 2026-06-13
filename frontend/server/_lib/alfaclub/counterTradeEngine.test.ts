import { describe, expect, it } from 'vitest'
import {
  classifyCounterTradeFillAction,
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
  findCounterPositionForCoin,
  isExitFillAction,
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
    maxCounterNotionalPerTradeUsd: 750,
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
      counterWalletState: null,
    })
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.counterSide).toBe('short')
    expect(decision.counterLeverage).toBeGreaterThan(6)
    expect(decision.counterNotionalUsd).toBeGreaterThan(0)
  })

  it('skips when user notional is below configured minimum', () => {
    const decision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill(),
      userNotionalUsd: 10,
      userLeverage: 5,
      runtime: makeRuntime(),
      counterWalletState: null,
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
    expect(
      classifyCounterTradeFillAction(
        makeFill({ dir: 'Sell', side: 'short', startPosition: 0.25, sz: 1 }),
      ),
    ).toBe('close')
  })

  it('skips non-counterable fill actions (reduce/close/liquidation)', () => {
    const reduceDecision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill({ dir: 'Sell', side: 'short', startPosition: 2, sz: 0.5 }),
      userNotionalUsd: 200,
      userLeverage: 4,
      runtime: makeRuntime(),
      counterWalletState: null,
    })
    expect(reduceDecision.ok).toBe(false)
    if (!reduceDecision.ok) {
      expect(reduceDecision.reason).toBe('fill_action_not_counterable')
      expect(reduceDecision.fillAction).toBe('reduce')
    }

    const closeDecision = deriveCounterTradeDecision({
      bias: 'neutral',
      preset: 'balanced',
      fill: makeFill({ dir: 'Close Short', side: 'short', startPosition: -1, sz: 1 }),
      userNotionalUsd: 200,
      userLeverage: 4,
      runtime: makeRuntime(),
      counterWalletState: null,
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
    expect(isExitFillAction('unknown')).toBe(false)
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
    expect(findCounterPositionForCoin(state, 'SOL')).toBeNull()
    expect(findCounterPositionForCoin(null, 'BTC')).toBeNull()
    expect(findCounterPositionForCoin(state, '')).toBeNull()
  })

  it('ignores flat or malformed position legs when resolving exit targets', () => {
    const state = {
      assetPositions: [
        { coin: 'BTC', side: null, positionValue: 350 },
        { coin: 'BTC', side: 'short', positionValue: 0 },
        { coin: 'BTC', side: 'short', positionValue: null },
      ],
    } as unknown as HyperliquidClearinghouseState

    expect(findCounterPositionForCoin(state, 'BTC')).toBeNull()
  })
})

