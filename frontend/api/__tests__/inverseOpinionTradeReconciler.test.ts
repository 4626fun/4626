import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDecisionsMock = vi.fn()
const findLifecycleMock = vi.fn()
const openLifecycleMock = vi.fn()
const appendEventMock = vi.fn()
const transitionLifecycleMock = vi.fn()
const transitionDecisionMock = vi.fn()
const claimFillMock = vi.fn()
const claimFillsMock = vi.fn()
const reserveFillsMock = vi.fn()
const recordUnknownCheckMock = vi.fn()
const getFillsMock = vi.fn()
const getStateMock = vi.fn()

vi.mock('../../server/_lib/alfaclub/inverseOpinionTradeStore.js', () => ({
  listOpinionDecisionsForReconciliation: listDecisionsMock,
  findOpenPositionLifecycle: findLifecycleMock,
  openPositionLifecycle: openLifecycleMock,
  appendPositionLifecycleEvent: appendEventMock,
  transitionPositionLifecycle: transitionLifecycleMock,
  transitionOpinionDecision: transitionDecisionMock,
  claimOpinionFillIdentity: claimFillMock,
  claimOpinionFillIdentities: claimFillsMock,
  reserveOpinionFillIdentities: reserveFillsMock,
  recordUnknownReconciliationCheck: recordUnknownCheckMock,
}))

vi.mock('../../server/_lib/alfaclub/hyperliquid.js', () => ({
  getUserFillsByTimeDetailed: getFillsMock,
  getClearinghouseState: getStateMock,
}))

const DECISION = {
  decisionId: '11111111-1111-4111-8111-111111111111',
  sourceMessageId: '22222222-2222-4222-8222-222222222222',
  intentOrdinal: 0,
  normalizedMarket: 'BTC',
  sourceSide: 'long' as const,
  inverseSide: 'short' as const,
  executionPhase: 'resolved' as const,
  terminalOutcome: 'executed' as const,
  reasonCode: 'arena_execution_succeeded',
  executorWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
  requestedParameters: {
    action: 'open',
    pair: 'BTC',
    side: 'short',
    sizeUsd: 100,
  },
  receiptSummary: {
    fill: { totalSz: 0.001, avgPx: 100_000 },
  },
  attributionQuality: 'complete' as const,
  observedAt: '2026-07-12T08:00:00.000Z',
  submittedAt: '2026-07-12T08:00:05.000Z',
  resolvedAt: '2026-07-12T08:00:06.000Z',
  updatedAt: '2026-07-12T08:00:06.000Z',
}

const LIFECYCLE = {
  lifecycleId: '33333333-3333-4333-8333-333333333333',
  executorWallet: DECISION.executorWallet,
  normalizedMarket: 'BTC',
  side: 'short' as const,
  openingDecisionId: DECISION.decisionId,
  lifecycleState: 'open' as const,
  attributionQuality: 'complete' as const,
  reconciliationGeneration: 4,
  openedAt: '2026-07-12T08:00:06.000Z',
  closedAt: null,
  lastReconciledAt: '2026-07-13T08:00:00.000Z',
  currentSnapshot: {
    dataAsOf: '2026-07-13T08:00:00.000Z',
    unrealizedPnlUsd: 4,
  },
  realizedResult: {},
  createdAt: '2026-07-12T08:00:06.000Z',
  updatedAt: '2026-07-13T08:00:00.000Z',
}

const OPEN_POSITION = {
  coin: 'BTC',
  entryPx: 100_000,
  positionValue: 100,
  unrealizedPnl: 7,
  liquidationPx: 140_000,
  leverage: 3,
  side: 'short' as const,
}

describe('reconcileInverseOpinionTrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFillsMock.mockReset()
    getStateMock.mockReset()
    listDecisionsMock.mockResolvedValue([DECISION])
    findLifecycleMock.mockResolvedValue(null)
    openLifecycleMock.mockImplementation(async (params) => ({
      ...LIFECYCLE,
      lifecycleState: params.lifecycleState,
      attributionQuality: params.attributionQuality,
      reconciliationGeneration: 0,
      currentSnapshot: params.currentSnapshot ?? {},
    }))
    appendEventMock.mockResolvedValue({})
    transitionLifecycleMock.mockImplementation(async (params) => ({
      ...LIFECYCLE,
      lifecycleState: params.lifecycleState,
      reconciliationGeneration: params.expectedReconciliationGeneration + 1,
      currentSnapshot: params.currentSnapshot ?? LIFECYCLE.currentSnapshot,
      realizedResult: params.realizedResult ?? {},
      closedAt: params.closedAt ?? null,
    }))
    transitionDecisionMock.mockResolvedValue(DECISION)
    claimFillMock.mockResolvedValue(true)
    claimFillsMock.mockResolvedValue(true)
    reserveFillsMock.mockResolvedValue(true)
    recordUnknownCheckMock.mockResolvedValue({ decision: DECISION, expired: false })
    getFillsMock.mockResolvedValue([])
    getStateMock.mockResolvedValue({ assetPositions: [OPEN_POSITION] })
  })

  it('correlates and claims a unique detailed fill before treating an Arena receipt as complete', async () => {
    getFillsMock.mockResolvedValue([{
      fillId: 'receipt-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result).toMatchObject({ scanned: 1, opened: 1, ambiguous: 0, stale: 0 })
    expect(claimFillsMock).toHaveBeenCalledWith({
      decisionId: DECISION.decisionId,
      executorWallet: DECISION.executorWallet,
      fillIdentities: ['receipt-fill'],
    })
    expect(openLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      openingDecisionId: DECISION.decisionId,
      lifecycleState: 'pending',
      attributionQuality: 'complete',
    }))
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
      eventType: 'open',
      eventPayload: expect.objectContaining({
        evidenceSource: 'arena_receipt_correlated_fill',
        fill: expect.objectContaining({ size: 0.001, price: 100_000, fillId: 'receipt-fill' }),
      }),
    }))
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'open',
      currentSnapshot: expect.objectContaining({
        dataAsOf: '2026-07-14T08:00:00.000Z',
        unrealizedPnlUsd: 7,
      }),
    }))
  })

  it('keeps receipt-only evidence partial and never exposes creator PnL or confirmed open state', async () => {
    getFillsMock.mockResolvedValue(null)
    getStateMock.mockResolvedValue(null)
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result).toMatchObject({ scanned: 1, opened: 1, stale: 1 })
    expect(claimFillsMock).not.toHaveBeenCalled()
    expect(openLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'partial',
      attributionQuality: 'partial',
      currentSnapshot: expect.objectContaining({
        evidenceStatus: 'receipt_only',
      }),
    }))
    expect(transitionLifecycleMock).not.toHaveBeenCalled()
    expect(JSON.stringify(openLifecycleMock.mock.calls)).not.toContain('unrealizedPnlUsd')
    expect(JSON.stringify(openLifecycleMock.mock.calls)).not.toContain('"evidenceStatus":"confirmed"')
  })

  it('does not let a later receipt-less decision claim a fill already claimed by the receipt decision', async () => {
    const second = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      submittedAt: '2026-07-12T08:00:05.500Z',
    }
    listDecisionsMock.mockResolvedValue([DECISION, second])
    getFillsMock.mockResolvedValue([{
      fillId: 'receipt-owned-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    claimFillsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(claimFillsMock).toHaveBeenCalledTimes(2)
    expect(appendEventMock).toHaveBeenCalledTimes(1)
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
    }))
    expect(result.ambiguous).toBe(1)
  })

  it('prioritizes a receipt-backed decision over an older generic decision for the same fill', async () => {
    const olderGeneric = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      submittedAt: '2026-07-12T08:00:04.000Z',
    }
    listDecisionsMock.mockResolvedValue([olderGeneric, DECISION])
    getFillsMock.mockResolvedValue([{
      fillId: 'receipt-owned-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    const claimed = new Set<string>()
    claimFillsMock.mockImplementation(async ({ fillIdentities }) => {
      if (fillIdentities.some((identity: string) => claimed.has(identity))) return false
      fillIdentities.forEach((identity: string) => claimed.add(identity))
      return true
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(claimFillsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      decisionId: DECISION.decisionId,
      fillIdentities: ['receipt-owned-fill'],
    }))
    expect(appendEventMock).toHaveBeenCalledTimes(1)
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
    }))
    expect(getFillsMock).toHaveBeenCalledTimes(1)
    expect(getStateMock).toHaveBeenCalledTimes(1)
    expect(getFillsMock).toHaveBeenCalledWith(
      DECISION.executorWallet,
      Date.parse(olderGeneric.submittedAt) - 30_000,
    )
  })

  it('applies one transient executor snapshot failure consistently to every decision in the batch', async () => {
    const generic = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      submittedAt: '2026-07-12T08:00:04.000Z',
    }
    listDecisionsMock.mockResolvedValue([generic, DECISION])
    getFillsMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{
        fillId: 'must-not-be-visible-to-generic',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt),
        px: 100_000,
        sz: 0.001,
        dir: 'Open Short',
        side: 'short',
        startPosition: 0,
        closedPnl: 0,
        fee: 0.02,
        leverage: 3,
      }])
    getStateMock.mockResolvedValue(null)
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(getFillsMock).toHaveBeenCalledTimes(1)
    expect(getStateMock).toHaveBeenCalledTimes(1)
    expect(claimFillsMock).not.toHaveBeenCalled()
    expect(appendEventMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ scanned: 2, stale: 2 })
  })

  it('atomically claims every fill in a receipt-correlated order split', async () => {
    const olderGeneric = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      requestedParameters: { ...DECISION.requestedParameters, sizeUsd: 40 },
      submittedAt: '2026-07-12T08:00:04.000Z',
    }
    listDecisionsMock.mockResolvedValue([olderGeneric, DECISION])
    getFillsMock.mockResolvedValue([
      {
        fillId: 'split-a',
        orderId: 'order-42',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt),
        px: 99_900,
        sz: 0.0004,
        dir: 'Open Short',
        side: 'short',
        startPosition: 0,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
      {
        fillId: 'split-b',
        orderId: 'order-42',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt) + 250,
        px: 100_066.66666666667,
        sz: 0.0006,
        dir: 'Open Short',
        side: 'short',
        startPosition: -0.0004,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
    ])
    const claimed = new Set<string>()
    claimFillsMock.mockImplementation(async ({ fillIdentities }) => {
      if (fillIdentities.some((identity: string) => claimed.has(identity))) return false
      fillIdentities.forEach((identity: string) => claimed.add(identity))
      return true
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result).toMatchObject({ opened: 1, ambiguous: 1, stale: 0 })
    expect(claimFillsMock).toHaveBeenCalledTimes(2)
    expect(claimFillsMock).toHaveBeenNthCalledWith(1, {
      decisionId: DECISION.decisionId,
      executorWallet: DECISION.executorWallet,
      fillIdentities: ['split-a', 'split-b'],
    })
    expect(claimFillsMock).toHaveBeenNthCalledWith(2, {
      decisionId: olderGeneric.decisionId,
      executorWallet: DECISION.executorWallet,
      fillIdentities: ['split-a'],
    })
    expect(claimFillMock).not.toHaveBeenCalled()
    expect(appendEventMock).toHaveBeenCalledTimes(1)
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
      eventPayload: expect.objectContaining({
        evidenceSource: 'arena_receipt_correlated_fill',
        fill: expect.objectContaining({
          size: 0.001,
          price: 100_000,
          fillIds: ['split-a', 'split-b'],
          orderId: 'order-42',
        }),
      }),
    }))
  })

  it('claims a bounded no-order split only when its aggregate grouping is unique', async () => {
    getFillsMock.mockResolvedValue([
      {
        fillId: 'no-order-a',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt),
        px: 100_000,
        sz: 0.0004,
        dir: 'Open Short',
        side: 'short',
        startPosition: 0,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
      {
        fillId: 'no-order-b',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt) + 250,
        px: 100_000,
        sz: 0.0006,
        dir: 'Open Short',
        side: 'short',
        startPosition: -0.0004,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
    ])
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result).toMatchObject({ opened: 1, ambiguous: 0 })
    expect(claimFillsMock).toHaveBeenCalledWith(expect.objectContaining({
      fillIdentities: ['no-order-a', 'no-order-b'],
    }))
  })

  it('reserves every fill in ambiguous receipt groups before a later generic decision', async () => {
    const generic = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      requestedParameters: { ...DECISION.requestedParameters, sizeUsd: 40 },
      submittedAt: '2026-07-12T08:00:05.500Z',
    }
    listDecisionsMock.mockResolvedValue([generic, DECISION])
    getFillsMock.mockResolvedValue([
      {
        fillId: 'ambiguous-split-a',
        orderId: 'order-a',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt),
        px: 100_000,
        sz: 0.0004,
        dir: 'Open Short',
        side: 'short',
        startPosition: 0,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
      {
        fillId: 'ambiguous-split-b',
        orderId: 'order-a',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt) + 100,
        px: 100_000,
        sz: 0.0006,
        dir: 'Open Short',
        side: 'short',
        startPosition: -0.0004,
        closedPnl: 0,
        fee: 0.01,
        leverage: 3,
      },
      {
        fillId: 'ambiguous-single',
        orderId: 'order-b',
        coin: 'BTC',
        time: Date.parse(DECISION.submittedAt) + 200,
        px: 100_000,
        sz: 0.001,
        dir: 'Open Short',
        side: 'short',
        startPosition: 0,
        closedPnl: 0,
        fee: 0.02,
        leverage: 3,
      },
    ])
    const claimed = new Map<string, string>()
    reserveFillsMock.mockImplementation(async ({ decisionId, fillIdentities }) => {
      const allOwned = fillIdentities.every(
        (identity: string) => !claimed.has(identity) || claimed.get(identity) === decisionId,
      )
      fillIdentities.forEach((identity: string) => {
        if (!claimed.has(identity)) claimed.set(identity, decisionId)
      })
      return allOwned
    })
    claimFillsMock.mockImplementation(async ({ decisionId, fillIdentities }) => {
      if (fillIdentities.some(
        (identity: string) => claimed.has(identity) && claimed.get(identity) !== decisionId,
      )) return false
      fillIdentities.forEach((identity: string) => claimed.set(identity, decisionId))
      return true
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(reserveFillsMock).toHaveBeenCalledWith({
      decisionId: DECISION.decisionId,
      executorWallet: DECISION.executorWallet,
      fillIdentities: [
        'ambiguous-split-a',
        'ambiguous-split-b',
        'ambiguous-single',
      ],
    })
    expect(claimFillsMock).toHaveBeenCalledWith({
      decisionId: generic.decisionId,
      executorWallet: generic.executorWallet,
      fillIdentities: ['ambiguous-split-a'],
    })
    expect(appendEventMock).not.toHaveBeenCalled()
    expect(result.ambiguous).toBe(2)
  })

  it('marks multiple plausible fills ambiguous without attaching fill or PnL details', async () => {
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }])
    getFillsMock.mockResolvedValue([
      { fillId: 'fill-a', coin: 'BTC', time: Date.parse(DECISION.submittedAt), px: 100_000, sz: 0.001, dir: 'Open Short', side: 'short', startPosition: 0, closedPnl: 0, fee: 0.02, leverage: 3 },
      { fillId: 'fill-b', coin: 'BTC', time: Date.parse(DECISION.submittedAt) + 500, px: 100_100, sz: 0.001, dir: 'Open Short', side: 'short', startPosition: 0, closedPnl: 0, fee: 0.02, leverage: 3 },
    ])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.ambiguous).toBe(1)
    expect(openLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'ambiguous',
      attributionQuality: 'partial',
      currentSnapshot: expect.objectContaining({
        evidenceStatus: 'ambiguous',
        candidateCount: 2,
      }),
    }))
    const payload = openLifecycleMock.mock.calls[0][0].currentSnapshot
    expect(payload).not.toHaveProperty('fill')
    expect(payload).not.toHaveProperty('unrealizedPnlUsd')
    expect(appendEventMock).not.toHaveBeenCalled()
  })

  it('records an ambiguous later decision without downgrading an already-confirmed lifecycle', async () => {
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }])
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    getFillsMock.mockResolvedValue([
      { fillId: 'fill-a', coin: 'BTC', time: Date.parse(DECISION.submittedAt), px: 100_000, sz: 0.001, dir: 'Open Short', side: 'short', startPosition: 0, closedPnl: 0, fee: 0.02, leverage: 3 },
      { fillId: 'fill-b', coin: 'BTC', time: Date.parse(DECISION.submittedAt) + 500, px: 100_100, sz: 0.001, dir: 'Open Short', side: 'short', startPosition: 0, closedPnl: 0, fee: 0.02, leverage: 3 },
    ])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.ambiguous).toBe(1)
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleId: LIFECYCLE.lifecycleId,
      decisionId: DECISION.decisionId,
      eventKey: `decision:ambiguous:${DECISION.decisionId}`,
      eventType: 'reconcile',
      eventPayload: {
        evidenceStatus: 'ambiguous',
        candidateCount: 2,
      },
    }))
    expect(transitionLifecycleMock).not.toHaveBeenCalled()
  })

  it('carries an old open lifecycle across days and refreshes lifecycle-level unrealized PnL', async () => {
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.refreshed).toBe(1)
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleId: LIFECYCLE.lifecycleId,
      lifecycleState: 'open',
      expectedReconciliationGeneration: 4,
      currentSnapshot: expect.objectContaining({
        unrealizedPnlUsd: 7,
      }),
    }))
    expect(transitionLifecycleMock.mock.calls[0][0]).not.toHaveProperty('realizedResult')
  })

  it('promotes a partial lifecycle only when a later pass finds unique execution evidence', async () => {
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }])
    findLifecycleMock.mockResolvedValue({
      ...LIFECYCLE,
      lifecycleState: 'partial',
      attributionQuality: 'partial',
    })
    getFillsMock.mockResolvedValue([{
      fillId: 'late-visible-entry',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: 'hyperliquid:fill:late-visible-entry',
    }))
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'open',
      attributionQuality: 'complete',
      currentSnapshot: expect.objectContaining({ unrealizedPnlUsd: 7 }),
    }))
  })

  it('resolves an unknown decision only after one unique Hyperliquid fill proves execution', async () => {
    const unknownDecision = {
      ...DECISION,
      executionPhase: 'unknown' as const,
      terminalOutcome: null,
      reasonCode: 'arena_submit_unknown',
      receiptSummary: {},
    }
    listDecisionsMock.mockResolvedValue([unknownDecision])
    findLifecycleMock.mockResolvedValue({
      ...LIFECYCLE,
      lifecycleState: 'partial',
      attributionQuality: 'partial',
    })
    getFillsMock.mockResolvedValue([{
      fillId: 'unknown-confirmed',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(transitionDecisionMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
      executionPhase: 'resolved',
      terminalOutcome: 'executed',
      reasonCode: 'hyperliquid_execution_confirmed',
      receiptSummary: expect.objectContaining({
        terminalReply: expect.objectContaining({
          replyText: expect.stringMatching(/execution confirmed/i),
          threadReceiptText: expect.stringMatching(/filled 0\.001 @ \$100000/i),
        }),
      }),
    }))
  })

  it('attributes one Hyperliquid fill to only one of two nearby decisions', async () => {
    const second = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      receiptSummary: {},
      submittedAt: '2026-07-12T08:00:05.500Z',
    }
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }, second])
    getFillsMock.mockResolvedValue([{
      fillId: 'shared-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    claimFillsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(claimFillsMock).toHaveBeenCalledTimes(2)
    expect(appendEventMock).toHaveBeenCalledTimes(1)
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: DECISION.decisionId,
      eventKey: 'hyperliquid:fill:shared-fill',
    }))
    expect(result.ambiguous).toBe(1)
  })

  it('bounds unknown recovery and expires without resubmitting Arena', async () => {
    const unknownDecision = {
      ...DECISION,
      executionPhase: 'unknown' as const,
      terminalOutcome: null,
      receiptSummary: {},
    }
    listDecisionsMock.mockResolvedValue([unknownDecision])
    findLifecycleMock.mockResolvedValue({
      ...LIFECYCLE,
      lifecycleState: 'partial',
      attributionQuality: 'partial',
    })
    getFillsMock.mockResolvedValue([])
    getStateMock.mockResolvedValue({ assetPositions: [] })
    recordUnknownCheckMock.mockResolvedValue({
      decision: { ...unknownDecision, executionPhase: 'resolved', terminalOutcome: 'incomplete' },
      expired: true,
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )
    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:30:00.000Z'),
    })

    expect(recordUnknownCheckMock).toHaveBeenCalledWith({
      decisionId: unknownDecision.decisionId,
      checkedAt: '2026-07-14T08:30:00.000Z',
    })
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'incomplete',
      expectedReconciliationGeneration: LIFECYCLE.reconciliationGeneration,
      currentSnapshot: expect.objectContaining({ evidenceStatus: 'incomplete' }),
    }))
    expect(result.ambiguous).toBe(1)
  })

  it('moves a stale submitted decision to unknown before bounded expiry without resubmission', async () => {
    const submitted = {
      ...DECISION,
      executionPhase: 'submitted' as const,
      terminalOutcome: null,
      receiptSummary: {},
      recoveryDeadlineAt: '2026-07-14T08:15:00.000Z',
    }
    listDecisionsMock.mockResolvedValue([submitted])
    transitionDecisionMock.mockResolvedValue({
      ...submitted,
      executionPhase: 'unknown',
      reasonCode: 'submitted_recovery_started',
    })
    getFillsMock.mockResolvedValue([])
    getStateMock.mockResolvedValue({ assetPositions: [] })
    recordUnknownCheckMock.mockResolvedValue({
      decision: { ...submitted, executionPhase: 'resolved', terminalOutcome: 'incomplete' },
      expired: true,
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:30:00.000Z') })

    expect(transitionDecisionMock).toHaveBeenCalledWith({
      decisionId: submitted.decisionId,
      executionPhase: 'unknown',
      reasonCode: 'submitted_recovery_started',
    })
    expect(recordUnknownCheckMock).toHaveBeenCalled()
  })

  it('retries lifecycle incomplete cleanup after the decision is already terminal incomplete', async () => {
    const incomplete = {
      ...DECISION,
      executionPhase: 'resolved' as const,
      terminalOutcome: 'incomplete' as const,
      reasonCode: 'execution_evidence_window_expired',
      receiptSummary: {},
    }
    listDecisionsMock.mockResolvedValue([incomplete])
    findLifecycleMock.mockResolvedValue({
      ...LIFECYCLE,
      lifecycleState: 'partial',
      attributionQuality: 'partial',
    })
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:30:00.000Z') })

    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'incomplete',
      expectedReconciliationGeneration: LIFECYCLE.reconciliationGeneration,
    }))
    expect(getFillsMock).not.toHaveBeenCalled()
    expect(getStateMock).not.toHaveBeenCalled()
  })

  it('does not attribute an existing wallet position from state alone without receipt or fill proof', async () => {
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'partial',
      currentSnapshot: {
        dataAsOf: '2026-07-14T08:00:00.000Z',
        evidenceStatus: 'partial',
      },
    }))
    expect(transitionLifecycleMock.mock.calls[0][0].currentSnapshot).not.toHaveProperty(
      'unrealizedPnlUsd',
    )
  })

  it('closes once on flat-position plus closing-fill evidence and stores only lifecycle PnL', async () => {
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    getStateMock.mockResolvedValue({ assetPositions: [] })
    getFillsMock.mockResolvedValue([{
      fillId: 'close-1',
      coin: 'BTC',
      time: Date.parse('2026-07-14T07:59:00.000Z'),
      px: 98_000,
      sz: 0.001,
      dir: 'Close Short',
      side: 'short',
      startPosition: -0.001,
      closedPnl: 2,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.closed).toBe(1)
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'closed',
      closedAt: '2026-07-14T07:59:00.000Z',
      realizedResult: {
        dataAsOf: '2026-07-14T08:00:00.000Z',
        realizedPnlUsd: 2,
        feesUsd: 0.02,
        netRealizedPnlUsd: 1.98,
      },
    }))
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: 'hyperliquid:close:close-1',
      decisionId: null,
      eventType: 'close',
    }))
    expect(transitionDecisionMock).not.toHaveBeenCalledWith(expect.objectContaining({
      receiptSummary: expect.objectContaining({ realizedPnlUsd: expect.anything() }),
    }))
  })

  it('settles a position that opened and closed between reconciliation passes', async () => {
    getStateMock.mockResolvedValue({ assetPositions: [] })
    getFillsMock.mockResolvedValue([{
      fillId: 'entry-between-passes',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }, {
      fillId: 'close-between-passes',
      coin: 'BTC',
      time: Date.parse('2026-07-12T09:00:00.000Z'),
      px: 98_000,
      sz: 0.001,
      dir: 'Close Short',
      side: 'short',
      startPosition: -0.001,
      closedPnl: 2,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result).toMatchObject({ opened: 1, closed: 1 })
    expect(transitionLifecycleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      lifecycleState: 'open',
      expectedReconciliationGeneration: 0,
    }))
    expect(transitionLifecycleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      lifecycleState: 'closed',
      expectedReconciliationGeneration: 1,
      closedAt: '2026-07-12T09:00:00.000Z',
    }))
  })

  it('keeps trim influence separate while realized and unrealized PnL stay lifecycle-level', async () => {
    const trimDecision = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      requestedParameters: {
        action: 'trim',
        pair: 'BTC',
        side: 'short',
        sizeUsd: 50,
      },
      receiptSummary: {
        fill: { totalSz: 0.0005, avgPx: 100_000 },
      },
      submittedAt: '2026-07-14T07:59:00.000Z',
      resolvedAt: '2026-07-14T07:59:01.000Z',
      updatedAt: '2026-07-14T07:59:01.000Z',
    }
    listDecisionsMock.mockResolvedValue([trimDecision])
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    getFillsMock.mockResolvedValue([{
      fillId: 'trim-1',
      coin: 'BTC',
      time: Date.parse(trimDecision.submittedAt),
      px: 100_000,
      sz: 0.0005,
      dir: 'Close Short',
      side: 'short',
      startPosition: -0.001,
      closedPnl: 1.5,
      fee: 0.01,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: trimDecision.decisionId,
      eventType: 'trim',
      eventPayload: expect.not.objectContaining({ realizedPnlUsd: expect.anything() }),
    }))
    expect(transitionLifecycleMock).toHaveBeenCalledWith(expect.objectContaining({
      lifecycleState: 'open',
      currentSnapshot: expect.objectContaining({ unrealizedPnlUsd: 7 }),
      realizedResult: {
        dataAsOf: '2026-07-14T08:00:00.000Z',
        realizedPnlUsd: 1.5,
        feesUsd: 0.01,
        netRealizedPnlUsd: 1.49,
      },
    }))
  })

  it('derives exact U2 add and trim lifecycle shapes from positionAction and existingSide', async () => {
    const add = {
      ...DECISION,
      requestedParameters: {
        action: 'open',
        positionAction: 'add',
        existingSide: 'short',
        pair: 'BTC',
        side: 'short',
        sizeUsd: 100,
      },
    }
    const trim = {
      ...DECISION,
      decisionId: '44444444-4444-4444-8444-444444444444',
      requestedParameters: {
        action: 'close',
        positionAction: 'trim',
        existingSide: 'long',
        pair: 'BTC',
        sizeUsd: 100,
      },
    }
    listDecisionsMock.mockResolvedValue([add, trim])
    findLifecycleMock
      .mockResolvedValueOnce(LIFECYCLE)
      .mockResolvedValueOnce({ ...LIFECYCLE, side: 'long' })
    getFillsMock.mockResolvedValue([{
      fillId: 'add-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: -0.001,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }, {
      fillId: 'trim-fill',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Close Long',
      side: 'long',
      startPosition: 0.001,
      closedPnl: 1,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'
    )
    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })

    expect(findLifecycleMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ side: 'short' }))
    expect(findLifecycleMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ side: 'long' }))
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: add.decisionId,
      eventType: 'add',
    }))
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: trim.decisionId,
      eventType: 'trim',
    }))
  })

  it('replays idempotently with stable event keys, no confirmed downgrade, and monotonic generation', async () => {
    listDecisionsMock.mockResolvedValue([{ ...DECISION, receiptSummary: {} }])
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    getFillsMock.mockResolvedValue([{
      fillId: 'entry-1',
      coin: 'BTC',
      time: Date.parse(DECISION.submittedAt),
      px: 100_000,
      sz: 0.001,
      dir: 'Open Short',
      side: 'short',
      startPosition: 0,
      closedPnl: 0,
      fee: 0.02,
      leverage: 3,
    }])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:00:00.000Z') })
    await reconcileInverseOpinionTrades({ now: new Date('2026-07-14T08:01:00.000Z') })

    expect(appendEventMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventKey: 'hyperliquid:fill:entry-1',
    }))
    expect(appendEventMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventKey: 'hyperliquid:fill:entry-1',
    }))
    expect(transitionLifecycleMock.mock.calls.every(
      ([arg]) => arg.expectedReconciliationGeneration >= 4,
    )).toBe(true)
    expect(openLifecycleMock).not.toHaveBeenCalled()
    expect(transitionDecisionMock).not.toHaveBeenCalled()
  })

  it('preserves the prior snapshot and data_as_of when Hyperliquid times out', async () => {
    findLifecycleMock.mockResolvedValue(LIFECYCLE)
    getFillsMock.mockResolvedValue(null)
    getStateMock.mockResolvedValue(null)
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.stale).toBe(1)
    expect(transitionLifecycleMock).not.toHaveBeenCalled()
    expect(LIFECYCLE.currentSnapshot).toEqual({
      dataAsOf: '2026-07-13T08:00:00.000Z',
      unrealizedPnlUsd: 4,
    })
  })

  it('never scans historical fills when no durable decision row exists', async () => {
    listDecisionsMock.mockResolvedValue([])
    const { reconcileInverseOpinionTrades } = await import('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js')

    const result = await reconcileInverseOpinionTrades({
      now: new Date('2026-07-14T08:00:00.000Z'),
    })

    expect(result.scanned).toBe(0)
    expect(getFillsMock).not.toHaveBeenCalled()
    expect(getStateMock).not.toHaveBeenCalled()
    expect(openLifecycleMock).not.toHaveBeenCalled()
  })
})
