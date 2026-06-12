import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readArenaConfig: vi.fn(),
  resolveArenaIdentityForContext: vi.fn(),
  runArenaTrade: vi.fn(),
  getClearinghouseState: vi.fn(),
  getUserFillsByTimeDetailed: vi.fn(),
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
}))

vi.mock('./hyperliquid.js', () => ({
  getClearinghouseState: mocks.getClearinghouseState,
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

vi.mock('./chatBridge.js', () => ({
  sendAlfaClubRoomText: mocks.sendAlfaClubRoomText,
}))

import { runCounterTradeLoop } from './counterTradeRunner.js'

const BASE_RUNTIME = {
  enabled: true,
  exitEnabled: true,
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
    mocks.sendAlfaClubRoomText.mockResolvedValue({ lane: 'bot_token_without_reply_id' })
    mocks.recordCounterTradeAction.mockResolvedValue(undefined)
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
})
