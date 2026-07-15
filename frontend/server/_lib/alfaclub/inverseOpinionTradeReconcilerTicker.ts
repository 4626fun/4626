import { logger } from '../infra/logger.js'
import {
  reconcileInverseOpinionTrades,
  type InverseOpinionTradeReconciliationResult,
} from './inverseOpinionTradeReconciler.js'
import {
  INVERSE_OPINION_TRADE_CAPTURE_ENV,
  isInverseOpinionTradeCaptureEnabled,
} from './inverseOpinionTradeCaptureConfig.js'
import {
  sweepInverseOpinionTerminalReplyDeliveries,
  type TerminalReplyDeliveryRun,
} from './inverseOpinionTerminalReplyDelivery.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_INTERVAL_MS = 2 * 60_000
const MIN_INTERVAL_MS = 30_000

export type InverseOpinionTradeReconcilerTickerState = {
  started: boolean
  reason: 'disabled' | 'not_railway' | null
  intervalMs: number
  ticks: number
  lastTickAt: string | null
  lastSuccessAt: string | null
  counts: InverseOpinionTradeReconciliationResult | null
  replyDelivery: TerminalReplyDeliveryRun | null
  lastError:
    | 'reconciliation_failed'
    | 'reconciliation_partial_failure'
    | 'reply_delivery_failed'
    | null
}

export type InverseOpinionTradeReconcilerTickerHandle = {
  started: boolean
  reason?: 'disabled' | 'not_railway'
  stop: () => void
  runNow: () => Promise<InverseOpinionTradeReconciliationResult | null>
  readState: () => InverseOpinionTradeReconcilerTickerState
}

function isRailway(): boolean {
  return Boolean(String(process.env.RAILWAY_SERVICE_ID ?? '').trim())
}

function readIntervalMs(): number {
  const parsed = Number.parseInt(
    String(process.env.ALFACLUB_INVERSE_OPINION_RECONCILER_INTERVAL_MS ?? ''),
    10,
  )
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(MIN_INTERVAL_MS, parsed)
    : DEFAULT_INTERVAL_MS
}

export function startInverseOpinionTradeReconcilerTicker(opts?: {
  intervalMs?: number
  force?: boolean
  run?: () => Promise<InverseOpinionTradeReconciliationResult>
  deliver?: () => Promise<TerminalReplyDeliveryRun>
}): InverseOpinionTradeReconcilerTickerHandle {
  const state: InverseOpinionTradeReconcilerTickerState = {
    started: false,
    reason: null,
    intervalMs: opts?.intervalMs ?? readIntervalMs(),
    ticks: 0,
    lastTickAt: null,
    lastSuccessAt: null,
    counts: null,
    replyDelivery: null,
    lastError: null,
  }

  const disabledReason = !opts?.force && !isInverseOpinionTradeCaptureEnabled()
    ? 'disabled' as const
    : !opts?.force && !isRailway()
      ? 'not_railway' as const
      : null
  if (disabledReason) {
    state.reason = disabledReason
    logger.info('[inverse-opinion-reconciler] ticker not started', {
      reason: disabledReason,
      flag: INVERSE_OPINION_TRADE_CAPTURE_ENV,
    })
    return {
      started: false,
      reason: disabledReason,
      stop: () => {},
      runNow: async () => null,
      readState: () => ({ ...state }),
    }
  }

  const run = opts?.run ?? reconcileInverseOpinionTrades
  const deliver = opts?.deliver ?? sweepInverseOpinionTerminalReplyDeliveries
  let stopped = false
  let inFlight = false
  const tick = async (): Promise<InverseOpinionTradeReconciliationResult | null> => {
    if (stopped || inFlight) return null
    inFlight = true
    state.ticks += 1
    state.lastTickAt = new Date().toISOString()
    let deliveryFailed = false
    try {
      // Start both independent recovery passes before awaiting either.
      const deliveryPromise = deliver()
      const reconciliationPromise = run()
      try {
        const delivery = await deliveryPromise
        state.replyDelivery = {
          ...delivery,
          backlog: { ...delivery.backlog },
        }
        deliveryFailed = (
          delivery.errors > 0
          || delivery.backlog.failed > 0
          || delivery.backlog.sendUnknown > 0
        )
      } catch {
        deliveryFailed = true
      }
      if (deliveryFailed) {
        state.lastError = 'reply_delivery_failed'
      }
      const counts = await reconciliationPromise
      state.counts = { ...counts }
      if (counts.scanned > 0 && counts.errors === counts.scanned) {
        state.lastError = 'reconciliation_failed'
        logger.warn('[inverse-opinion-reconciler] tick failed', counts)
        return null
      }
      if (deliveryFailed) {
        state.lastError = 'reply_delivery_failed'
        return counts
      }
      state.lastSuccessAt = new Date().toISOString()
      state.lastError = counts.errors > 0
        ? 'reconciliation_partial_failure'
        : null
      if (counts.opened || counts.closed || counts.ambiguous || counts.stale || counts.errors) {
        logger.info('[inverse-opinion-reconciler] tick', counts)
      }
      return counts
    } catch {
      state.lastError = 'reconciliation_failed'
      return null
    } finally {
      inFlight = false
    }
  }

  queueMicrotask(() => {
    void tick()
  })
  const timer = setInterval(() => {
    void tick()
  }, state.intervalMs)
  ;(timer as { unref?: () => void }).unref?.()
  state.started = true
  logger.info('[inverse-opinion-reconciler] ticker started', {
    intervalMs: state.intervalMs,
    ownership: 'railway_hermit_single_process',
  })

  return {
    started: true,
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
    runNow: tick,
    readState: () => ({
      ...state,
      counts: state.counts ? { ...state.counts } : null,
      replyDelivery: state.replyDelivery
        ? {
            ...state.replyDelivery,
            backlog: { ...state.replyDelivery.backlog },
          }
        : null,
    }),
  }
}
