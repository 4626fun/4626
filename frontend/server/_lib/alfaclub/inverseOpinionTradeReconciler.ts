import { createHash } from 'node:crypto'

import {
  getClearinghouseState,
  getUserFillsByTimeDetailed,
  type HyperliquidClearinghouseState,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'
import { classifyCounterTradeFillAction } from './counterTradeEngine.js'
import {
  appendPositionLifecycleEvent,
  claimOpinionFillIdentities,
  findOpenPositionLifecycle,
  listOpinionDecisionsForReconciliation,
  openPositionLifecycle,
  recordUnknownReconciliationCheck,
  reserveOpinionFillIdentities,
  transitionOpinionDecision,
  transitionPositionLifecycle,
  type OpinionTradeDecision,
  type PositionLifecycle,
  type PositionLifecycleEventType,
} from './inverseOpinionTradeStore.js'

const ATTEMPT_EARLY_TOLERANCE_MS = 30_000
const ATTEMPT_LATE_TOLERANCE_MS = 5 * 60_000
const FILL_SIZE_RELATIVE_TOLERANCE = 0.25
const FILL_SIZE_ABSOLUTE_TOLERANCE_USD = 5
const RECEIPT_SIZE_RELATIVE_TOLERANCE = 0.01
const RECEIPT_PRICE_RELATIVE_TOLERANCE = 0.005
const MAX_RECEIPT_GROUPING_FILLS = 8

export type InverseOpinionTradeReconciliationResult = {
  scanned: number
  opened: number
  refreshed: number
  closed: number
  ambiguous: number
  stale: number
  errors: number
}

type ReceiptFill = {
  size: number
  price: number
}

type ExecutorReconciliationSnapshot = Readonly<{
  fills: HyperliquidUserFillDetailed[] | null
  clearinghouse: HyperliquidClearinghouseState | null
}>

function normalizedCoin(value: unknown): string {
  return String(value ?? '').trim().replace(/\./g, ':').toUpperCase()
}

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function receiptFill(decision: OpinionTradeDecision): ReceiptFill | null {
  const raw = decision.receiptSummary.fill
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const fill = raw as Record<string, unknown>
  const size = finitePositive(fill.totalSz ?? fill.size ?? fill.sz)
  const price = finitePositive(fill.avgPx ?? fill.price ?? fill.px)
  return size != null && price != null ? { size, price } : null
}

function requestedAction(decision: OpinionTradeDecision): string {
  const lifecycleAction = String(decision.requestedParameters.positionAction ?? '').trim().toLowerCase()
  return lifecycleAction || String(decision.requestedParameters.action ?? 'open').trim().toLowerCase()
}

function lifecycleSide(decision: OpinionTradeDecision): 'long' | 'short' {
  const existingSide = String(decision.requestedParameters.existingSide ?? '').trim().toLowerCase()
  return requestedAction(decision) === 'trim' && (existingSide === 'long' || existingSide === 'short')
    ? existingSide
    : decision.inverseSide
}

function requestedCoin(decision: OpinionTradeDecision): string {
  return normalizedCoin(decision.requestedParameters.pair ?? decision.normalizedMarket)
}

function requestedNotional(decision: OpinionTradeDecision): number | null {
  return finitePositive(
    decision.requestedParameters.sizeUsd
      ?? decision.requestedParameters.notionalUsd
      ?? decision.requestedParameters.amountUsd,
  )
}

function actionMatches(decision: OpinionTradeDecision, fill: HyperliquidUserFillDetailed): boolean {
  const requested = requestedAction(decision)
  const observed = classifyCounterTradeFillAction(fill)
  if (requested === 'open' || requested === 'entry') return observed === 'entry'
  if (requested === 'add') return observed === 'add'
  if (requested === 'trim' || requested === 'reduce') {
    return observed === 'reduce' || observed === 'close'
  }
  if (requested === 'close' || requested === 'exit') return observed === 'close'
  return false
}

function receiptActionMatches(
  decision: OpinionTradeDecision,
  fill: HyperliquidUserFillDetailed,
): boolean {
  const requested = requestedAction(decision)
  const observed = classifyCounterTradeFillAction(fill)
  if (requested === 'open' || requested === 'entry') {
    return observed === 'entry' || observed === 'add'
  }
  if (requested === 'close' || requested === 'exit') {
    return observed === 'reduce' || observed === 'close'
  }
  return actionMatches(decision, fill)
}

function sizeMatches(decision: OpinionTradeDecision, fill: HyperliquidUserFillDetailed): boolean {
  const expected = requestedNotional(decision)
  if (expected == null) return true
  if (fill.px == null || fill.sz == null) return false
  const actual = Math.abs(fill.px * fill.sz)
  if (!Number.isFinite(actual)) return false
  return Math.abs(actual - expected)
    <= Math.max(FILL_SIZE_ABSOLUTE_TOLERANCE_USD, expected * FILL_SIZE_RELATIVE_TOLERANCE)
}

function plausibleFills(
  decision: OpinionTradeDecision,
  fills: HyperliquidUserFillDetailed[],
): HyperliquidUserFillDetailed[] {
  return structurallyPlausibleFills(decision, fills).filter((fill) => sizeMatches(decision, fill))
}

function structurallyPlausibleFills(
  decision: OpinionTradeDecision,
  fills: HyperliquidUserFillDetailed[],
  receiptBacked = false,
): HyperliquidUserFillDetailed[] {
  const attemptMs = Date.parse(decision.submittedAt ?? decision.updatedAt ?? decision.observedAt)
  if (!Number.isFinite(attemptMs)) return []
  const coin = requestedCoin(decision)
  return fills.filter((fill) => {
    if (normalizedCoin(fill.coin) !== coin) return false
    if (
      fill.time < attemptMs - ATTEMPT_EARLY_TOLERANCE_MS
      || fill.time > attemptMs + ATTEMPT_LATE_TOLERANCE_MS
    ) return false
    if (!(receiptBacked ? receiptActionMatches(decision, fill) : actionMatches(decision, fill))) {
      return false
    }
    return fill.sz != null && fill.px != null
  })
}

type ReceiptFillMatch = {
  fills: HyperliquidUserFillDetailed[]
  orderId: string | null
}

function aggregateMatchesReceipt(fills: HyperliquidUserFillDetailed[], receipt: ReceiptFill): boolean {
  const size = fills.reduce((sum, fill) => sum + Math.abs(fill.sz ?? 0), 0)
  if (!(size > 0)) return false
  const volume = fills.reduce(
    (sum, fill) => sum + Math.abs(fill.sz ?? 0) * (fill.px ?? 0),
    0,
  )
  const price = volume / size
  return (
    Math.abs(size - receipt.size)
      <= Math.max(Number.EPSILON, receipt.size * RECEIPT_SIZE_RELATIVE_TOLERANCE)
    && Math.abs(price - receipt.price)
      <= Math.max(Number.EPSILON, receipt.price * RECEIPT_PRICE_RELATIVE_TOLERANCE)
  )
}

function receiptCorrelatedFills(
  decision: OpinionTradeDecision,
  receipt: ReceiptFill,
  fills: HyperliquidUserFillDetailed[],
): ReceiptFillMatch[] {
  const plausible = structurallyPlausibleFills(decision, fills, true)
  const byOrder = new Map<string, HyperliquidUserFillDetailed[]>()
  const withoutOrder: HyperliquidUserFillDetailed[] = []
  for (const fill of plausible) {
    const orderId = String(fill.orderId ?? '').trim()
    if (!orderId) {
      withoutOrder.push(fill)
      continue
    }
    const group = byOrder.get(orderId) ?? []
    group.push(fill)
    byOrder.set(orderId, group)
  }
  const matches: ReceiptFillMatch[] = [...byOrder.entries()]
    .filter(([, group]) => aggregateMatchesReceipt(group, receipt))
    .map(([orderId, group]) => ({ fills: group, orderId }))

  if (withoutOrder.length <= MAX_RECEIPT_GROUPING_FILLS) {
    const combinations = 1 << withoutOrder.length
    for (let mask = 1; mask < combinations; mask += 1) {
      const group = withoutOrder.filter((_, index) => (mask & (1 << index)) !== 0)
      if (aggregateMatchesReceipt(group, receipt)) {
        matches.push({ fills: group, orderId: null })
      }
    }
  }
  return matches
}

function fillIdentity(fill: HyperliquidUserFillDetailed): string {
  const explicit = String(fill.fillId ?? '').trim()
  if (explicit) return explicit.slice(0, 96)
  return createHash('sha256')
    .update([
      fill.time,
      fill.coin ?? '',
      fill.px ?? '',
      fill.sz ?? '',
      fill.dir ?? '',
      fill.startPosition ?? '',
    ].join('|'))
    .digest('hex')
    .slice(0, 32)
}

function receiptPriority(decision: OpinionTradeDecision): number {
  return receiptFill(decision) ? 0 : 1
}

function reconciliationOrder(
  left: OpinionTradeDecision,
  right: OpinionTradeDecision,
): number {
  const priority = receiptPriority(left) - receiptPriority(right)
  if (priority !== 0) return priority
  const leftTime = Date.parse(left.submittedAt ?? left.observedAt)
  const rightTime = Date.parse(right.submittedAt ?? right.observedAt)
  if (leftTime !== rightTime) return leftTime - rightTime
  return left.decisionId.localeCompare(right.decisionId)
}

function positionForLifecycle(
  state: HyperliquidClearinghouseState,
  lifecycle: Pick<PositionLifecycle, 'normalizedMarket' | 'side'>,
) {
  const coin = normalizedCoin(lifecycle.normalizedMarket)
  return (state.assetPositions ?? []).find((position) => (
    normalizedCoin(position.coin) === coin
    && position.side === lifecycle.side
    && position.positionValue != null
    && position.positionValue > 0
  )) ?? null
}

function lifecycleSnapshot(
  lifecycle: Pick<PositionLifecycle, 'normalizedMarket' | 'side'>,
  state: HyperliquidClearinghouseState,
  dataAsOf: string,
): Record<string, unknown> | null {
  const position = positionForLifecycle(state, lifecycle)
  if (!position) return null
  return {
    dataAsOf,
    evidenceStatus: 'confirmed',
    market: lifecycle.normalizedMarket,
    side: lifecycle.side,
    entryPrice: position.entryPx,
    positionValueUsd: position.positionValue,
    unrealizedPnlUsd: position.unrealizedPnl,
    liquidationPrice: position.liquidationPx,
    leverage: position.leverage,
  }
}

function eventTypeForDecision(decision: OpinionTradeDecision): PositionLifecycleEventType {
  const action = requestedAction(decision)
  if (action === 'add') return 'add'
  if (action === 'trim' || action === 'reduce') return 'trim'
  if (action === 'close' || action === 'exit') return 'close'
  return 'open'
}

function closingFills(
  lifecycle: PositionLifecycle,
  fills: HyperliquidUserFillDetailed[],
): HyperliquidUserFillDetailed[] {
  const coin = normalizedCoin(lifecycle.normalizedMarket)
  const openedAtMs = Date.parse(lifecycle.openedAt)
  return fills.filter((fill) => {
    if (normalizedCoin(fill.coin) !== coin || fill.time < openedAtMs) return false
    const action = classifyCounterTradeFillAction(fill)
    return (
      action === 'reduce'
      || action === 'close'
      || action === 'liquidated'
      || Math.abs(fill.closedPnl) > Number.EPSILON
    )
  })
}

function emptyResult(): InverseOpinionTradeReconciliationResult {
  return {
    scanned: 0,
    opened: 0,
    refreshed: 0,
    closed: 0,
    ambiguous: 0,
    stale: 0,
    errors: 0,
  }
}

async function markUnknownLifecycleIncomplete(
  lifecycle: PositionLifecycle | null,
  checkedAt: string,
): Promise<void> {
  if (
    !lifecycle
    || !['pending', 'partial', 'ambiguous'].includes(lifecycle.lifecycleState)
  ) return
  await transitionPositionLifecycle({
    lifecycleId: lifecycle.lifecycleId,
    lifecycleState: 'incomplete',
    attributionQuality: 'partial',
    expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
    currentSnapshot: {
      dataAsOf: checkedAt,
      evidenceStatus: 'incomplete',
      reasonCode: 'execution_evidence_window_expired',
    },
    reconciledAt: checkedAt,
    closedAt: null,
  })
}

async function reconcileDecision(
  initialDecision: OpinionTradeDecision,
  now: Date,
  result: InverseOpinionTradeReconciliationResult,
  batchSnapshot: ExecutorReconciliationSnapshot,
): Promise<void> {
  let decision = initialDecision
  if (!decision.executorWallet) {
    result.errors += 1
    return
  }
  const executorWallet = decision.executorWallet

  let lifecycle = await findOpenPositionLifecycle({
    executorWallet,
    normalizedMarket: decision.normalizedMarket,
    side: lifecycleSide(decision),
  })
  if (decision.terminalOutcome === 'incomplete') {
    await markUnknownLifecycleIncomplete(lifecycle, now.toISOString())
    result.ambiguous += 1
    return
  }
  if (decision.executionPhase === 'submitted') {
    decision = await transitionOpinionDecision({
      decisionId: decision.decisionId,
      executionPhase: 'unknown',
      reasonCode: 'submitted_recovery_started',
    })
  }
  const { fills, clearinghouse } = batchSnapshot
  const immediateFill = receiptFill(decision)
  if (fills == null && clearinghouse == null && !immediateFill) {
    if (decision.executionPhase === 'unknown') {
      const check = await recordUnknownReconciliationCheck({
        decisionId: decision.decisionId,
        checkedAt: now.toISOString(),
      })
      if (check.expired) {
        await markUnknownLifecycleIncomplete(lifecycle, now.toISOString())
        result.ambiguous += 1
        return
      }
    }
    result.stale += 1
    return
  }

  const receiptMatches = immediateFill
    ? fills == null
      ? []
      : receiptCorrelatedFills(decision, immediateFill, fills)
    : []
  const candidates = immediateFill ? [] : plausibleFills(decision, fills ?? [])
  const candidateCount = immediateFill ? receiptMatches.length : candidates.length
  if (candidateCount > 1) {
    if (immediateFill) {
      const fillIdentities = [...new Set(
        receiptMatches.flatMap((match) => match.fills.map(fillIdentity)),
      )]
      await reserveOpinionFillIdentities({
        decisionId: decision.decisionId,
        executorWallet,
        fillIdentities,
      })
    }
    if (!lifecycle) {
      await openPositionLifecycle({
        openingDecisionId: decision.decisionId,
        executorWallet,
        normalizedMarket: decision.normalizedMarket,
        side: lifecycleSide(decision),
        lifecycleState: 'ambiguous',
        attributionQuality: 'partial',
        openedAt: decision.resolvedAt ?? decision.updatedAt,
        currentSnapshot: {
          dataAsOf: now.toISOString(),
          evidenceStatus: 'ambiguous',
          candidateCount,
        },
      })
    } else {
      await appendPositionLifecycleEvent({
        lifecycleId: lifecycle.lifecycleId,
        decisionId: decision.decisionId,
        eventKey: `decision:ambiguous:${decision.decisionId}`,
        eventType: 'reconcile',
        evidenceLayer: 'observed',
        eventPayload: {
          evidenceStatus: 'ambiguous',
          candidateCount,
        },
        occurredAt: decision.resolvedAt ?? decision.updatedAt,
      })
    }
    result.ambiguous += 1
    return
  }

  const matched = immediateFill
    ? receiptMatches.length === 1 ? receiptMatches[0] : null
    : candidates.length === 1 ? { fills: [candidates[0]!], orderId: null } : null
  const matchedFill = matched?.fills[0] ?? null
  if (matched) {
    const fillClaimed = await claimOpinionFillIdentities({
      decisionId: decision.decisionId,
      executorWallet,
      fillIdentities: matched.fills.map(fillIdentity),
    })
    if (!fillClaimed) {
      if (!lifecycle) {
        await openPositionLifecycle({
          openingDecisionId: decision.decisionId,
          executorWallet,
          normalizedMarket: decision.normalizedMarket,
          side: lifecycleSide(decision),
          lifecycleState: 'ambiguous',
          attributionQuality: 'partial',
          openedAt: decision.resolvedAt ?? decision.updatedAt,
          currentSnapshot: {
            dataAsOf: now.toISOString(),
            evidenceStatus: 'fill_already_claimed',
          },
        })
      } else {
        await appendPositionLifecycleEvent({
          lifecycleId: lifecycle.lifecycleId,
          decisionId: decision.decisionId,
          eventKey: `decision:fill-conflict:${decision.decisionId}`,
          eventType: 'reconcile',
          evidenceLayer: 'observed',
          eventPayload: { evidenceStatus: 'fill_already_claimed' },
          occurredAt: decision.resolvedAt ?? decision.updatedAt,
        })
      }
      result.ambiguous += 1
      return
    }
  }
  const hasExecutionEvidence = matched != null
  if (decision.executionPhase === 'unknown' && !hasExecutionEvidence) {
    const check = await recordUnknownReconciliationCheck({
      decisionId: decision.decisionId,
      checkedAt: now.toISOString(),
    })
    if (check.expired) {
      await markUnknownLifecycleIncomplete(lifecycle, now.toISOString())
      result.ambiguous += 1
    }
    else result.stale += 1
    return
  }
  if (!lifecycle) {
    lifecycle = await openPositionLifecycle({
      openingDecisionId: decision.decisionId,
      executorWallet,
      normalizedMarket: decision.normalizedMarket,
      side: lifecycleSide(decision),
      lifecycleState: immediateFill && !matchedFill ? 'partial' : 'pending',
      attributionQuality: hasExecutionEvidence ? decision.attributionQuality : 'partial',
      openedAt: decision.resolvedAt ?? decision.updatedAt,
      currentSnapshot: hasExecutionEvidence
        ? {}
        : {
            dataAsOf: now.toISOString(),
            evidenceStatus: immediateFill ? 'receipt_only' : 'partial',
          },
    })
    result.opened += 1
  }

  if (matched && matchedFill) {
    const evidenceSource = immediateFill ? 'arena_receipt_correlated_fill' : 'hyperliquid_fill'
    const fillIds = matched.fills.map(fillIdentity)
    const eventIdentity = fillIds.length === 1
      ? fillIds[0]
      : createHash('sha256').update(fillIds.join('|')).digest('hex').slice(0, 32)
    const eventKey = `hyperliquid:fill:${eventIdentity}`
    const fill = immediateFill
      ? {
          size: immediateFill.size,
          price: immediateFill.price,
          fillId: fillIds[0],
          fillIds,
          orderId: matched.orderId,
        }
      : { size: matchedFill.sz, price: matchedFill.px, fillId: fillIdentity(matchedFill) }
    await appendPositionLifecycleEvent({
      lifecycleId: lifecycle.lifecycleId,
      decisionId: decision.decisionId,
      eventKey,
      eventType: eventTypeForDecision(decision),
      evidenceLayer: 'observed',
      eventPayload: { evidenceSource, fill },
      occurredAt: new Date(matchedFill.time).toISOString(),
    })
    if (decision.executionPhase === 'unknown') {
      const side = lifecycleSide(decision)
      await transitionOpinionDecision({
        decisionId: decision.decisionId,
        executionPhase: 'resolved',
        terminalOutcome: 'executed',
        reasonCode: 'hyperliquid_execution_confirmed',
        receiptSummary: {
          ...decision.receiptSummary,
          terminalReply: {
            replyText:
              `inverse ${side.toUpperCase()} ${decision.normalizedMarket} execution confirmed on Hyperliquid.`,
            threadReceiptText:
              `🧾 receipt: ${side.toUpperCase()} ${decision.normalizedMarket} · filled ${fill.size} @ $${fill.price}`,
          },
        },
      })
    }
  }

  if (!clearinghouse) {
    result.stale += 1
    return
  }
  if (
    !hasExecutionEvidence
    && (lifecycle.lifecycleState === 'pending' || lifecycle.lifecycleState === 'partial')
  ) {
    if (lifecycle.lifecycleState === 'pending') {
      const dataAsOf = now.toISOString()
      await transitionPositionLifecycle({
        lifecycleId: lifecycle.lifecycleId,
        lifecycleState: 'partial',
        expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
        currentSnapshot: {
          dataAsOf,
          evidenceStatus: 'partial',
        },
        reconciledAt: dataAsOf,
        closedAt: null,
      })
    }
    return
  }
  if (lifecycle.lifecycleState === 'ambiguous' || lifecycle.lifecycleState === 'incomplete') {
    result.ambiguous += 1
    return
  }

  const dataAsOf = now.toISOString()
  const snapshot = lifecycleSnapshot(lifecycle, clearinghouse, dataAsOf)
  const closes = fills == null ? [] : closingFills(lifecycle, fills)
  if (
    !snapshot
    && closes.length > 0
    && hasExecutionEvidence
    && (lifecycle.lifecycleState === 'pending' || lifecycle.lifecycleState === 'partial')
  ) {
    lifecycle = await transitionPositionLifecycle({
      lifecycleId: lifecycle.lifecycleId,
      lifecycleState: 'open',
      attributionQuality: decision.attributionQuality,
      expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
      currentSnapshot: {
        dataAsOf,
        evidenceStatus: 'confirmed_execution',
        market: lifecycle.normalizedMarket,
        side: lifecycle.side,
      },
      reconciledAt: dataAsOf,
      closedAt: null,
    })
  }
  if (!snapshot && lifecycle.lifecycleState === 'open' && closes.length > 0) {
    const latestClose = closes.reduce((latest, fill) => fill.time > latest.time ? fill : latest)
    const realizedPnlUsd = closes.reduce((sum, fill) => sum + fill.closedPnl, 0)
    const feesUsd = closes.reduce((sum, fill) => sum + fill.fee, 0)
    await appendPositionLifecycleEvent({
      lifecycleId: lifecycle.lifecycleId,
      decisionId: null,
      eventKey: `hyperliquid:close:${fillIdentity(latestClose)}`,
      eventType: 'close',
      evidenceLayer: 'observed',
      eventPayload: {
        evidenceSource: 'hyperliquid_fill_and_flat_position',
        fillId: fillIdentity(latestClose),
      },
      occurredAt: new Date(latestClose.time).toISOString(),
    })
    await transitionPositionLifecycle({
      lifecycleId: lifecycle.lifecycleId,
      lifecycleState: 'closed',
      expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
      currentSnapshot: {
        dataAsOf,
        evidenceStatus: 'confirmed_flat',
        market: lifecycle.normalizedMarket,
        side: lifecycle.side,
      },
      realizedResult: {
        dataAsOf,
        realizedPnlUsd,
        feesUsd,
        netRealizedPnlUsd: realizedPnlUsd - feesUsd,
      },
      reconciledAt: dataAsOf,
      closedAt: new Date(latestClose.time).toISOString(),
    })
    result.closed += 1
    return
  }

  if (snapshot) {
    const realizedPnlUsd = closes.reduce((sum, fill) => sum + fill.closedPnl, 0)
    const feesUsd = closes.reduce((sum, fill) => sum + fill.fee, 0)
    await transitionPositionLifecycle({
      lifecycleId: lifecycle.lifecycleId,
      lifecycleState: 'open',
      attributionQuality: hasExecutionEvidence
        ? decision.attributionQuality
        : undefined,
      expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
      currentSnapshot: snapshot,
      ...(closes.length > 0
        ? { realizedResult: {
            dataAsOf,
            realizedPnlUsd,
            feesUsd,
            netRealizedPnlUsd: realizedPnlUsd - feesUsd,
          } }
        : {}),
      reconciledAt: dataAsOf,
      closedAt: null,
    })
    result.refreshed += 1
    return
  }

  if (lifecycle.lifecycleState === 'pending') {
    await transitionPositionLifecycle({
      lifecycleId: lifecycle.lifecycleId,
      lifecycleState: 'partial',
      expectedReconciliationGeneration: lifecycle.reconciliationGeneration,
      currentSnapshot: {
        dataAsOf,
        evidenceStatus: 'partial',
      },
      reconciledAt: dataAsOf,
      closedAt: null,
    })
  }
}

export async function reconcileInverseOpinionTrades(params?: {
  now?: Date
  limit?: number
}): Promise<InverseOpinionTradeReconciliationResult> {
  const result = emptyResult()
  const now = params?.now ?? new Date()
  const decisions = (await listOpinionDecisionsForReconciliation({ limit: params?.limit }))
    .sort(reconciliationOrder)
  result.scanned = decisions.length
  const byExecutor = new Map<string, OpinionTradeDecision[]>()
  for (const decision of decisions) {
    if (!decision.executorWallet) {
      result.errors += 1
      continue
    }
    if (decision.terminalOutcome === 'incomplete') {
      try {
        await reconcileDecision(
          decision,
          now,
          result,
          Object.freeze({ fills: null, clearinghouse: null }),
        )
      } catch {
        result.errors += 1
      }
      continue
    }
    const executorWallet = decision.executorWallet.toLowerCase()
    const batch = byExecutor.get(executorWallet) ?? []
    batch.push(decision)
    byExecutor.set(executorWallet, batch)
  }
  for (const [executorWallet, batch] of byExecutor) {
    const earliestAttempt = batch.reduce((earliest, decision) => {
      const attempt = Date.parse(decision.submittedAt ?? decision.observedAt)
      return Number.isFinite(attempt) ? Math.min(earliest, attempt) : earliest
    }, Number.POSITIVE_INFINITY)
    const fetchStart = Number.isFinite(earliestAttempt)
      ? Math.max(0, earliestAttempt - ATTEMPT_EARLY_TOLERANCE_MS)
      : Math.max(0, now.getTime() - 24 * 60 * 60_000)
    let snapshot: ExecutorReconciliationSnapshot
    try {
      const [fills, clearinghouse] = await Promise.all([
        getUserFillsByTimeDetailed(executorWallet, fetchStart),
        getClearinghouseState(executorWallet),
      ])
      snapshot = Object.freeze({
        fills: fills == null ? null : Object.freeze([...fills]) as HyperliquidUserFillDetailed[],
        clearinghouse: clearinghouse == null ? null : Object.freeze({ ...clearinghouse }),
      })
    } catch {
      result.errors += batch.length
      continue
    }
    for (const decision of batch) {
      try {
        await reconcileDecision(decision, now, result, snapshot)
      } catch {
        result.errors += 1
      }
    }
  }
  return result
}
