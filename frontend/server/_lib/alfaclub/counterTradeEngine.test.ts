import { describe, expect, it } from 'vitest'
import {
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
} from './counterTradeEngine.js'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import type { HyperliquidUserFillDetailed } from './hyperliquid.js'

function makeRuntime(): CounterTradeRuntimeConfig {
  return {
    enabled: true,
    roomId: '1659',
    chatPostEnabled: true,
    chatPostRoomId: '1659',
    minUserNotionalUsd: 25,
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
})

