import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

import { PositionsChartSurface } from '@/components/positions/PositionsChartSurface'
import { PositionsEventInspector } from '@/components/positions/PositionsEventInspector'
import { PositionsEventLegend } from '@/components/positions/PositionsEventLegend'
import { PositionsMarketSignal } from '@/components/positions/PositionsMarketSignal'
import { PositionsRoomBook } from '@/components/positions/PositionsRoomBook'
import type { ChartOverlayEvent, TimelineResponse } from '@/components/positions/types'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/apiBase'

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ALFACLUB_ROOM_URL = 'https://alfaclub.app/rooms/1659/'
const VIRTUALS_AGENT_URL = 'https://degen.virtuals.io/agents/1213'

function tradeSourceMeta(source: 'host' | 'counter') {
  if (source === 'counter') {
    return {
      label: 'Inverse trade',
      href: VIRTUALS_AGENT_URL,
      logo: '/protocols/virtuals.svg',
      logoAlt: 'Virtuals',
      chipClass: 'bg-emerald-400/10 text-emerald-200',
      ringClass: 'bg-emerald-900/30 ring-emerald-300/25',
    }
  }
  return {
    label: 'Room trade',
    href: ALFACLUB_ROOM_URL,
    logo: '/protocols/alfaclub.svg',
    logoAlt: 'AlfaClub',
    chipClass: 'bg-sky-400/10 text-sky-200',
    ringClass: 'bg-sky-900/30 ring-sky-300/25',
  }
}

function nearestCandleClose(ts: number, candles: TimelineResponse['candles']): number | null {
  if (candles.length === 0) return null
  let best = candles[0]!
  let bestDelta = Math.abs(best.time - ts)
  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i]!
    const delta = Math.abs(candle.time - ts)
    if (delta < bestDelta) {
      best = candle
      bestDelta = delta
    }
  }
  return best.close
}

type PositionFill = { time: number; side: 'long' | 'short' | null; size: number | null; price: number | null }
type RawTradeEvent = TimelineResponse['tradeEvents'][number]
type TradeTimelineRow = {
  time: number
  hostEvent: ChartOverlayEvent | null
  counterEvent: ChartOverlayEvent | null
}

/**
 * Reconstructs the running net position (signed size + average entry) from a market's
 * fills, so we can value the room's open exposure at any past timestamp. A long fill
 * (buy) increases the position; a short fill (sell) decreases it. Reduces keep the
 * existing average entry; flips reset it to the fill price. Approximate but truthful —
 * derived only from real fills, not synthesized.
 */
function buildPositionContextResolver(fills: PositionFill[]) {
  const sorted = [...fills].sort((a, b) => a.time - b.time)
  const states: { time: number; net: number; avgEntry: number }[] = []
  let net = 0
  let avgEntry = 0
  for (const fill of sorted) {
    const qty = Math.abs(fill.size ?? 0)
    if (qty > 0) {
      const signed = (fill.side === 'short' ? -1 : 1) * qty
      const px = fill.price ?? avgEntry
      const sameDirection = net === 0 || net > 0 === signed > 0
      if (sameDirection) {
        const newNet = net + signed
        const denom = Math.abs(newNet)
        avgEntry = denom > 0 ? (avgEntry * Math.abs(net) + px * qty) / denom : avgEntry
        net = newNet
      } else {
        const newNet = net + signed
        if (newNet === 0) {
          net = 0
          avgEntry = 0
        } else if (newNet > 0 !== net > 0) {
          net = newNet
          avgEntry = px
        } else {
          net = newNet
        }
      }
    }
    states.push({ time: fill.time, net, avgEntry })
  }
  return (timeMs: number, markPrice: number | null) => {
    let resolved = { net: 0, avgEntry: 0 }
    for (const state of states) {
      if (state.time <= timeMs) resolved = state
      else break
    }
    if (resolved.net === 0) {
      return { side: null, size: 0, avgEntry: null, markPrice, unrealizedPnl: null }
    }
    const side: 'long' | 'short' = resolved.net > 0 ? 'long' : 'short'
    const unrealizedPnl =
      markPrice != null && resolved.avgEntry > 0 ? (markPrice - resolved.avgEntry) * resolved.net : null
    return { side, size: Math.abs(resolved.net), avgEntry: resolved.avgEntry, markPrice, unrealizedPnl }
  }
}

function resolveTradeSideLabel(
  event: Pick<
    ChartOverlayEvent,
    'action' | 'side' | 'dir' | 'contextAtTime' | 'contextBeforeTime'
  >,
): 'long' | 'short' | null {
  if (
    (event.action === 'reduce' || event.action === 'close' || event.action === 'liquidated') &&
    (event.contextBeforeTime?.side === 'long' || event.contextBeforeTime?.side === 'short')
  ) {
    return event.contextBeforeTime.side
  }
  if (event.side === 'long' || event.side === 'short') return event.side
  const dir = (event.dir ?? '').toLowerCase()
  if (dir.includes('short')) return 'short'
  if (dir.includes('long')) return 'long'
  if (event.contextAtTime?.side === 'long' || event.contextAtTime?.side === 'short') {
    return event.contextAtTime.side
  }
  return null
}

function describeTradeEventAction(
  event: Pick<ChartOverlayEvent, 'action' | 'side' | 'dir' | 'closedPnl' | 'contextAtTime'>,
): string {
  const action = resolveDisplayTradeAction(event)
  const side = resolveTradeSideLabel(event)
  const sideLabel = side ?? 'position'
  switch (action) {
    case 'entry':
      return `◉ Opened ${sideLabel}`
    case 'add':
      return `↗ Increased ${sideLabel}`
    case 'reduce':
      return `↘ Reduced ${sideLabel}`
    case 'close':
      return `✕ Closed ${sideLabel}`
    case 'liquidated':
      return `☠ Liquidated ${sideLabel}`
    case 'flip':
      return side ? `⇄ Flipped to ${side}` : '⇄ Flipped position'
    default:
      return 'Trade update'
  }
}

function resolveDisplayTradeAction(
  event: Pick<
    ChartOverlayEvent,
    'action' | 'side' | 'dir' | 'contextAtTime' | 'contextBeforeTime'
  >,
): ChartOverlayEvent['action'] {
  if (event.action !== 'close' && event.action !== 'reduce') return event.action
  const context = event.contextAtTime
  const previousContext = event.contextBeforeTime
  if (!context) return event.action
  const side = resolveTradeSideLabel(event)
  const SIZE_EPSILON = 1e-9
  if (context.size <= SIZE_EPSILON || context.side == null) return 'close'
  if (previousContext?.side && previousContext.side !== context.side) return 'close'
  if (
    previousContext?.size != null &&
    previousContext.size > SIZE_EPSILON &&
    context.size <= Math.max(SIZE_EPSILON, previousContext.size * 0.02)
  ) {
    return 'close'
  }
  if (side != null && context.side === side) return 'reduce'
  return 'close'
}

function shouldPairTradeTimelineEvents(
  left: Pick<ChartOverlayEvent, 'action'>,
  right: Pick<ChartOverlayEvent, 'action'>,
): boolean {
  const leftAction = left.action
  const rightAction = right.action
  if (!leftAction || !rightAction) return false
  if (leftAction === rightAction) return true
  const openFamily = new Set<NonNullable<ChartOverlayEvent['action']>>(['entry', 'add'])
  const closeFamily = new Set<NonNullable<ChartOverlayEvent['action']>>([
    'close',
    'reduce',
    'liquidated',
  ])
  if (openFamily.has(leftAction) && openFamily.has(rightAction)) return true
  if (closeFamily.has(leftAction) && closeFamily.has(rightAction)) return true
  return false
}

function formatCompactUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function toPositiveNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

function formatCompactLeverage(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function buildTradeSummaryLine(
  event: Pick<ChartOverlayEvent, 'price' | 'size' | 'leverage' | 'notionalUsd' | 'marginUsd'>,
  marketLabel: string,
): string {
  const price = toPositiveNumber(event.price)
  const leverage = toPositiveNumber(event.leverage)
  const explicitNotional = toPositiveNumber(event.notionalUsd)
  const computedNotional =
    price != null && event.size != null && Number.isFinite(event.size)
      ? Math.abs(price * event.size)
      : null
  const notional = explicitNotional ?? computedNotional
  const explicitMargin = toPositiveNumber(event.marginUsd)
  const margin = explicitMargin ?? (notional != null && leverage != null ? notional / leverage : null)

  if (margin != null && leverage != null && notional != null && price != null) {
    return `${formatCompactUsd(margin)} x${formatCompactLeverage(leverage)} = ${formatCompactUsd(notional)} @ ${formatCompactUsd(price)}`
  }
  if (margin != null && leverage != null && notional != null) {
    return `${formatCompactUsd(margin)} x${formatCompactLeverage(leverage)} = ${formatCompactUsd(notional)}`
  }
  if (notional != null && price != null) {
    return `${formatCompactUsd(notional)} @ ${formatCompactUsd(price)}`
  }
  if (price != null && event.size != null && Number.isFinite(event.size)) {
    return `${formatTokenAmount(event.size)} ${marketLabel} @ ${formatCompactUsd(price)}`
  }
  if (event.size != null && Number.isFinite(event.size)) {
    return `Size ${formatTokenAmount(event.size)} ${marketLabel}`
  }
  return 'Trade update'
}

function formatTokenAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}

function buildEntryPathData(
  candles: TimelineResponse['candles'],
  resolver: ReturnType<typeof buildPositionContextResolver>,
): Array<{ time: number; value: number }> {
  if (!candles.length) return []
  const points: Array<{ time: number; value: number }> = []
  for (const candle of candles) {
    const ctx = resolver(candle.time, candle.close)
    if (ctx.avgEntry != null && ctx.size > 0) {
      points.push({
        time: Math.floor(candle.time / 1000),
        value: ctx.avgEntry,
      })
    }
  }
  return points
}

/**
 * Hyperliquid can split one logical order into many fills at the same millisecond.
 * For timeline readability we collapse those micro-fills into one visual trade event,
 * while retaining raw fills elsewhere for position reconstruction accuracy.
 */
function aggregateTradeEventsForDisplay(trades: RawTradeEvent[]): RawTradeEvent[] {
  const buckets = new Map<
    string,
    {
      sample: RawTradeEvent
      sizeSum: number
      feeSum: number
      closedPnlSum: number
      weightedPriceSum: number
      weightedQtySum: number
      count: number
    }
  >()
  for (const trade of trades) {
    const key = [
      trade.market,
      String(trade.time),
      trade.action,
      trade.side ?? 'none',
      trade.dir ?? 'none',
    ].join('|')
    const qty = Math.abs(trade.size ?? 0)
    const weightedPrice = (trade.price ?? 0) * qty
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, {
        sample: trade,
        sizeSum: trade.size ?? 0,
        feeSum: trade.fee ?? 0,
        closedPnlSum: trade.closedPnl ?? 0,
        weightedPriceSum: weightedPrice,
        weightedQtySum: qty,
        count: 1,
      })
      continue
    }
    existing.sizeSum += trade.size ?? 0
    existing.feeSum += trade.fee ?? 0
    existing.closedPnlSum += trade.closedPnl ?? 0
    existing.weightedPriceSum += weightedPrice
    existing.weightedQtySum += qty
    existing.count += 1
  }

  const aggregated = [...buckets.values()]
    .map((bucket) => {
      const averagePrice =
        bucket.weightedQtySum > 0 ? bucket.weightedPriceSum / bucket.weightedQtySum : bucket.sample.price
      return {
        ...bucket.sample,
        id:
          bucket.count > 1
            ? `agg:${bucket.sample.market}:${bucket.sample.time}:${bucket.sample.action}:${bucket.sample.side ?? 'none'}:${bucket.sample.dir ?? 'none'}`
            : bucket.sample.id,
        size: bucket.sizeSum,
        fee: bucket.feeSum,
        closedPnl: bucket.closedPnlSum,
        price: averagePrice,
      } satisfies RawTradeEvent
    })
    .sort((a, b) => a.time - b.time)

  return pruneRedundantZeroSizeTradeEvents(
    normalizeLifecycleActionsByPosition(
      mergeAdjacentLifecycleTradeEvents(dedupeCounterActionFillPairs(aggregated)),
    ),
  )
}

function normalizeLifecycleActionsByPosition(events: RawTradeEvent[]): RawTradeEvent[] {
  if (events.length <= 1) return events
  const SIZE_EPSILON = 1e-9
  const byTime = [...events].sort((a, b) => a.time - b.time)
  const positionByLane = new Map<string, number>()
  const normalized: RawTradeEvent[] = []

  for (const event of byTime) {
    const side = resolveTradeSideLabel(event)
    const qty = Math.abs(event.size ?? 0)
    const laneKey = `${event.source}|${event.market}`
    const previousPosition = positionByLane.get(laneKey) ?? 0
    let normalizedAction = event.action
    let nextPosition = previousPosition

    if (side != null && qty > SIZE_EPSILON) {
      const sideSign = side === 'long' ? 1 : -1
      if (event.action === 'entry' || event.action === 'add') {
        nextPosition = previousPosition + sideSign * qty
      } else if (
        event.action === 'reduce' ||
        event.action === 'close' ||
        event.action === 'liquidated'
      ) {
        nextPosition = previousPosition - sideSign * qty
      } else if (event.action === 'flip') {
        nextPosition = sideSign * qty
      }

      if (event.action === 'close' && Math.abs(nextPosition) > SIZE_EPSILON) {
        normalizedAction = 'reduce'
      } else if (event.action === 'reduce' && Math.abs(nextPosition) <= SIZE_EPSILON) {
        normalizedAction = 'close'
      }
    }

    positionByLane.set(laneKey, Math.abs(nextPosition) <= SIZE_EPSILON ? 0 : nextPosition)
    normalized.push(
      normalizedAction === event.action
        ? event
        : {
            ...event,
            action: normalizedAction,
          },
    )
  }

  return normalized.sort((a, b) => a.time - b.time)
}

function resolveMergedLifecycleAction(
  left: RawTradeEvent['action'],
  right: RawTradeEvent['action'],
): RawTradeEvent['action'] | null {
  const actionSet = new Set([left, right])
  if (actionSet.has('close') && actionSet.size === 1) return 'close'
  if (actionSet.has('entry') && actionSet.has('add')) return 'entry'
  if (actionSet.has('reduce') && actionSet.has('close')) return 'close'
  return null
}

function mergeLifecyclePair(
  base: RawTradeEvent,
  incoming: RawTradeEvent,
  mergedAction: RawTradeEvent['action'],
): RawTradeEvent {
  const baseQty = Math.abs(base.size ?? 0)
  const incomingQty = Math.abs(incoming.size ?? 0)
  const weightedPrice =
    baseQty + incomingQty > 0
      ? ((base.price ?? 0) * baseQty + (incoming.price ?? 0) * incomingQty) / (baseQty + incomingQty)
      : (incoming.price ?? base.price ?? null)
  return {
    ...base,
    id: `merged:${base.id}:${incoming.id}`,
    action: mergedAction,
    side: base.side ?? incoming.side,
    dir: base.dir ?? incoming.dir,
    size: (base.size ?? 0) + (incoming.size ?? 0),
    fee: (base.fee ?? 0) + (incoming.fee ?? 0),
    closedPnl: (base.closedPnl ?? 0) + (incoming.closedPnl ?? 0),
    price: weightedPrice,
  }
}

function mergeAdjacentLifecycleTradeEvents(events: RawTradeEvent[]): RawTradeEvent[] {
  if (events.length <= 1) return events
  const merged: RawTradeEvent[] = []
  for (const event of events) {
    const last = merged[merged.length - 1]
    if (!last) {
      merged.push(event)
      continue
    }

    const sameMarketAndSource = last.market === event.market && last.source === event.source
    const sameExactTimestamp = last.time === event.time
    const sameMinute = Math.floor(last.time / 60_000) === Math.floor(event.time / 60_000)
    const closeLikePair =
      (last.action === 'close' || last.action === 'reduce') &&
      (event.action === 'close' || event.action === 'reduce')
    const compatibleSide = !last.side || !event.side || last.side === event.side
    const isSameBucket =
      sameMarketAndSource &&
      (sameExactTimestamp || (sameMinute && closeLikePair && compatibleSide))
    const mergedAction = isSameBucket ? resolveMergedLifecycleAction(last.action, event.action) : null
    if (mergedAction) {
      merged[merged.length - 1] = mergeLifecyclePair(last, event, mergedAction)
      continue
    }

    merged.push(event)
  }
  return merged
}

function deriveEventNotionalForMatching(event: RawTradeEvent): number | null {
  const explicit = toPositiveNumber(event.notionalUsd)
  if (explicit != null) return explicit
  if (event.price != null && event.size != null && Number.isFinite(event.price) && Number.isFinite(event.size)) {
    const computed = Math.abs(event.price * event.size)
    return Number.isFinite(computed) && computed > 0 ? computed : null
  }
  return null
}

function isCounterActionTimelineEvent(event: RawTradeEvent): boolean {
  return event.source === 'counter' && event.id.startsWith('counter_action:')
}

function isCounterFillTimelineEvent(event: RawTradeEvent): boolean {
  return event.source === 'counter' && !event.id.startsWith('counter_action:')
}

function mergeCounterActionAndFillEvent(actionEvent: RawTradeEvent, fillEvent: RawTradeEvent): RawTradeEvent {
  const dominant = actionEvent
  const support = fillEvent
  return {
    ...support,
    ...dominant,
    id: `counter_merged:${dominant.id}:${support.id}`,
    time: Math.min(actionEvent.time, fillEvent.time),
    source: 'counter',
    side: dominant.side ?? support.side,
    action: dominant.action,
    price: support.price ?? dominant.price,
    size: support.size ?? dominant.size,
    dir: dominant.dir ?? support.dir,
    closedPnl:
      Math.abs(support.closedPnl ?? 0) > Math.abs(dominant.closedPnl ?? 0)
        ? support.closedPnl
        : dominant.closedPnl,
    fee: Math.abs(support.fee ?? 0) > Math.abs(dominant.fee ?? 0) ? support.fee : dominant.fee,
    leverage: dominant.leverage ?? support.leverage,
    notionalUsd: dominant.notionalUsd ?? support.notionalUsd,
    marginUsd: dominant.marginUsd ?? support.marginUsd,
  }
}

function dedupeCounterActionFillPairs(events: RawTradeEvent[]): RawTradeEvent[] {
  if (events.length <= 1) return events
  const consumed = new Set<number>()
  const mergedOrUnmatchedActions: RawTradeEvent[] = []
  const leftovers: RawTradeEvent[] = []
  const MAX_TIME_DELTA_MS = 90_000
  const MAX_RELATIVE_NOTIONAL_DRIFT = 0.1
  const HARD_MATCH_TIME_DELTA_MS = 8_000

  // Pass 1: pair counter actions with candidate counter fills before emitting fills.
  for (let i = 0; i < events.length; i += 1) {
    if (consumed.has(i)) continue
    const event = events[i]!
    if (!isCounterActionTimelineEvent(event)) continue

    const actionNotional = deriveEventNotionalForMatching(event)
    let bestCandidateIndex = -1
    let bestScore = Number.POSITIVE_INFINITY

    for (let j = 0; j < events.length; j += 1) {
      if (i === j || consumed.has(j)) continue
      const candidate = events[j]!
      if (!isCounterFillTimelineEvent(candidate)) continue
      if (candidate.market !== event.market) continue
      if (candidate.action !== event.action) continue
      if (event.side && candidate.side && event.side !== candidate.side) continue

      const dt = Math.abs(candidate.time - event.time)
      if (dt > MAX_TIME_DELTA_MS) continue
      const sameMinute =
        Math.floor(candidate.time / 60_000) === Math.floor(event.time / 60_000)

      const candidateNotional = deriveEventNotionalForMatching(candidate)
      if (actionNotional != null && candidateNotional != null) {
        const relDelta =
          Math.abs(actionNotional - candidateNotional) /
          Math.max(actionNotional, candidateNotional, 1)
        const hasStrongTimeCorrelation = dt <= HARD_MATCH_TIME_DELTA_MS && sameMinute
        if (relDelta > MAX_RELATIVE_NOTIONAL_DRIFT && !hasStrongTimeCorrelation) continue
        const score = dt + relDelta * 1_000
        if (score < bestScore) {
          bestScore = score
          bestCandidateIndex = j
        }
        continue
      }

      if (dt <= 5_000 && dt < bestScore) {
        bestScore = dt
        bestCandidateIndex = j
      }
    }

    if (bestCandidateIndex >= 0) {
      const candidate = events[bestCandidateIndex]!
      mergedOrUnmatchedActions.push(mergeCounterActionAndFillEvent(event, candidate))
      consumed.add(i)
      consumed.add(bestCandidateIndex)
      continue
    }

    mergedOrUnmatchedActions.push(event)
    consumed.add(i)
  }

  // Pass 2: append every non-consumed event (host rows and unmatched counter fills).
  for (let i = 0; i < events.length; i += 1) {
    if (consumed.has(i)) continue
    leftovers.push(events[i]!)
  }

  return [...mergedOrUnmatchedActions, ...leftovers].sort((a, b) => a.time - b.time)
}

function pruneRedundantZeroSizeTradeEvents(events: RawTradeEvent[]): RawTradeEvent[] {
  if (events.length <= 1) return events

  const SIZE_EPSILON = 1e-9
  const bucketHasMeaningfulSize = new Map<string, boolean>()

  const keyFor = (event: RawTradeEvent) =>
    `${Math.floor(event.time / 60_000)}|${event.market}|${event.source}|${event.action}|${event.side ?? 'none'}`

  for (const event of events) {
    const key = keyFor(event)
    if (Math.abs(event.size ?? 0) > SIZE_EPSILON) {
      bucketHasMeaningfulSize.set(key, true)
    } else if (!bucketHasMeaningfulSize.has(key)) {
      bucketHasMeaningfulSize.set(key, false)
    }
  }

  return events.filter((event) => {
    const key = keyFor(event)
    const hasMeaningfulSibling = bucketHasMeaningfulSize.get(key) === true
    const isZeroSize = Math.abs(event.size ?? 0) <= SIZE_EPSILON
    return !(isZeroSize && hasMeaningfulSibling)
  })
}

// Finer candles when zoomed in, coarser for long windows — keeps us under Hyperliquid's
// ~5000-candle snapshot cap while reducing how many messages collide on a single candle.
type IntervalChoice = 'auto' | '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h'

function autoIntervalForWindow(windowHours: number): string {
  if (windowHours <= 24) return '5m'
  if (windowHours <= 72) return '15m'
  return '1h'
}

// Hyperliquid's candleSnapshot caps at ~5000 points, so finer intervals are only offered
// on shorter windows. Anything past the cap falls back to the auto interval.
function maxCandlesForInterval(interval: string): number {
  switch (interval) {
    case '1m':
      return 1
    case '3m':
      return 2
    case '5m':
      return 5
    case '15m':
      return 15
    case '30m':
      return 10
    case '1h':
      return 60
    case '4h':
      return 15
    default:
      return 60
  }
}

function resolveInterval(choice: IntervalChoice, windowHours: number): string {
  if (choice === 'auto') return autoIntervalForWindow(windowHours)
  const minutes = maxCandlesForInterval(choice)
  const candleCount = (windowHours * 60) / minutes
  // Guard against blowing past Hyperliquid's snapshot cap; degrade gracefully to auto.
  if (candleCount > 5000) return autoIntervalForWindow(windowHours)
  return choice
}

function isIntervalAllowed(choice: IntervalChoice, windowHours: number): boolean {
  if (choice === 'auto') return true
  const minutes = maxCandlesForInterval(choice)
  return (windowHours * 60) / minutes <= 5000
}

async function fetchRoomTimelineBySymbol(
  windowHours: number,
  symbol: string | null,
  interval: string,
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    roomId: '1659',
    windowHours: String(windowHours),
    interval,
  })
  if (symbol && symbol.trim().length > 0) {
    params.set('symbol', symbol.trim().toUpperCase())
  }
  const res = await apiFetch(`/api/v1/alfaclub/room-timeline?${params.toString()}`, {})
  const json = (await res.json()) as { success?: boolean; data?: TimelineResponse; error?: string }
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  return json.data
}

export function Positions() {
  const PANEL_MIN_WIDTH = 420
  const PANEL_MAX_WIDTH = 760
  const PANEL_DEFAULT_WIDTH = 520
  const [chatScope, setChatScope] = useState<'host' | 'all' | 'sender'>('all')
  const [selectedSender, setSelectedSender] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [windowHours, setWindowHours] = useState<24 | 72 | 168>(168)
  const [intervalChoice, setIntervalChoice] = useState<IntervalChoice>('5m')
  const [densityMode, setDensityMode] = useState<'all' | 'major'>('all')
  const [showTrades, setShowTrades] = useState(true)
  const [showHermitComments, setShowHermitComments] = useState(false)
  const [showCommandMessages, setShowCommandMessages] = useState(false)
  const [showEntryPath, setShowEntryPath] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [tradePanelCollapsed, setTradePanelCollapsed] = useState(false)
  const [messagePanelCollapsed, setMessagePanelCollapsed] = useState(false)
  const [tradePanelWidth, setTradePanelWidth] = useState(PANEL_DEFAULT_WIDTH)
  const [messagePanelWidth, setMessagePanelWidth] = useState(PANEL_DEFAULT_WIDTH)
  const [messageSourceFilter, setMessageSourceFilter] = useState<'all' | 'host' | 'room' | 'bot'>('all')
  const resizeStateRef = useRef<{
    side: 'left' | 'right'
    startX: number
    startWidth: number
  } | null>(null)
  const [activeResizeSide, setActiveResizeSide] = useState<'left' | 'right' | null>(null)

  // Refs for timeline scroll containers so selected events can be brought into view.
  const tradeTimelineListRef = useRef<HTMLDivElement | null>(null)
  const messageTimelineListRef = useRef<HTMLDivElement | null>(null)

  const selectedSymbolForQuery = useMemo(() => {
    const [symbol] = selectedMarket.split('/')
    const normalized = (symbol ?? '').trim().toUpperCase()
    return normalized || null
  }, [selectedMarket])

  const effectiveInterval = useMemo(
    () => resolveInterval(intervalChoice, windowHours),
    [intervalChoice, windowHours],
  )

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['alfaclub-room-timeline', '1659', windowHours, selectedSymbolForQuery, effectiveInterval],
    queryFn: () => fetchRoomTimelineBySymbol(windowHours, selectedSymbolForQuery, effectiveInterval),
    staleTime: 30_000,
  })

  const preferredOpenMarket = useMemo(() => {
    const positions = data?.currentPositions ?? []
    const openPositions = positions.filter((position) => position.side != null)
    if (openPositions.length === 0) return null
    // Default to the open market with the highest live TVL (abs sizeUsd).
    // Tie-breaker keeps BTC first when exposure is effectively equal.
    const ranked = [...openPositions].sort((a, b) => {
      const byTvl = Math.abs(b.sizeUsd ?? 0) - Math.abs(a.sizeUsd ?? 0)
      if (Math.abs(byTvl) > 1e-9) return byTvl
      if (a.market === 'BTC/USDC' && b.market !== 'BTC/USDC') return -1
      if (b.market === 'BTC/USDC' && a.market !== 'BTC/USDC') return 1
      return 0
    })
    return ranked[0]?.market ?? null
  }, [data?.currentPositions])

  // Resolve the active market during render instead of syncing via an effect.
  // `selectedMarket` is the raw user choice (empty until they pick one); we fall
  // back to the server default whenever the choice is empty or no longer available.
  const effectiveMarket = useMemo(() => {
    const available = data?.markets ?? []
    if (selectedMarket && available.includes(selectedMarket)) return selectedMarket
    if (preferredOpenMarket && available.includes(preferredOpenMarket)) return preferredOpenMarket
    return data?.defaultMarket ?? selectedMarket
  }, [data?.defaultMarket, data?.markets, preferredOpenMarket, selectedMarket])

  // Keep the initial chart/feed market aligned with the highest-open-TVL market when the user
  // has not made an explicit selection yet.
  useEffect(() => {
    if (selectedMarket) return
    if (!data?.markets || data.markets.length === 0) return
    const next =
      preferredOpenMarket && data.markets.includes(preferredOpenMarket)
        ? preferredOpenMarket
        : data.defaultMarket
    if (!next) return
    const timer = window.setTimeout(() => {
      setSelectedMarket(next)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [data?.defaultMarket, data?.markets, preferredOpenMarket, selectedMarket])

  // Bot filter (Hermit etc.) is applied early so that sender options and downstream
  // lists/chart only see human messages when the toggle is active.
  const baseChatEvents = useMemo(() => {
    let evs = data?.chatEvents ?? []
    if (!showHermitComments) {
      // Hide Hermit comments when toggle is OFF.
      evs = evs.filter((e) => {
        if (e.isBot === true) return false;
        const label = (e.senderLabel || '').toLowerCase();
        if (label.includes('hermit')) return false;
        return true;
      });
    }
    if (!showCommandMessages) {
      // Hide slash-command messages when toggle is OFF.
      evs = evs.filter((e) => !(e.text || '').trim().startsWith('/'))
    }
    return evs
  }, [data?.chatEvents, showHermitComments, showCommandMessages])

  const senderOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of baseChatEvents) {
      if (!map.has(event.senderAddress)) {
        map.set(event.senderAddress, event.senderLabel || event.senderAddress)
      }
    }
    return [...map.entries()].map(([address, label]) => ({ address, label }))
  }, [baseChatEvents])

  const isSelectedSenderVisible = useMemo(
    () => (selectedSender ? baseChatEvents.some((event) => event.senderAddress === selectedSender) : false),
    [baseChatEvents, selectedSender],
  )

  const effectiveChatScope = useMemo<'host' | 'all' | 'sender'>(() => {
    if (chatScope !== 'sender') return chatScope
    return selectedSender && isSelectedSenderVisible ? 'sender' : 'all'
  }, [chatScope, isSelectedSenderVisible, selectedSender])

  const effectiveSelectedSender = effectiveChatScope === 'sender' ? selectedSender : null

  const filteredChatEvents = useMemo(() => {
    const source = baseChatEvents // already has bot filter applied
    const byScope =
      effectiveChatScope === 'host'
        ? source.filter((event) => event.isHost)
        : effectiveChatScope === 'sender' && effectiveSelectedSender
          ? source.filter((event) => event.senderAddress === effectiveSelectedSender)
          : source
    if (!effectiveMarket) return byScope
    // Market-specific messages stay decoupled; room-wide chatter (null market) is
    // general social signal and surfaces on every market.
    return byScope.filter((event) => event.market === effectiveMarket || event.market == null)
  }, [effectiveChatScope, baseChatEvents, effectiveMarket, effectiveSelectedSender])

  const filteredTradeEvents = useMemo(() => {
    const source = data?.tradeEvents ?? []
    if (!effectiveMarket) return source
    return source.filter((event) => event.market === effectiveMarket)
  }, [data?.tradeEvents, effectiveMarket])

  const displayTradeEvents = useMemo(
    () => aggregateTradeEventsForDisplay(filteredTradeEvents),
    [filteredTradeEvents],
  )

  // Hoisted resolver so we can use it both for per-event context and for sampling
  // historical position entry prices for the chart line.
  const positionContextResolver = useMemo(() => {
    return buildPositionContextResolver(
      filteredTradeEvents.map((event) => ({
        time: event.time,
        side: event.side,
        size: event.size,
        price: event.price,
      })),
    )
  }, [filteredTradeEvents])

  const roomPositionContextResolver = useMemo(() => {
    return buildPositionContextResolver(
      filteredTradeEvents
        .filter((event) => event.source === 'host')
        .map((event) => ({
          time: event.time,
          side: event.side,
          size: event.size,
          price: event.price,
        })),
    )
  }, [filteredTradeEvents])

  const agentPositionContextResolver = useMemo(() => {
    return buildPositionContextResolver(
      filteredTradeEvents
        .filter((event) => event.source === 'counter')
        .map((event) => ({
          time: event.time,
          side: event.side,
          size: event.size,
          price: event.price,
        })),
    )
  }, [filteredTradeEvents])

  const roomEntryPathData = useMemo(
    () => buildEntryPathData(data?.candles ?? [], roomPositionContextResolver),
    [data?.candles, roomPositionContextResolver],
  )

  const agentEntryPathData = useMemo(
    () => buildEntryPathData(data?.candles ?? [], agentPositionContextResolver),
    [data?.candles, agentPositionContextResolver],
  )

  const selectedSummary = useMemo(() => {
    const summaries = data?.marketSummaries ?? []
    return summaries.find((summary) => summary.market === effectiveMarket) ?? summaries[0] ?? null
  }, [data?.marketSummaries, effectiveMarket])

  const roomCurrentPosition = useMemo(() => {
    const positions = (data?.currentPositions ?? []).filter(
      (position) => position.market === effectiveMarket && position.source === 'host',
    )
    if (positions.length === 0) return null
    return [...positions].sort((a, b) => Math.abs(b.sizeUsd ?? 0) - Math.abs(a.sizeUsd ?? 0))[0] ?? null
  }, [data?.currentPositions, effectiveMarket])

  const agentCurrentPosition = useMemo(() => {
    const positions = (data?.currentPositions ?? []).filter(
      (position) => position.market === effectiveMarket && position.source === 'counter',
    )
    if (positions.length === 0) return null
    return [...positions].sort((a, b) => Math.abs(b.sizeUsd ?? 0) - Math.abs(a.sizeUsd ?? 0))[0] ?? null
  }, [data?.currentPositions, effectiveMarket])

  const lastPrice = useMemo(() => {
    const candles = data?.candles ?? []
    return candles.length > 0 ? candles[candles.length - 1]!.close : null
  }, [data?.candles])

  const allOverlayEvents = useMemo<ChartOverlayEvent[]>(() => {
    const candles = data?.candles ?? []
    const trades = showTrades
      ? displayTradeEvents.map<ChartOverlayEvent>((event) => {
          const markPrice = nearestCandleClose(event.time, candles)
          const sourceResolver =
            event.source === 'host'
              ? roomPositionContextResolver
              : event.source === 'counter'
                ? agentPositionContextResolver
                : positionContextResolver
          const contextAtTime = sourceResolver(event.time, markPrice)
          const contextBeforeTime = sourceResolver(event.time - 1, markPrice)
          return {
            id: event.id,
            time: event.time,
            market: event.market,
            kind: 'trade',
            action: event.action,
            source: event.source,
            side: event.side,
            price: event.price,
            size: event.size,
            closedPnl: event.closedPnl,
            dir: event.dir,
            leverage: event.leverage,
            notionalUsd: event.notionalUsd,
            marginUsd: event.marginUsd,
            contextAtTime,
            contextBeforeTime,
          }
        })
      : []
    const chats = filteredChatEvents.map<ChartOverlayEvent>((event) => {
      const markPrice = nearestCandleClose(event.time, candles)
      return {
        id: event.id,
        time: event.time,
        market: event.market,
        kind: event.isHost ? 'host-chat' : 'chat',
        text: event.text,
        senderLabel: event.senderLabel,
        senderAvatarUrl: event.senderAvatarUrl,
        senderAddress: event.senderAddress,
        isBot: event.isBot,
        isFirstFromSender: event.isFirstFromSender,
        price: markPrice,
        contextAtTime: positionContextResolver(event.time, markPrice),
      }
    })
    const merged = [...trades, ...chats].sort((a, b) => a.time - b.time)
    if (densityMode === 'all') return merged
    const major = merged
      .filter(
        (event) =>
          event.kind === 'trade' || event.kind === 'host-chat' || Boolean(event.isFirstFromSender),
      )
      .sort((a, b) => a.time - b.time)
    const bucketMs = 15 * 60 * 1000
    const clustered: ChartOverlayEvent[] = []
    const seen = new Set<string>()
    for (const event of major) {
      const bucket = Math.floor(event.time / bucketMs)
      const key = `${event.market ?? 'global'}:${event.kind}:${event.action ?? 'none'}:${bucket}`
      if (seen.has(key) && event.id !== selectedEventId) continue
      clustered.push(event)
      seen.add(key)
    }
    return clustered
  }, [
    data?.candles,
    densityMode,
    filteredChatEvents,
    displayTradeEvents,
    roomPositionContextResolver,
    agentPositionContextResolver,
    positionContextResolver,
    showTrades,
    selectedEventId,
  ])

  const selectedEventIndex = useMemo(
    () => allOverlayEvents.findIndex((event) => event.id === selectedEventId),
    [allOverlayEvents, selectedEventId],
  )
  const selectedEvent =
    selectedEventIndex >= 0 && selectedEventIndex < allOverlayEvents.length
      ? allOverlayEvents[selectedEventIndex]
      : null

  // For the side timeline list we want reverse-chronological order:
  // most recent / current events at the top, older messages as the user scrolls down.
  const timelineListEvents = useMemo(() => {
    const recent = allOverlayEvents.slice(-160)
    return [...recent].reverse()
  }, [allOverlayEvents])

  const timelineTradeEvents = useMemo(
    () => timelineListEvents.filter((event) => event.kind === 'trade'),
    [timelineListEvents],
  )
  const timelineChatEvents = useMemo(
    () => timelineListEvents.filter((event) => event.kind !== 'trade'),
    [timelineListEvents],
  )

  const filteredTimelineTradeEvents = useMemo(() => timelineTradeEvents, [timelineTradeEvents])
  const timelineTradeRows = useMemo(
    () =>
      filteredTimelineTradeEvents
        .sort((a, b) => b.time - a.time || a.id.localeCompare(b.id)),
    [filteredTimelineTradeEvents],
  )
  const timelineTradePairedRows = useMemo(
    () => {
      const rows: TradeTimelineRow[] = []
      const consumed = new Set<string>()
      const PAIR_WINDOW_MS = 3 * 60_000
      for (let i = 0; i < timelineTradeRows.length; i += 1) {
        const event = timelineTradeRows[i]!
        if (consumed.has(event.id)) continue
        let bestCandidate: ChartOverlayEvent | null = null
        let bestDelta = Number.POSITIVE_INFINITY
        for (let j = i + 1; j < timelineTradeRows.length; j += 1) {
          const candidate = timelineTradeRows[j]!
          if (consumed.has(candidate.id)) continue
          if (candidate.source === event.source) continue
          const delta = Math.abs(candidate.time - event.time)
          if (delta > PAIR_WINDOW_MS) continue
          if (!shouldPairTradeTimelineEvents(event, candidate)) continue
          if (delta < bestDelta) {
            bestDelta = delta
            bestCandidate = candidate
          }
        }
        consumed.add(event.id)
        if (bestCandidate) consumed.add(bestCandidate.id)
        const hostEvent =
          event.source === 'host'
            ? event
            : bestCandidate?.source === 'host'
              ? bestCandidate
              : null
        const counterEvent =
          event.source === 'counter'
            ? event
            : bestCandidate?.source === 'counter'
              ? bestCandidate
              : null
        rows.push({
          time: Math.max(event.time, bestCandidate?.time ?? 0),
          hostEvent,
          counterEvent,
        })
      }
      return rows.sort((a, b) => b.time - a.time)
    },
    [timelineTradeRows],
  )
  const timelineTradeRowsWithSpacing = useMemo(
    () =>
      timelineTradePairedRows.map((row, index) => {
        const event = row
        if (index === 0) return { event, spacerPx: 0 }
        const previousRow = timelineTradePairedRows[index - 1]
        if (!previousRow) return { event, spacerPx: 0 }
        const deltaMinutes = Math.max(0, (previousRow.time - row.time) / 60_000)
        let spacerPx: number
        if (deltaMinutes <= 2) {
          spacerPx = 1
        } else if (deltaMinutes <= 5) {
          spacerPx = 2
        } else if (deltaMinutes <= 15) {
          spacerPx = 8
        } else if (deltaMinutes <= 60) {
          spacerPx = 14
        } else if (deltaMinutes <= 180) {
          spacerPx = 24
        } else {
          spacerPx = 36
        }
        return { event, spacerPx }
      }),
    [timelineTradePairedRows],
  )

  const filteredTimelineChatEvents = useMemo(() => {
    if (messageSourceFilter === 'all') return timelineChatEvents
    if (messageSourceFilter === 'host') {
      return timelineChatEvents.filter((event) => event.kind === 'host-chat')
    }
    if (messageSourceFilter === 'room') {
      return timelineChatEvents.filter((event) => event.kind === 'chat')
    }
    return timelineChatEvents.filter((event) => event.isBot)
  }, [timelineChatEvents, messageSourceFilter])

  const stepEvent = useCallback((delta: -1 | 1) => {
    if (allOverlayEvents.length === 0) return
    if (selectedEventIndex < 0) {
      setSelectedEventId(allOverlayEvents[delta > 0 ? 0 : allOverlayEvents.length - 1]!.id)
      return
    }
    const next = (selectedEventIndex + delta + allOverlayEvents.length) % allOverlayEvents.length
    setSelectedEventId(allOverlayEvents[next]!.id)
  }, [allOverlayEvents, selectedEventIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepEvent(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepEvent(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stepEvent])

  // When selection changes (via click, keyboard arrows, or inspector), scroll the
  // corresponding row into view inside the timeline list (newest-first order).
  useEffect(() => {
    if (!selectedEventId) return
    const containers = [tradeTimelineListRef.current, messageTimelineListRef.current]
    for (const container of containers) {
      if (!container) continue
      const row = container.querySelector(`[data-event-id="${selectedEventId}"]`) as HTMLElement | null
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        break
      }
    }
  }, [selectedEventId])

  const positionsGridColumns = useMemo(() => {
    const left = tradePanelCollapsed ? 64 : tradePanelWidth
    const right = messagePanelCollapsed ? 64 : messagePanelWidth
    return `${left}px 12px minmax(0,1fr) 12px ${right}px`
  }, [messagePanelCollapsed, messagePanelWidth, tradePanelCollapsed, tradePanelWidth])

  const beginResize = useCallback(
    (side: 'left' | 'right') => (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      resizeStateRef.current = {
        side,
        startX: event.clientX,
        startWidth: side === 'left' ? tradePanelWidth : messagePanelWidth,
      }
      setActiveResizeSide(side)
    },
    [messagePanelWidth, tradePanelWidth],
  )

  useEffect(() => {
    if (!activeResizeSide) return

    const onMove = (event: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      const deltaX = event.clientX - state.startX
      if (state.side === 'left') {
        const next = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, state.startWidth + deltaX))
        setTradePanelWidth(next)
        return
      }
      const next = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, state.startWidth - deltaX))
      setMessagePanelWidth(next)
    }

    const onUp = () => {
      resizeStateRef.current = null
      setActiveResizeSide(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [activeResizeSide])

  return (
    <div className="relative pb-24 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-sky-500/10 to-transparent" />
      <section className="cinematic-section no-divider-top !pt-0 !pb-6 sm:!pb-8 lg:!pb-10">
        <div className="w-full px-2 sm:px-3 lg:px-4 2xl:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4"
          >
            <span className="label">Social Trading Signal</span>
            <h1 className="headline text-3xl sm:text-4xl mt-2">SignalScope</h1>
            <p className="text-zinc-400 text-sm font-light mt-2">
              Per-market social signal and historical indicator — live and historical positions
              overlaid with the chatter that called them, mapped to the market they reference.
              Blue dashed = entry line (per position lifetime) · Red dashed = liq. Volume shown on "Position Open" rows.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500">Powered by</span>
              <a
                href={ALFACLUB_ROOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-3 py-1 font-medium text-sky-200 transition hover:bg-sky-400/15"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-sky-900/30 ring-1 ring-sky-300/25">
                  <img
                    src="/protocols/alfaclub.svg"
                    alt="AlfaClub"
                    className="h-4 w-4 object-contain"
                    loading="lazy"
                  />
                </span>
                Room 1659
                <span aria-hidden>↗</span>
              </a>
              <a
                href={VIRTUALS_AGENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200 transition hover:bg-emerald-400/15"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-emerald-900/30 ring-1 ring-emerald-300/25">
                  <img
                    src="/protocols/virtuals.svg"
                    alt="Virtuals"
                    className="h-4 w-4 object-contain"
                    loading="lazy"
                  />
                </span>
                Agent 1213
                <span aria-hidden>↗</span>
              </a>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={effectiveMarket}
                onChange={(event) => setSelectedMarket(event.target.value)}
              >
                {(data?.markets ?? []).map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={String(windowHours)}
                onChange={(event) => setWindowHours(Number(event.target.value) as 24 | 72 | 168)}
              >
                <option value="24">24h</option>
                <option value="72">3d</option>
                <option value="168">7d</option>
              </select>
              <select
                className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={intervalChoice}
                onChange={(event) => setIntervalChoice(event.target.value as IntervalChoice)}
                title="Candle interval — finer intervals spread same-candle messages apart"
              >
                <option value="auto">Auto ({autoIntervalForWindow(windowHours)})</option>
                {isIntervalAllowed('1m', windowHours) && <option value="1m">1m</option>}
                {isIntervalAllowed('3m', windowHours) && <option value="3m">3m</option>}
                {isIntervalAllowed('5m', windowHours) && <option value="5m">5m</option>}
                {isIntervalAllowed('15m', windowHours) && <option value="15m">15m</option>}
                {isIntervalAllowed('30m', windowHours) && <option value="30m">30m</option>}
                {isIntervalAllowed('1h', windowHours) && <option value="1h">1h</option>}
                {isIntervalAllowed('4h', windowHours) && <option value="4h">4h</option>}
              </select>
              <select
                className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={densityMode}
                onChange={(event) => setDensityMode(event.target.value as 'all' | 'major')}
              >
                <option value="all">All events</option>
                <option value="major">Key events only</option>
              </select>
              <select
                className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                value={effectiveChatScope}
                onChange={(event) => {
                  const scope = event.target.value as 'host' | 'all' | 'sender'
                  setChatScope(scope)
                  if (scope !== 'sender') {
                    setSelectedSender(null)
                  } else if (!selectedSender && senderOptions.length > 0) {
                    setSelectedSender(senderOptions[0]!.address)
                  }
                }}
              >
                <option value="all">All room messages</option>
                <option value="host">Host only</option>
                <option value="sender">Specific sender</option>
              </select>
              {effectiveChatScope === 'sender' && (
                <select
                  className="rounded-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5"
                  value={effectiveSelectedSender ?? ''}
                  onChange={(event) => setSelectedSender(event.target.value || null)}
                >
                  {senderOptions.map((option) => (
                    <option key={option.address} value={option.address}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <Button
                variant={settingsOpen ? 'primary' : 'secondary'}
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                System settings
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="btn-compact rounded-full text-xs"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
            {settingsOpen && (
              <div className="mt-3 w-full max-w-md rounded-xl bg-zinc-950/85 p-3 text-xs text-zinc-200 backdrop-blur-sm">
                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Display + filters</div>
                <label className="flex items-center justify-between py-1.5">
                  <span>Trade Markers</span>
                  <input
                    type="checkbox"
                    checked={showTrades}
                    onChange={(event) => setShowTrades(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between py-1.5">
                  <span>Historical Average Entry Path</span>
                  <input
                    type="checkbox"
                    checked={showEntryPath}
                    onChange={(event) => setShowEntryPath(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between py-1.5">
                  <span>Hermit4626bot Comments</span>
                  <input
                    type="checkbox"
                    checked={showHermitComments}
                    onChange={(event) => setShowHermitComments(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between py-1.5">
                  <span>Command Messages (`/hermit`, etc.)</span>
                  <input
                    type="checkbox"
                    checked={showCommandMessages}
                    onChange={(event) => setShowCommandMessages(event.target.checked)}
                  />
                </label>
              </div>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              Message scope controls chat overlays. System settings controls visibility filters and chart overlays.
            </p>
          </motion.div>

          {data && !isLoading && !error && (data.marketSummaries?.length ?? 0) > 0 && (
            <div className="mb-3 space-y-3">
              <PositionsRoomBook
                summaries={data.marketSummaries}
                currentPositions={data.currentPositions}
                selectedMarket={effectiveMarket}
                onSelect={setSelectedMarket}
              />
              <PositionsMarketSignal
                summary={selectedSummary}
                roomPosition={roomCurrentPosition}
                agentPosition={agentCurrentPosition}
                lastPrice={lastPrice}
                roomWideMessageCount={data.roomWideMessageCount ?? 0}
              />
            </div>
          )}

          {/* Trade list (left) + chart (center) + messages/inspector (right) */}
          <div
            className="mt-4 grid gap-3 lg:items-start lg:[grid-template-columns:var(--positions-grid-cols)]"
            style={{ ['--positions-grid-cols' as string]: positionsGridColumns }}
          >
            <div className="rounded-2xl bg-white/[0.03] p-3 sm:p-4 flex flex-col min-h-0 lg:sticky lg:top-6 lg:h-[72vh] lg:min-h-[520px]">
              <div className={`flex gap-2 ${tradePanelCollapsed ? 'flex-col items-center' : 'items-center justify-between'}`}>
                <div className="label shrink-0">
                  {tradePanelCollapsed ? (
                    <>
                      <span aria-hidden className="text-base">📈</span>
                      <span className="sr-only">Trades</span>
                    </>
                  ) : (
                    `Trade events (${filteredTimelineTradeEvents.length})`
                  )}
                </div>
                <button
                  type="button"
                  aria-label={tradePanelCollapsed ? 'Expand trades panel' : 'Collapse trades panel'}
                  onClick={() => setTradePanelCollapsed((value) => !value)}
                  className={`rounded-md bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] ${
                    tradePanelCollapsed ? 'px-2 py-1.5 text-sm leading-none' : 'px-2 py-1 text-[10px]'
                  }`}
                >
                  <span aria-hidden>{tradePanelCollapsed ? '▸' : '▾'}</span>
                  {!tradePanelCollapsed ? <span className="ml-1">Collapse</span> : null}
                </button>
              </div>
              {!tradePanelCollapsed ? (
                <>
                  <div
                    ref={tradeTimelineListRef}
                    className="mt-3 max-h-[48vh] lg:max-h-none lg:flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 [scrollbar-gutter:stable]"
                  >
                    <div className="rounded-lg bg-white/[0.02] p-2">
                      <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Trades ({filteredTimelineTradeEvents.length})
                      </div>
                      <div className="px-1 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500 grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] gap-2">
                        <span className="text-left">AlfaClub</span>
                        <span />
                        <span className="text-right">Virtuals</span>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 -translate-x-1/2 w-px bg-white/10" />
                        <div>
                          {timelineTradeRowsWithSpacing.map(({ event: row, spacerPx }, index) => {
                            const renderCard = (tradeEvent: ChartOverlayEvent) => {
                              const source = tradeSourceMeta(tradeEvent.source)
                              const marketCoin =
                                ((tradeEvent.market ?? effectiveMarket).split('/')[0] ?? '').toUpperCase() || 'TOKEN'
                              const showRealizedPnl =
                                tradeEvent.action === 'close' || tradeEvent.action === 'liquidated'
                              const hasMeaningfulRealizedPnl = Math.abs(tradeEvent.closedPnl ?? 0) >= 0.005
                              const pnlClass = tradeEvent.closedPnl >= 0 ? 'text-emerald-200' : 'text-rose-200'
                              const summaryLine = buildTradeSummaryLine(tradeEvent, marketCoin)
                              return (
                                <div
                                  key={`trade-${tradeEvent.id}-${index}`}
                                  data-event-id={tradeEvent.id}
                                  onClick={() => setSelectedEventId(tradeEvent.id)}
                                  onKeyDown={(keyboardEvent) => {
                                    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                                      keyboardEvent.preventDefault()
                                      setSelectedEventId(tradeEvent.id)
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  className={`relative w-full overflow-hidden text-left rounded-lg p-2 text-xs transition border ${
                                    tradeEvent.source === 'counter'
                                      ? 'border-emerald-300/20 bg-emerald-400/12 hover:bg-emerald-400/16'
                                      : 'border-sky-300/20 bg-sky-400/10 hover:bg-sky-400/14'
                                  } ${
                                    selectedEventId === tradeEvent.id
                                      ? 'ring-1 ring-sky-300/70'
                                      : hoveredEventId === tradeEvent.id
                                        ? 'ring-1 ring-violet-300/55'
                                        : ''
                                  }`}
                                >
                                  <div className="relative space-y-1">
                                    <img
                                      src={source.logo}
                                      alt=""
                                      aria-hidden="true"
                                      className="pointer-events-none absolute -right-5 -top-3 h-20 w-20 select-none object-contain opacity-[0.15]"
                                      loading="lazy"
                                    />
                                    <div className="flex items-center justify-between gap-1.5">
                                      <a
                                        href={source.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                                        className="relative z-[1] inline-flex min-w-0 items-center gap-1.5 text-[12px] font-semibold leading-snug text-zinc-100 underline-offset-2 transition hover:text-white hover:underline"
                                      >
                                        <img
                                          src={source.logo}
                                          alt={source.logoAlt}
                                          className="h-3.5 w-3.5 shrink-0 object-contain"
                                          loading="lazy"
                                        />
                                        <span className="truncate whitespace-nowrap">{describeTradeEventAction(tradeEvent)}</span>
                                      </a>
                                      {showRealizedPnl && hasMeaningfulRealizedPnl ? (
                                        <span className={`relative z-[1] shrink-0 whitespace-nowrap text-[11px] font-medium ${pnlClass}`}>
                                          {tradeEvent.closedPnl >= 0 ? '+' : '-'}
                                          {formatCompactUsd(Math.abs(tradeEvent.closedPnl))}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="relative z-[1] truncate whitespace-nowrap text-[11px] font-semibold leading-tight text-zinc-100">
                                      {summaryLine}
                                    </div>
                                    <div className="relative z-[1] flex items-center justify-end gap-1.5 pt-0.5 flex-nowrap">
                                      <span className="shrink-0 whitespace-nowrap text-[10px] text-zinc-300">
                                        {formatTime(tradeEvent.time)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            const rowKey =
                              row.hostEvent?.id ?? row.counterEvent?.id ?? `timeline-row-${index}`
                            return (
                              <div
                                key={`timeline-row-${rowKey}-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] gap-2"
                                style={{ marginTop: index === 0 ? 0 : spacerPx }}
                              >
                                {row.hostEvent ? renderCard(row.hostEvent) : <div />}
                                <div className="relative flex items-start justify-center">
                                  {row.hostEvent && row.counterEvent ? (
                                    <div className="mt-2 flex flex-col items-center gap-1">
                                      <span className="block h-2 w-2 rounded-full bg-sky-300/80" />
                                      <span className="block h-2 w-2 rounded-full bg-emerald-300/80" />
                                    </div>
                                  ) : (
                                    <span
                                      className={`mt-3 block h-2 w-2 rounded-full ${
                                        row.counterEvent ? 'bg-emerald-300/80' : 'bg-sky-300/80'
                                      }`}
                                    />
                                  )}
                                </div>
                                {row.counterEvent ? renderCard(row.counterEvent) : <div />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              aria-label="Resize trade panel"
              onMouseDown={beginResize('left')}
              onKeyDown={(event) => {
                if (tradePanelCollapsed) return
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  setTradePanelWidth((value) => Math.max(PANEL_MIN_WIDTH, value - 12))
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  setTradePanelWidth((value) => Math.min(PANEL_MAX_WIDTH, value + 12))
                }
              }}
              className={`hidden lg:flex lg:h-[72vh] lg:min-h-[520px] items-stretch justify-center cursor-col-resize select-none bg-transparent p-0 border-0 ${
                tradePanelCollapsed ? 'pointer-events-none opacity-30' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <span
                className={`h-full w-px bg-white/[0.12] transition-colors ${
                  activeResizeSide === 'left' ? 'bg-sky-300/80' : ''
                }`}
              />
            </button>

            <div className="rounded-2xl bg-white/[0.03] p-2 sm:p-3 lg:p-4">
              {isLoading ? (
                <div className="text-sm text-zinc-400">Loading room timeline…</div>
              ) : error ? (
                <div className="text-sm text-red-300">
                  Failed to load timeline: {error instanceof Error ? error.message : 'unknown error'}
                </div>
              ) : (data?.candles.length ?? 0) === 0 ? (
                <div className="text-sm text-zinc-400">No candle data available in this timeframe.</div>
              ) : (
                <div className="space-y-4">
                  <PositionsChartSurface
                    candles={data?.candles ?? []}
                    events={allOverlayEvents}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                    onHoverEvent={setHoveredEventId}
                    marketLabel={effectiveMarket}
                    roomEntryPrice={roomCurrentPosition?.entryPrice ?? null}
                    roomLiqPrice={roomCurrentPosition?.liquidationPrice ?? null}
                    agentEntryPrice={agentCurrentPosition?.entryPrice ?? null}
                    agentLiqPrice={agentCurrentPosition?.liquidationPrice ?? null}
                    roomEntryPathData={showEntryPath ? roomEntryPathData : []}
                    agentEntryPathData={showEntryPath ? agentEntryPathData : []}
                  />
                  <PositionsEventLegend />
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Resize message panel"
              onMouseDown={beginResize('right')}
              onKeyDown={(event) => {
                if (messagePanelCollapsed) return
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  setMessagePanelWidth((value) => Math.min(PANEL_MAX_WIDTH, value + 12))
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  setMessagePanelWidth((value) => Math.max(PANEL_MIN_WIDTH, value - 12))
                }
              }}
              className={`hidden lg:flex lg:h-[72vh] lg:min-h-[520px] items-stretch justify-center cursor-col-resize select-none bg-transparent p-0 border-0 ${
                messagePanelCollapsed ? 'pointer-events-none opacity-30' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <span
                className={`h-full w-px bg-white/[0.12] transition-colors ${
                  activeResizeSide === 'right' ? 'bg-sky-300/80' : ''
                }`}
              />
            </button>

            <div className="flex flex-col gap-3 lg:sticky lg:top-6 self-start lg:h-[72vh] lg:min-h-[520px]">
              <div className="rounded-2xl bg-white/[0.03] p-3 sm:p-4 flex flex-col min-h-0 lg:flex-1">
              <div className={`flex gap-2 ${messagePanelCollapsed ? 'flex-col items-center' : 'items-center justify-between'}`}>
                <div className="label shrink-0">
                  {messagePanelCollapsed ? (
                    <>
                      <span aria-hidden className="text-base">💬</span>
                      <span className="sr-only">Messages</span>
                    </>
                  ) : (
                    `Messages (${filteredTimelineChatEvents.length})`
                  )}
                </div>
                <button
                  type="button"
                  aria-label={messagePanelCollapsed ? 'Expand messages panel' : 'Collapse messages panel'}
                  onClick={() => setMessagePanelCollapsed((value) => !value)}
                  className={`rounded-md bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] ${
                    messagePanelCollapsed ? 'px-2 py-1.5 text-sm leading-none' : 'px-2 py-1 text-[10px]'
                  }`}
                >
                  <span aria-hidden>{messagePanelCollapsed ? '▸' : '▾'}</span>
                  {!messagePanelCollapsed ? <span className="ml-1">Collapse</span> : null}
                </button>
              </div>
              {!messagePanelCollapsed ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(['all', 'host', 'room', 'bot'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setMessageSourceFilter(filter)}
                        className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
                          messageSourceFilter === filter
                            ? 'bg-sky-400/15 text-sky-200'
                            : 'bg-white/[0.05] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <div
                    ref={messageTimelineListRef}
                    className="mt-3 max-h-[48vh] lg:max-h-none lg:flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 [scrollbar-gutter:stable]"
                  >
                    <div className="rounded-lg bg-white/[0.02] p-2">
                      <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Messages ({filteredTimelineChatEvents.length})
                      </div>
                      <div className="space-y-2">
                        {filteredTimelineChatEvents.map((event, index) => (
                          <button
                            key={`chat-${event.id}-${index}`}
                            data-event-id={event.id}
                            type="button"
                            onClick={() => setSelectedEventId(event.id)}
                            className={`w-full text-left rounded-lg p-2.5 text-xs transition ${
                              selectedEventId === event.id
                                ? 'bg-sky-400/10'
                                : hoveredEventId === event.id
                                  ? 'bg-violet-400/10'
                                  : 'bg-white/[0.03] hover:bg-white/[0.05]'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-zinc-300">
                              {event.senderAvatarUrl ? (
                                <span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                                  <span className="absolute inset-0" style={{ background: '#27272a' }} />
                                  <img
                                    src={event.senderAvatarUrl}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                </span>
                              ) : null}
                              <span>
                                {formatTime(event.time)} · {event.market ?? 'all markets'}
                              </span>
                            </div>
                            <div className="mt-1 text-zinc-100">
                              {event.kind === 'host-chat' ? 'Host message' : 'Room message'}
                              {event.senderLabel ? (
                                <span className="ml-1.5 text-[10px] text-zinc-400">· {event.senderLabel}</span>
                              ) : null}
                            </div>
                            {event.text && <div className="mt-1 text-zinc-300">{event.text.slice(0, 180)}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              </div>
              {!messagePanelCollapsed ? (
              <div className="shrink-0">
                <PositionsEventInspector
                  event={selectedEvent ?? null}
                  index={Math.max(0, selectedEventIndex)}
                  total={allOverlayEvents.length}
                  onPrevious={() => stepEvent(-1)}
                  onNext={() => stepEvent(1)}
                  onClear={() => setSelectedEventId(null)}
                />
              </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

