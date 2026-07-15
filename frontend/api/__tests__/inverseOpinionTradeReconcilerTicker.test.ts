import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InverseOpinionTradeReconciliationResult } from '../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js'

const reconcileMock = vi.fn()
const deliveryMock = vi.fn()
const loggerInfoMock = vi.fn()

vi.mock('../../server/_lib/alfaclub/inverseOpinionTradeReconciler.js', () => ({
  reconcileInverseOpinionTrades: reconcileMock,
}))

vi.mock('../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js', () => ({
  sweepInverseOpinionTerminalReplyDeliveries: deliveryMock,
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
  },
}))

describe('startInverseOpinionTradeReconcilerTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
    delete process.env.RAILWAY_SERVICE_ID
    reconcileMock.mockResolvedValue({
      scanned: 3,
      opened: 1,
      refreshed: 1,
      closed: 0,
      ambiguous: 1,
      stale: 0,
      errors: 0,
    })
    deliveryMock.mockResolvedValue({
      created: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      sendUnknown: 0,
      errors: 0,
      degraded: false,
      errorCode: null,
      backlog: {
        pending: 0,
        sending: 0,
        failed: 0,
        sendUnknown: 0,
        lastSuccessAt: '2026-07-14T22:00:00.000Z',
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
    delete process.env.RAILWAY_SERVICE_ID
  })

  it('stays disabled unless capture is explicitly enabled on Railway Hermit', async () => {
    const { startInverseOpinionTradeReconcilerTicker } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconcilerTicker.js'
    )

    const disabled = startInverseOpinionTradeReconcilerTicker()
    expect(disabled.started).toBe(false)
    expect(disabled.reason).toBe('disabled')

    process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED = 'true'
    const notRailway = startInverseOpinionTradeReconcilerTicker()
    expect(notRailway.started).toBe(false)
    expect(notRailway.reason).toBe('not_railway')
    expect(reconcileMock).not.toHaveBeenCalled()
  })

  it('starts one non-overlapping Railway loop and exposes redacted freshness counts', async () => {
    process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED = 'true'
    process.env.RAILWAY_SERVICE_ID = 'service-hermit'
    let resolveRun: (value: InverseOpinionTradeReconciliationResult) => void = () => {}
    reconcileMock.mockImplementationOnce(() => new Promise<InverseOpinionTradeReconciliationResult>((resolve) => {
      resolveRun = resolve
    }))
    const { startInverseOpinionTradeReconcilerTicker } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconcilerTicker.js'
    )

    const handle = startInverseOpinionTradeReconcilerTicker({ intervalMs: 60_000 })
    expect(handle.started).toBe(true)
    await vi.runAllTicks()
    expect(reconcileMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(reconcileMock).toHaveBeenCalledTimes(1)

    resolveRun({
      scanned: 3,
      opened: 1,
      refreshed: 1,
      closed: 0,
      ambiguous: 1,
      stale: 0,
      errors: 0,
    })
    await vi.runAllTicks()

    const state = handle.readState()
    expect(state).toMatchObject({
      started: true,
      ticks: 1,
      lastSuccessAt: expect.any(String),
      counts: {
        scanned: 3,
        opened: 1,
        refreshed: 1,
        closed: 0,
        ambiguous: 1,
        stale: 0,
        errors: 0,
      },
      lastError: null,
      replyDelivery: {
        created: 1,
        sent: 1,
        backlog: {
          pending: 0,
          sendUnknown: 0,
          lastSuccessAt: '2026-07-14T22:00:00.000Z',
        },
      },
    })
    expect(JSON.stringify(state)).not.toContain(DECISION_WALLET_SENTINEL)
    handle.stop()
  })

  it('stops future ticks cleanly', async () => {
    const { startInverseOpinionTradeReconcilerTicker } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconcilerTicker.js'
    )
    const handle = startInverseOpinionTradeReconcilerTicker({
      force: true,
      intervalMs: 60_000,
    })
    await vi.runAllTicks()
    await vi.runAllTicks()
    expect(reconcileMock).toHaveBeenCalledTimes(1)

    handle.stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(reconcileMock).toHaveBeenCalledTimes(1)
  })

  it('reports an all-error tick as failed without advancing lastSuccessAt', async () => {
    reconcileMock.mockResolvedValueOnce({
      scanned: 2,
      opened: 0,
      refreshed: 0,
      closed: 0,
      ambiguous: 0,
      stale: 0,
      errors: 2,
    })
    const { startInverseOpinionTradeReconcilerTicker } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconcilerTicker.js'
    )
    const handle = startInverseOpinionTradeReconcilerTicker({
      force: true,
      intervalMs: 60_000,
    })
    await vi.runAllTicks()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(handle.readState()).toMatchObject({
      lastSuccessAt: null,
      lastError: 'reconciliation_failed',
      counts: { scanned: 2, errors: 2 },
    })
    handle.stop()
  })

  it.each([
    { errors: 1, failed: 0, sendUnknown: 0 },
    { errors: 0, failed: 1, sendUnknown: 0 },
    { errors: 0, failed: 0, sendUnknown: 1 },
  ])('does not advance success or clear error for a degraded delivery run %#', async (deliveryState) => {
    const { startInverseOpinionTradeReconcilerTicker } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeReconcilerTicker.js'
    )
    const handle = startInverseOpinionTradeReconcilerTicker({
      force: true,
      intervalMs: 60_000,
    })
    await handle.runNow()
    const priorSuccess = handle.readState().lastSuccessAt
    expect(priorSuccess).toEqual(expect.any(String))

    deliveryMock.mockResolvedValueOnce({
      created: 0,
      claimed: 0,
      sent: 0,
      failed: deliveryState.failed,
      sendUnknown: deliveryState.sendUnknown,
      errors: deliveryState.errors,
      degraded: true,
      errorCode: deliveryState.errors ? 'alfaclub_bot_token_missing' : null,
      backlog: {
        pending: 0,
        sending: 0,
        failed: deliveryState.failed,
        sendUnknown: deliveryState.sendUnknown,
        lastSuccessAt: priorSuccess,
      },
    })
    await handle.runNow()

    expect(handle.readState()).toMatchObject({
      lastSuccessAt: priorSuccess,
      lastError: 'reply_delivery_failed',
      replyDelivery: {
        errors: deliveryState.errors,
        backlog: {
          failed: deliveryState.failed,
          sendUnknown: deliveryState.sendUnknown,
        },
      },
    })
    handle.stop()
  })
})

const DECISION_WALLET_SENTINEL = '0xcccccccccccccccccccccccccccccccccccccccc'
