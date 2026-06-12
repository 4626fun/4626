import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readArenaConfig: vi.fn(),
  resolveArenaIdentityForContext: vi.fn(),
  runArenaTrade: vi.fn(),
  runArenaSpotPerpTransfer: vi.fn(),
  getClearinghouseState: vi.fn(),
  getSpotUsdcBalance: vi.fn(),
  getUserFillsByTimeDetailed: vi.fn(),
  resolveBotBankedPnlForClose: vi.fn(),
  readCounterTradeRuntimeConfig: vi.fn(),
  listActiveCounterTradeOptIns: vi.fn(),
  readCounterTradeUsageWindow: vi.fn(),
  readOrCreateCounterTradeRoomStrategy: vi.fn(),
  recordCounterTradeAction: vi.fn(),
  registerCounterTradeEventIfNew: vi.fn(),
  enforceSingleActiveCounterTradeActor: vi.fn(),
  resolveRoom1659HyperliquidUserForSnapshot: vi.fn(),
  sendAlfaClubRoomText: vi.fn(),
}))

vi.mock('../arena/arenaConfig.js', () => ({
  readArenaConfig: mocks.readArenaConfig,
}))

vi.mock('../arena/arenaIdentityMappingStore.js', () => ({
  resolveArenaIdentityForContext: mocks.resolveArenaIdentityForContext,
}))

vi.mock('../arena/arenaClient.js', () => ({
  runArenaTrade: mocks.runArenaTrade,
  runArenaSpotPerpTransfer: mocks.runArenaSpotPerpTransfer,
}))

vi.mock('./hyperliquid.js', () => ({
  getClearinghouseState: mocks.getClearinghouseState,
  getSpotUsdcBalance: mocks.getSpotUsdcBalance,
  getUserFillsByTimeDetailed: mocks.getUserFillsByTimeDetailed,
}))

vi.mock('./counterTradeConfig.js', async () => {
  const actual = await vi.importActual<typeof import('./counterTradeConfig.js')>('./counterTradeConfig.js')
  return {
    ...actual,
    readCounterTradeRuntimeConfig: mocks.readCounterTradeRuntimeConfig,
  }
})

vi.mock('./counterTradeStore.js', () => ({
  COUNTER_TRADE_EXIT_EXECUTED_REASON: 'exit_executed',
  COUNTER_TRADE_DEFENSE_EXECUTED_REASON: 'defense_reduce_executed',
  COUNTER_TRADE_HARVEST_EXECUTED_REASON: 'harvest_tp_executed',
  COUNTER_TRADE_DEFENSE_ALERT_REASON: 'defense_alert_posted',
  COUNTER_TRADE_HARVEST_ALERT_REASON: 'harvest_alert_posted',
  listActiveCounterTradeOptIns: mocks.listActiveCounterTradeOptIns,
  readCounterTradeUsageWindow: mocks.readCounterTradeUsageWindow,
  readOrCreateCounterTradeRoomStrategy: mocks.readOrCreateCounterTradeRoomStrategy,
  recordCounterTradeAction: mocks.recordCounterTradeAction,
  registerCounterTradeEventIfNew: mocks.registerCounterTradeEventIfNew,
  enforceSingleActiveCounterTradeActor: mocks.enforceSingleActiveCounterTradeActor,
}))

vi.mock('./room1659Market.js', () => ({
  resolveRoom1659HyperliquidUserForSnapshot: mocks.resolveRoom1659HyperliquidUserForSnapshot,
}))

vi.mock('./counterTradeHarvest.js', async () => {
  const actual = await vi.importActual<typeof import('./counterTradeHarvest.js')>(
    './counterTradeHarvest.js',
  )
  return {
    ...actual,
    resolveBotBankedPnlForClose: mocks.resolveBotBankedPnlForClose,
  }
})

vi.mock('./chatBridge.js', () => ({
  sendAlfaClubRoomText: mocks.sendAlfaClubRoomText,
}))

import { runCounterTradeLoop } from './counterTradeRunner.js'
import { __resetDefenseAlertStateForTests } from './counterTradeDefense.js'

const BASE_RUNTIME = {
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
} as const

const FILL = {
  time: 1_720_000_000_000,
  coin: 'BTC',
  dir: 'Open Long',
  sz: '1',
  px: '100',
}

describe('runCounterTradeLoop end-to-end integration behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetDefenseAlertStateForTests()
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_ENABLED', '1')

    mocks.readCounterTradeRuntimeConfig.mockReturnValue(BASE_RUNTIME)
    mocks.resolveRoom1659HyperliquidUserForSnapshot.mockReturnValue(
      '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
    )
    mocks.readArenaConfig.mockReturnValue({
      roomId: BASE_RUNTIME.roomId,
      strategy: {
        enabled: true,
        mode: 'counter_trade',
        adminBias: 'neutral',
        adminLeverageCap: null,
        neutralBiasLeverageCap: BASE_RUNTIME.neutralBiasLeverageCap,
        favoredBiasLeverageCap: BASE_RUNTIME.favoredBiasLeverageCap,
        unfavoredBiasLeverageCap: BASE_RUNTIME.unfavoredBiasLeverageCap,
        minUserNotionalUsd: BASE_RUNTIME.minUserNotionalUsd,
        maxCounterNotionalPerTradeUsd: BASE_RUNTIME.maxCounterNotionalPerTradeUsd,
        dailyNotionalCapUsd: BASE_RUNTIME.dailyNotionalCapUsd,
        hourlyActionCap: BASE_RUNTIME.hourlyActionCap,
        cooldownMs: BASE_RUNTIME.cooldownMs,
        liquidationMinDistancePct: BASE_RUNTIME.liquidationMinDistancePct,
      },
    })

    mocks.listActiveCounterTradeOptIns.mockResolvedValue([
      { senderAddress: '0xsender', preset: 'balanced', lastActionAt: null },
    ])

    mocks.resolveArenaIdentityForContext.mockResolvedValue({
      roomId: BASE_RUNTIME.roomId,
      senderAddress: '0xsender',
      agentWalletAddress: '0xagentwallet',
      hlApiWalletAddress: '0xhlwallet',
      hasDbRow: true,
      source: 'db',
    })

    mocks.getUserFillsByTimeDetailed.mockResolvedValue([FILL])
    mocks.registerCounterTradeEventIfNew.mockResolvedValue(true)
    mocks.readCounterTradeUsageWindow.mockResolvedValue({ executedCount: 0, notionalUsd: 0 })
    mocks.readOrCreateCounterTradeRoomStrategy.mockResolvedValue({
      enabled: true,
      killSwitch: false,
      globalBias: 'neutral',
    })
    mocks.enforceSingleActiveCounterTradeActor.mockResolvedValue({
      roomId: BASE_RUNTIME.roomId,
      survivorSenderAddress: '0xsender',
      pausedSenderAddresses: [],
    })

    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [],
      marginSummary: { accountValue: '10000' },
      crossMarginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
      withdrawable: '5000',
    })

    mocks.runArenaTrade.mockResolvedValue({ ok: true, fill: { oid: 1234 } })
    mocks.getSpotUsdcBalance.mockResolvedValue(0)
    mocks.runArenaSpotPerpTransfer.mockResolvedValue({ ok: true, message: 'Transferred.' })
    mocks.sendAlfaClubRoomText.mockResolvedValue({ lane: 'bot_token_without_reply_id' })
    mocks.recordCounterTradeAction.mockResolvedValue(undefined)
    mocks.resolveBotBankedPnlForClose.mockResolvedValue(null)
  })

  it('executes a qualifying counter-trade and records success', async () => {
    const result = await runCounterTradeLoop()

    expect(result.scannedEvents).toBe(1)
    expect(result.newEvents).toBe(1)
    expect(result.executed).toBe(1)
    expect(result.blocked).toBe(0)
    expect(result.failed).toBe(0)

    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    expect(mocks.getUserFillsByTimeDetailed).toHaveBeenCalledWith(
      '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
      expect.any(Number),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalled()
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
    const statuses = mocks.recordCounterTradeAction.mock.calls.map((call) => call[0]?.status)
    expect(statuses).toContain('executed')
  })

  it('continues scanning other identities after one identity fails', async () => {
    mocks.readCounterTradeRuntimeConfig.mockReturnValue({
      ...BASE_RUNTIME,
      roomId: '1043',
      chatPostRoomId: '1043',
    })
    mocks.listActiveCounterTradeOptIns.mockResolvedValue([
      { senderAddress: '0xsender-a', preset: 'balanced', lastActionAt: null },
      { senderAddress: '0xsender-b', preset: 'balanced', lastActionAt: null },
    ])
    mocks.resolveArenaIdentityForContext
      .mockRejectedValueOnce(new Error('identity failed'))
      .mockResolvedValueOnce({
        roomId: BASE_RUNTIME.roomId,
        senderAddress: '0xsender-b',
        agentWalletAddress: '0xagentwallet',
        hlApiWalletAddress: '0xhlwallet',
        hasDbRow: true,
        source: 'db',
      })

    const result = await runCounterTradeLoop()

    expect(result.scannedIdentities).toBe(2)
    expect(result.executed).toBe(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
  })

  it('uses only one active strategy actor for room 1659', async () => {
    mocks.listActiveCounterTradeOptIns.mockResolvedValue([
      { senderAddress: '0xsender-a', preset: 'balanced', lastActionAt: null },
      { senderAddress: '0xsender-b', preset: 'balanced', lastActionAt: null },
      { senderAddress: '0xsender-c', preset: 'balanced', lastActionAt: null },
    ])
    mocks.resolveArenaIdentityForContext.mockResolvedValue({
      roomId: BASE_RUNTIME.roomId,
      senderAddress: '0xsender-a',
      agentWalletAddress: '0xagentwallet',
      hlApiWalletAddress: '0xhlwallet',
      hasDbRow: true,
      source: 'db',
    })

    const result = await runCounterTradeLoop()

    expect(result.scannedIdentities).toBe(1)
    expect(result.executed).toBe(1)
    expect(mocks.resolveArenaIdentityForContext).toHaveBeenCalledTimes(1)
    expect(mocks.resolveArenaIdentityForContext).toHaveBeenCalledWith(
      expect.objectContaining({ senderAddress: '0xsender-a' }),
    )
    expect(mocks.enforceSingleActiveCounterTradeActor).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '1659',
        survivorSenderAddress: '0xsender-a',
      }),
    )
  })

  it('mirrors a user close by closing the bot position on that pair', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC' },
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'executed', reason: 'exit_executed', counterSide: 'short' }),
    )
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
  })

  it('includes the banked harvest amount on the exit room post when resolvable', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })
    mocks.resolveBotBankedPnlForClose.mockResolvedValue({
      realizedPnlUsd: 12.4,
      feesUsd: 0.3,
      netRealizedUsd: 12.1,
      fillCount: 1,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(mocks.resolveBotBankedPnlForClose).toHaveBeenCalledWith(
      expect.objectContaining({ botWalletAddress: '0xagentwallet', coin: 'BTC' }),
    )
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).toContain('Banked +$12.10')
    expect(postedText).toContain('pnl +$12.40')
  })

  it('still posts the exit card when the harvest lookup fails', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })
    mocks.resolveBotBankedPnlForClose.mockRejectedValue(new Error('hl_unreachable'))

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).not.toContain('Banked')
  })

  it('mirrors a user liquidation by closing the bot position', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Liquidated Long', sz: '1', px: '100' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC' },
      expect.anything(),
    )
  })

  it('skips a mirrored exit when the bot holds no position on the pair', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mocks.runArenaTrade).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', reason: 'exit_no_position' }),
    )
  })

  it('skips mirrored exits entirely when exitEnabled is off', async () => {
    mocks.readCounterTradeRuntimeConfig.mockReturnValue({ ...BASE_RUNTIME, exitEnabled: false })
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mocks.runArenaTrade).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', reason: 'exit_disabled:close' }),
    )
  })

  it('mirrored exit bypasses an active cooldown', async () => {
    const nowMs = Date.now()
    mocks.listActiveCounterTradeOptIns.mockResolvedValue([
      {
        senderAddress: '0xsender',
        preset: 'balanced',
        lastActionAt: new Date(nowMs - 15_000).toISOString(),
      },
    ])
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.blocked).toBe(0)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC' },
      expect.anything(),
    )
  })

  it('closes a same-tick entry+exit pair even though the position snapshot is stale', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, time: 1_720_000_000_000, dir: 'Open Long 6x', sz: '1', px: '100', startPosition: '0' },
      { ...FILL, time: 1_720_000_060_000, dir: 'Close Long', sz: '1', px: '101', startPosition: '1' },
    ])
    // Snapshot taken before the entry executed — shows no BTC position.
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(2)
    expect(mocks.runArenaTrade).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'open', pair: 'BTC', side: 'short' }),
      expect.anything(),
    )
    expect(mocks.runArenaTrade).toHaveBeenNthCalledWith(
      2,
      { action: 'close', pair: 'BTC' },
      expect.anything(),
    )
  })

  it('records a failed exit when the arena close errors', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
      marginSummary: { accountValue: '10000' },
      time: 1_720_000_000_000,
    })
    mocks.runArenaTrade.mockResolvedValue({ ok: false, message: 'close rejected' })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(0)
    expect(result.failed).toBe(1)
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', reason: 'exit_failed:close rejected' }),
    )
  })

  it('blocks execution when cooldown is still active from lastActionAt', async () => {
    const nowMs = Date.now()
    mocks.listActiveCounterTradeOptIns.mockResolvedValue([
      {
        senderAddress: '0xsender',
        preset: 'balanced',
        lastActionAt: new Date(nowMs - (BASE_RUNTIME.cooldownMs - 15_000)).toISOString(),
      },
    ])

    const result = await runCounterTradeLoop()

    expect(result.scannedEvents).toBe(1)
    expect(result.newEvents).toBe(1)
    expect(result.executed).toBe(0)
    expect(result.blocked).toBe(1)
    expect(result.failed).toBe(0)

    expect(mocks.runArenaTrade).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'blocked',
        reason: 'cooldown_active',
      }),
    )
  })

  it('defense partially reduces a bot leg near liquidation even with no user fills', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    // Short losing leg: entry 100, pnl -50 on $1000 → mark ≈ 105; liq 115 → ~9.5% distance.
    mocks.getClearinghouseState.mockResolvedValue({
      accountValueUsd: 10_000,
      withdrawableUsd: 3_000,
      assetPositions: [
        {
          coin: 'BTC',
          side: 'short',
          entryPx: 100,
          positionValue: 1_000,
          unrealizedPnl: -50,
          liquidationPx: 115,
          leverage: 5,
        },
      ],
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC', sizeUsd: 250 },
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'executed',
        reason: 'defense_reduce_executed',
        counterSide: 'short',
        counterNotionalUsd: 250,
      }),
    )
    expect(mocks.sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).toContain('🛡️ Defense')
  })

  it('harvests partial profit off a winning bot leg above the ROI trigger', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    // Winning long: pnl +120 on $1000 @5x → margin $200 → ROI 60% ≥ 50% trigger.
    mocks.getClearinghouseState.mockResolvedValue({
      accountValueUsd: 10_000,
      withdrawableUsd: 3_000,
      assetPositions: [
        {
          coin: 'ETH',
          side: 'long',
          entryPx: 100,
          positionValue: 1_000,
          unrealizedPnl: 120,
          liquidationPx: 80,
          leverage: 5,
        },
      ],
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'ETH', sizeUsd: 250 },
      expect.anything(),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'executed', reason: 'harvest_tp_executed' }),
    )
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).toContain('🌾 Harvest')
  })

  it('blocks new entries when the silo buffer ratio is below the floor', async () => {
    // withdrawable 1k of 10k equity → buffer 10% < 20% floor; no defense-eligible legs.
    mocks.getClearinghouseState.mockResolvedValue({
      accountValueUsd: 10_000,
      withdrawableUsd: 1_000,
      assetPositions: [],
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(0)
    expect(result.blocked).toBe(1)
    expect(mocks.runArenaTrade).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked', reason: 'buffer_floor' }),
    )
  })

  it('mirrored exits still run when the buffer is below the entry floor', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    mocks.getClearinghouseState.mockResolvedValue({
      accountValueUsd: 10_000,
      withdrawableUsd: 1_000,
      assetPositions: [
        { coin: 'BTC', side: 'short', positionValue: 45, entryPx: 100, liquidationPx: 200 },
      ],
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.blocked).toBe(0)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC' },
      expect.anything(),
    )
  })

  it('does not double-close when defense fully closed the coin earlier in the tick', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      { ...FILL, dir: 'Close Long', sz: '1', px: '100', startPosition: '1' },
    ])
    // Dust losing leg near liquidation → defense full-closes it, then the
    // user's mirrored close on the same coin must be skipped.
    mocks.getClearinghouseState.mockResolvedValue({
      accountValueUsd: 10_000,
      withdrawableUsd: 3_000,
      assetPositions: [
        {
          coin: 'BTC',
          side: 'short',
          entryPx: 100,
          positionValue: 25,
          unrealizedPnl: -1.25,
          liquidationPx: 105,
          leverage: 5,
        },
      ],
    })

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC' },
      expect.anything(),
    )
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'executed', reason: 'defense_reduce_executed' }),
    )
  })

  it('user-silo defense reduces a user leg near liquidation via the API-wallet config', async () => {
    const userWallet = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'
    const agentKey = `0x${'11'.repeat(32)}`
    mocks.readCounterTradeRuntimeConfig.mockReturnValue({
      ...BASE_RUNTIME,
      userSiloDefenseEnabled: true,
      userSiloHlAgentPrivateKey: agentKey,
    })
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    // Bot wallet healthy/no legs; user wallet has a losing long inside the
    // defend threshold (entry 100, pnl -50 on $1000 → mark ≈ 95; liq 90 → ~5.3%).
    mocks.getClearinghouseState.mockImplementation(async (address: string) =>
      address === '0xagentwallet'
        ? { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] }
        : {
            accountValueUsd: 4_000,
            withdrawableUsd: 800,
            assetPositions: [
              {
                coin: 'BTC',
                side: 'long',
                entryPx: 100,
                positionValue: 1_000,
                unrealizedPnl: -50,
                liquidationPx: 90,
                leverage: 5,
              },
            ],
          },
    )

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mocks.getClearinghouseState).toHaveBeenCalledWith(userWallet)
    expect(mocks.runArenaTrade).toHaveBeenCalledTimes(1)
    // ~5.3% liq distance is inside half the 12% defend threshold → escalated
    // shave: 2 × 25% of the $1000 leg = $500.
    expect(mocks.runArenaTrade).toHaveBeenCalledWith(
      { action: 'close', pair: 'BTC', sizeUsd: 500 },
      expect.objectContaining({
        hlAgentPrivateKey: agentKey,
        hlMasterAddressOverride: userWallet,
        agentWalletAddress: null,
      }),
    )
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).toContain('(user silo)')
  })

  it('falls back to alert-only user-silo defense when no API-wallet key is configured', async () => {
    const userWallet = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'
    mocks.readCounterTradeRuntimeConfig.mockReturnValue({
      ...BASE_RUNTIME,
      userSiloDefenseEnabled: true,
      userSiloHlAgentPrivateKey: null,
    })
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    // Same risky user leg as the execute-mode test, but without a key the
    // bot must warn instead of trade.
    mocks.getClearinghouseState.mockImplementation(async (address: string) =>
      address === '0xagentwallet'
        ? { accountValueUsd: 10_000, withdrawableUsd: 5_000, assetPositions: [] }
        : {
            accountValueUsd: 4_000,
            withdrawableUsd: 800,
            assetPositions: [
              {
                coin: 'BTC',
                side: 'long',
                entryPx: 100,
                positionValue: 1_000,
                unrealizedPnl: -50,
                liquidationPx: 90,
                leverage: 5,
              },
            ],
          },
    )

    const result = await runCounterTradeLoop()

    expect(result.executed).toBe(0)
    expect(result.failed).toBe(0)
    expect(mocks.getClearinghouseState).toHaveBeenCalledWith(userWallet)
    // No orders — the silo is custodied; only an advisory card goes out.
    expect(mocks.runArenaTrade).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', reason: 'defense_alert_posted' }),
    )
    const postedText = String(mocks.sendAlfaClubRoomText.mock.calls[0]?.[0]?.text ?? '')
    expect(postedText).toContain('⚠️ Defense alert (user silo)')
    expect(postedText).toContain('BTC')

    // Second tick inside the alert cooldown: no duplicate post.
    mocks.sendAlfaClubRoomText.mockClear()
    mocks.recordCounterTradeAction.mockClear()
    await runCounterTradeLoop()
    expect(mocks.sendAlfaClubRoomText).not.toHaveBeenCalled()
    expect(mocks.recordCounterTradeAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'defense_alert_posted' }),
    )
  })

  it('sweeps spot USDC into the perps account when above the minimum', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    mocks.getSpotUsdcBalance.mockResolvedValue(5.994314)

    await runCounterTradeLoop()

    expect(mocks.getSpotUsdcBalance).toHaveBeenCalledWith('0xagentwallet')
    expect(mocks.runArenaSpotPerpTransfer).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaSpotPerpTransfer).toHaveBeenCalledWith(
      { amountUsd: 5.994314 },
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
  })

  it('skips the spot sweep below the minimum and when disabled', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])
    mocks.getSpotUsdcBalance.mockResolvedValue(0.5)

    await runCounterTradeLoop()
    expect(mocks.runArenaSpotPerpTransfer).not.toHaveBeenCalled()

    mocks.readCounterTradeRuntimeConfig.mockReturnValue({
      ...BASE_RUNTIME,
      spotSweepEnabled: false,
    })
    mocks.getSpotUsdcBalance.mockResolvedValue(100)

    await runCounterTradeLoop()
    expect(mocks.runArenaSpotPerpTransfer).not.toHaveBeenCalled()
  })

  it('spot sweep runs even when defense is disabled and ticks still mirror trades', async () => {
    mocks.readCounterTradeRuntimeConfig.mockReturnValue({
      ...BASE_RUNTIME,
      defenseEnabled: false,
    })
    mocks.getSpotUsdcBalance.mockResolvedValue(6)

    await runCounterTradeLoop()

    expect(mocks.runArenaSpotPerpTransfer).toHaveBeenCalledTimes(1)
    expect(mocks.runArenaTrade).toHaveBeenCalled()
  })
})
