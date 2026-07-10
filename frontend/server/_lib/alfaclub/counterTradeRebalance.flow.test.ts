import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'

const mocks = vi.hoisted(() => ({
  runArenaTrade: vi.fn(),
  countRebalanceDipAddsForLeg: vi.fn(),
  recordCounterTradeAction: vi.fn(),
}))

vi.mock('../arena/arenaClient.js', () => ({
  runArenaTrade: mocks.runArenaTrade,
}))

vi.mock('./counterTradeStore.js', async () => {
  const actual = await vi.importActual<typeof import('./counterTradeStore.js')>('./counterTradeStore.js')
  return {
    ...actual,
    countRebalanceDipAddsForLeg: mocks.countRebalanceDipAddsForLeg,
    recordCounterTradeAction: mocks.recordCounterTradeAction,
  }
})

vi.mock('./chatBridge.js', () => ({
  sendAlfaClubRoomText: vi.fn(),
}))

import { handlePairedLegRebalanceFlow } from './counterTradeRebalance.js'

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
    spotSweepEnabled: false,
    spotSweepMinUsd: 1,
    userSiloDefenseEnabled: true,
    userSiloHlAgentPrivateKey: `0x${'11'.repeat(32)}`,
    userSiloMasterAddress: '0xuser',
    roomId: '1659',
    chatPostEnabled: false,
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

const fill: HyperliquidUserFillDetailed = {
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
}

const userWalletState = {
  accountValueUsd: 10_000,
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

function runFlow(overrides: Partial<Parameters<typeof handlePairedLegRebalanceFlow>[0]> = {}) {
  return handlePairedLegRebalanceFlow({
    roomId: '1659',
    senderAddress: '0xsender',
    eventKey: 'fill-1',
    fill,
    runtime: makeRuntime(),
    userWalletState,
    botWalletState,
    userWalletForFills: '0xuser',
    baseArenaConfig: {} as any,
    botIdentityConfig: { agentWalletAddress: '0xbot' } as any,
    strategyKey: 'meanRevert',
    strategySubaccount: null,
    chatPostEnabled: false,
    chatPostRoomId: '1659',
    ...overrides,
  })
}

describe('paired-leg rebalance execution ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.countRebalanceDipAddsForLeg.mockResolvedValue(0)
    mocks.recordCounterTradeAction.mockResolvedValue(undefined)
  })

  it('does not execute the dip when the paired harvest fails', async () => {
    mocks.runArenaTrade.mockResolvedValueOnce({ ok: false, message: '/internal/worker/path failed' })

    const result = await runFlow()

    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'close', pair: 'HYPE' }),
      expect.anything(),
    )
    expect(result).toEqual({ executedDelta: 0, skippedDelta: 1, blockedDelta: 0, failedDelta: 1 })
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', reason: 'rebalance_harvest_failed' }),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', reason: 'rebalance_dip_skipped:harvest_not_executed' }),
    )
  })

  it('executes the dip only after the paired harvest succeeds', async () => {
    mocks.runArenaTrade.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true })

    const result = await runFlow()

    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(2)
    expect(mocks.runArenaTrade).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'close', pair: 'HYPE' }),
      expect.anything(),
    )
    expect(mocks.runArenaTrade).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'open', pair: 'HYPE', side: 'short', sizeUsd: expect.any(Number) }),
      expect.anything(),
    )
    expect(result).toEqual({ executedDelta: 2, skippedDelta: 0, blockedDelta: 0, failedDelta: 0 })
  })

  it.each(['cooldown_active', 'hourly_cap_reached', 'daily_notional_cap_reached', 'risk_gate:daily_loss_cap'])(
    'harvests but does not open or account for a dip blocked by %s',
    async (reason) => {
      mocks.runArenaTrade.mockResolvedValueOnce({ ok: true })
      const onDipExecuted = vi.fn()

      const result = await runFlow({
        authorizeDip: vi.fn().mockResolvedValue({ ok: false, reason }),
        onDipExecuted,
      })

      expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
      expect(mocks.runArenaTrade).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'close', pair: 'HYPE' }),
        expect.anything(),
      )
      expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'blocked', reason }),
      )
      expect(onDipExecuted).not.toHaveBeenCalled()
      expect(result).toEqual({ executedDelta: 1, skippedDelta: 0, blockedDelta: 1, failedDelta: 0 })
    },
  )

  it('executes and accounts the authorized, daily-capped dip notional', async () => {
    mocks.runArenaTrade.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true })
    const onDipExecuted = vi.fn()

    const result = await runFlow({
      authorizeDip: vi.fn().mockResolvedValue({ ok: true, addNotionalUsd: 40 }),
      onDipExecuted,
    })

    expect(mocks.runArenaTrade).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'open', sizeUsd: 40 }),
      expect.anything(),
    )
    expect(onDipExecuted).toHaveBeenCalledWith(expect.objectContaining({ addNotionalUsd: 40 }))
    expect(result).toEqual({ executedDelta: 2, skippedDelta: 0, blockedDelta: 0, failedDelta: 0 })
  })
})
