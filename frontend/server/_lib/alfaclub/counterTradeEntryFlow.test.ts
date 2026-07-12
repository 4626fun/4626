import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HyperliquidUserFillDetailed } from './hyperliquid.js'

const mocks = vi.hoisted(() => ({
  runArenaTrade: vi.fn(),
  getClearinghouseState: vi.fn(),
  recordCounterTradeAction: vi.fn(),
  postCounterTradeRoomUpdate: vi.fn(),
  postCounterTradeMonitorAlert: vi.fn(),
  isEntryAdvisoryEnabled: vi.fn(),
  postInverseAkitaEntryAdvisory: vi.fn(),
}))

vi.mock('../arena/arenaClient.js', () => ({
  runArenaTrade: mocks.runArenaTrade,
}))

vi.mock('./hyperliquid.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hyperliquid.js')>()
  return {
    ...actual,
    getClearinghouseState: mocks.getClearinghouseState,
  }
})

vi.mock('./counterTradeStore.js', () => ({
  recordCounterTradeAction: mocks.recordCounterTradeAction,
}))

vi.mock('./counterTradeRoomPosting.js', () => ({
  postCounterTradeRoomUpdate: mocks.postCounterTradeRoomUpdate,
  postCounterTradeMonitorAlert: mocks.postCounterTradeMonitorAlert,
}))

vi.mock('./counterTradeEntryAdvisory.js', () => ({
  isEntryAdvisoryEnabled: mocks.isEntryAdvisoryEnabled,
  postInverseAkitaEntryAdvisory: mocks.postInverseAkitaEntryAdvisory,
}))

import { executeCounterTradeEntryFlow } from './counterTradeEntryFlow.js'

function makeFill(): HyperliquidUserFillDetailed {
  return {
    closedPnl: 0,
    fee: 0.1,
    time: Date.parse('2026-07-12T08:30:00.000Z'),
    coin: 'HYPE',
    px: 38.42,
    sz: 100,
    dir: 'Open Long',
    side: 'long',
    startPosition: 0,
    leverage: 5,
  }
}

const identityConfig = {
  agentWalletAddress: '0xagent',
  hlSubaccountAddress: null,
} as Parameters<typeof executeCounterTradeEntryFlow>[0]['identityConfig']

describe('executeCounterTradeEntryFlow InverseAKITA advisory hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runArenaTrade.mockResolvedValue({ ok: true })
    mocks.getClearinghouseState.mockResolvedValue(null)
    mocks.recordCounterTradeAction.mockResolvedValue(undefined)
    mocks.postCounterTradeRoomUpdate.mockResolvedValue(undefined)
    mocks.postInverseAkitaEntryAdvisory.mockResolvedValue({ posted: true, decision: null })
    mocks.isEntryAdvisoryEnabled.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call advisory when env gate is off', async () => {
    const result = await executeCounterTradeEntryFlow({
      roomId: '1659',
      senderAddress: '0xuser',
      eventKey: 'evt-off',
      pair: 'HYPE',
      fill: makeFill(),
      fillAction: 'entry',
      counterSide: 'short',
      counterLeverage: 5,
      counterNotionalUsd: 250,
      userLeverage: 5,
      chatPostEnabled: true,
      chatPostRoomId: '1659',
      identityConfig,
      strategyKey: 'meanRevert',
      strategySubaccount: null,
    })
    expect(result.executedDelta).toBe(1)
    expect(mocks.postCounterTradeRoomUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.postInverseAkitaEntryAdvisory).not.toHaveBeenCalled()
  })

  it('fires advisory once after successful entry when env gate is on', async () => {
    mocks.isEntryAdvisoryEnabled.mockReturnValue(true)
    const result = await executeCounterTradeEntryFlow({
      roomId: '1659',
      senderAddress: '0xuser',
      eventKey: 'evt-on',
      pair: 'HYPE',
      fill: makeFill(),
      fillAction: 'entry',
      counterSide: 'short',
      counterLeverage: 5,
      counterNotionalUsd: 250,
      userLeverage: 5,
      chatPostEnabled: true,
      chatPostRoomId: '1659',
      identityConfig,
      strategyKey: 'meanRevert',
      strategySubaccount: null,
    })
    expect(result.executedDelta).toBe(1)
    expect(mocks.postInverseAkitaEntryAdvisory).toHaveBeenCalledTimes(1)
    expect(mocks.postInverseAkitaEntryAdvisory).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeRoomId: '1659',
        postRoomId: '1659',
        eventKey: 'evt-on',
        pair: 'HYPE',
        counterSide: 'short',
      }),
    )
  })

  it('keeps executedDelta=1 when advisory rejects', async () => {
    mocks.isEntryAdvisoryEnabled.mockReturnValue(true)
    mocks.postInverseAkitaEntryAdvisory.mockRejectedValue(new Error('hl_timeout'))
    const result = await executeCounterTradeEntryFlow({
      roomId: '1659',
      senderAddress: '0xuser',
      eventKey: 'evt-fail',
      pair: 'HYPE',
      fill: makeFill(),
      fillAction: 'entry',
      counterSide: 'short',
      counterLeverage: 5,
      counterNotionalUsd: 250,
      userLeverage: 5,
      chatPostEnabled: true,
      chatPostRoomId: '1659',
      identityConfig,
      strategyKey: 'meanRevert',
      strategySubaccount: null,
    })
    // Allow microtask rejection handler to run.
    await Promise.resolve()
    expect(result.executedDelta).toBe(1)
    expect(result.failedDelta).toBe(0)
  })
})
