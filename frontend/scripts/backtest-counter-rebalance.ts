#!/usr/bin/env tsx
/**
 * Gradual dual-leg rebalance backtest (no cross-side bridging).
 *
 * Default run:
 *   pnpm -C frontend exec tsx scripts/backtest-counter-rebalance.ts
 *
 * Custom:
 *   pnpm -C frontend exec tsx scripts/backtest-counter-rebalance.ts --symbol BTC --interval 5m --window-hours 168 --leverage 30
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildRoomTimelineData } from '../server/_lib/alfaclub/roomTimeline.js'
import { getDb } from '../server/_lib/db/postgres.js'

type Side = 'long' | 'short'

type LegState = {
  side: Side
  entry: number
  qty: number
  marginUsd: number
  bufferUsd: number
}

type BacktestParams = {
  healthFloor: number
  deadband: number
  minChunkUsd: number
  maxChunkUsd: number
  cooldownBars: number
}

type BacktestConfig = {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  initialLongMarginUsd: number
  initialShortMarginUsd: number
  initialLongBufferUsd: number
  initialShortBufferUsd: number
  minBufferUsdPerSide: number
  feeBps: number
  slippageBps: number
  alpha: number
}

type BacktestResult = {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  params: BacktestParams
  startPrice: number
  endPrice: number
  priceChangePct: number
  finalEquity: number
  realizedPnl: number
  executionCost: number
  rebalanceCount: number
  avgChunkUsd: number
  finalLongQty: number
  finalShortQty: number
  finalLongNotionalUsd: number
  finalShortNotionalUsd: number
  minHealthRoom: number
  minHealthAgent: number
  forcedSkipsInsufficientBuffer: number
  commingleViolationCount: number
  objective: number
}

type BacktestRebalanceAuditRow = {
  runId: string
  stepIndex: number
  mark: number
  weakSide: Side
  strongSide: Side
  weakHealth: number
  healthGap: number
  effectiveMarginChunk: number
  strongMarginBefore: number
  strongMarginAfter: number
  strongBufferBefore: number
  strongBufferAfter: number
  weakMarginBefore: number
  weakMarginAfter: number
  weakBufferBefore: number
  weakBufferAfter: number
  strongReleasedMarginUsd: number
  strongRealizedPnlUsd: number
  weakAddedMarginUsd: number
  executionCostUsd: number
  strongSideSelfFunded: boolean
  weakSideSelfFunded: boolean
  noCrossLegTransfer: boolean
}

function parseArgs(argv: string[]) {
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token || !token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) continue
    map.set(key, next)
    i += 1
  }
  return map
}

function toNum(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseNumberList(
  raw: string | undefined,
  fallback: number[],
  options?: { integer?: boolean; min?: number; max?: number },
): number[] {
  if (!raw) return fallback
  const values = raw
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => (options?.integer ? Math.trunc(n) : n))
    .filter((n) => (options?.min == null ? true : n >= options.min!))
    .filter((n) => (options?.max == null ? true : n <= options.max!))
  if (values.length === 0) return fallback
  const deduped = Array.from(new Set(values))
  deduped.sort((a, b) => a - b)
  return deduped
}

function parseBooleanFlag(raw: string | undefined, defaultValue = false): boolean {
  if (!raw) return defaultValue
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

async function fetchMarksFromSupabaseCache(params: {
  symbol: string
  interval: string
  windowHours: number
}): Promise<number[] | null> {
  if (params.interval !== '1m') return null

  const db = await getDb().catch(() => null)
  if (!db?.query) return null

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - params.windowHours * 60 * 60 * 1000)
  try {
    const sql = `
      SELECT close
      FROM public.backtest_market_bars_1m
      WHERE symbol = $1
        AND interval = '1m'
        AND bar_time >= $2
        AND bar_time <= $3
      ORDER BY bar_time ASC
    `
    const res = await db.query(sql, [params.symbol, startTime.toISOString(), endTime.toISOString()])
    const marks = (res.rows ?? [])
      .map((row) => {
        const value = (row as { close?: unknown }).close
        if (typeof value === 'number') return value
        const n = Number(value)
        return Number.isFinite(n) ? n : NaN
      })
      .filter((n): n is number => Number.isFinite(n) && n > 0)
    return marks
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function chooseIntervalForWindowHours(windowHours: number): string {
  // Match horizon to realistic data depth and signal density:
  // - Intraday/short: 1m
  // - Multi-day: 5m
  // - Medium horizon: 15m
  // - Long horizon: 1h (including ~30d windows)
  if (windowHours <= 24 * 3) return '1m'
  if (windowHours <= 24 * 14) return '5m'
  if (windowHours < 24 * 30) return '15m'
  return '1h'
}

function liqPrice(entry: number, side: Side, leverage: number): number {
  if (side === 'long') return entry * (1 - 1 / leverage)
  return entry * (1 + 1 / leverage)
}

function legHealth(mark: number, leg: LegState, leverage: number): number {
  const liq = liqPrice(leg.entry, leg.side, leverage)
  if (leg.side === 'long') {
    const denom = leg.entry - liq
    if (denom <= 0) return 0
    return (mark - liq) / denom
  }
  const denom = liq - leg.entry
  if (denom <= 0) return 0
  return (liq - mark) / denom
}

function notionalUsd(leg: LegState, mark: number): number {
  return Math.abs(leg.qty) * mark
}

function unrealizedPnlUsd(leg: LegState, mark: number): number {
  if (leg.side === 'long') return leg.qty * (mark - leg.entry)
  return leg.qty * (leg.entry - mark)
}

function reduceLegAtMark(leg: LegState, mark: number, marginToReleaseUsd: number, leverage: number): {
  releasedMarginUsd: number
  realizedPnlUsd: number
  reducedNotionalUsd: number
} {
  const currentNotional = notionalUsd(leg, mark)
  if (currentNotional <= 0 || leg.marginUsd <= 0 || leg.qty <= 0) {
    return { releasedMarginUsd: 0, realizedPnlUsd: 0, reducedNotionalUsd: 0 }
  }
  const release = clamp(marginToReleaseUsd, 0, leg.marginUsd)
  const reducedNotional = clamp(release * leverage, 0, currentNotional)
  const reducedQty = reducedNotional / mark
  const share = reducedQty / leg.qty
  const realized = unrealizedPnlUsd(leg, mark) * share
  leg.qty = Math.max(0, leg.qty - reducedQty)
  leg.marginUsd = Math.max(0, leg.marginUsd - release)
  if (leg.qty <= 1e-12) {
    leg.qty = 0
    leg.marginUsd = 0
  }
  return { releasedMarginUsd: release, realizedPnlUsd: realized, reducedNotionalUsd: reducedNotional }
}

function addLegAtMark(leg: LegState, mark: number, marginToAddUsd: number, leverage: number): {
  addedNotionalUsd: number
} {
  const addMargin = Math.max(0, marginToAddUsd)
  if (addMargin <= 0) return { addedNotionalUsd: 0 }
  const addNotional = addMargin * leverage
  const addQty = addNotional / mark
  const newQty = leg.qty + addQty
  leg.entry = newQty > 0 ? (leg.entry * leg.qty + mark * addQty) / newQty : mark
  leg.qty = newQty
  leg.marginUsd += addMargin
  return { addedNotionalUsd: addNotional }
}

function computeEquity(leg: LegState, mark: number): number {
  return leg.bufferUsd + leg.marginUsd + unrealizedPnlUsd(leg, mark)
}

function runBacktest(
  marks: number[],
  config: BacktestConfig,
  params: BacktestParams,
  runId: string,
): { result: BacktestResult; auditRows: BacktestRebalanceAuditRow[] } {
  const entry = marks[0] ?? 0
  const initLongNotional = config.initialLongMarginUsd * config.leverage
  const initShortNotional = config.initialShortMarginUsd * config.leverage
  const initLongQty = entry > 0 ? initLongNotional / entry : 0
  const initShortQty = entry > 0 ? initShortNotional / entry : 0
  const room: LegState = {
    side: 'long',
    entry,
    qty: initLongQty,
    marginUsd: config.initialLongMarginUsd,
    bufferUsd: config.initialLongBufferUsd,
  }
  const agent: LegState = {
    side: 'short',
    entry,
    qty: initShortQty,
    marginUsd: config.initialShortMarginUsd,
    bufferUsd: config.initialShortBufferUsd,
  }

  let realizedPnl = 0
  let executionCost = 0
  let rebalanceCount = 0
  let chunkSum = 0
  let cooldown = 0
  let minHealthRoom = Number.POSITIVE_INFINITY
  let minHealthAgent = Number.POSITIVE_INFINITY
  let forcedSkipsInsufficientBuffer = 0
  let commingleViolationCount = 0
  const auditRows: BacktestRebalanceAuditRow[] = []

  for (const mark of marks) {
    const hr = legHealth(mark, room, config.leverage)
    const ha = legHealth(mark, agent, config.leverage)
    minHealthRoom = Math.min(minHealthRoom, hr)
    minHealthAgent = Math.min(minHealthAgent, ha)

    if (cooldown > 0) {
      cooldown -= 1
      continue
    }

    const weak = hr <= ha ? room : agent
    const strong = hr <= ha ? agent : room
    const weakHealth = Math.min(hr, ha)
    const gap = Math.abs(hr - ha)
    if (weakHealth >= params.healthFloor || gap <= params.deadband) continue

    const weakNotional = notionalUsd(weak, mark)
    const proposed = clamp(
      config.alpha * (params.healthFloor - weakHealth) * Math.max(weakNotional, 1),
      params.minChunkUsd,
      params.maxChunkUsd,
    )

    const strongReleaseCap = Math.max(0, strong.marginUsd)
    const weakBufferCap = Math.max(0, weak.bufferUsd - config.minBufferUsdPerSide)
    const effectiveMarginChunk = Math.min(proposed, strongReleaseCap, weakBufferCap)
    if (effectiveMarginChunk <= 1e-9) {
      forcedSkipsInsufficientBuffer += 1
      continue
    }

    const strongMarginBefore = strong.marginUsd
    const strongBufferBefore = strong.bufferUsd
    const weakMarginBefore = weak.marginUsd
    const weakBufferBefore = weak.bufferUsd

    const reduced = reduceLegAtMark(strong, mark, effectiveMarginChunk, config.leverage)
    strong.bufferUsd += reduced.releasedMarginUsd + reduced.realizedPnlUsd
    realizedPnl += reduced.realizedPnlUsd

    weak.bufferUsd -= effectiveMarginChunk
    const added = addLegAtMark(weak, mark, effectiveMarginChunk, config.leverage)

    const tradedNotional = reduced.reducedNotionalUsd + added.addedNotionalUsd
    const frictionBps = config.feeBps + config.slippageBps
    const cost = tradedNotional * (frictionBps / 10_000)
    strong.bufferUsd -= cost
    executionCost += cost

    const strongMarginAfter = strong.marginUsd
    const strongBufferAfter = strong.bufferUsd
    const weakMarginAfter = weak.marginUsd
    const weakBufferAfter = weak.bufferUsd

    // Invariant checks:
    // - strong side margin must decrease by released margin only
    // - weak side margin increase is funded by weak-side buffer only
    // - no direct cross-leg cash transfer
    const eps = 1e-6
    const strongMarginDelta = strongMarginAfter - strongMarginBefore
    const weakMarginDelta = weakMarginAfter - weakMarginBefore
    const weakBufferDelta = weakBufferAfter - weakBufferBefore
    const strongSideSelfFunded = Math.abs(strongMarginDelta + reduced.releasedMarginUsd) <= eps
    const weakSideSelfFunded =
      Math.abs(weakMarginDelta - effectiveMarginChunk) <= eps &&
      Math.abs(weakBufferDelta + effectiveMarginChunk) <= eps
    const noCrossLegTransfer = strongSideSelfFunded && weakSideSelfFunded
    if (!noCrossLegTransfer) commingleViolationCount += 1

    auditRows.push({
      runId,
      stepIndex: rebalanceCount + 1,
      mark,
      weakSide: weak.side,
      strongSide: strong.side,
      weakHealth,
      healthGap: gap,
      effectiveMarginChunk,
      strongMarginBefore,
      strongMarginAfter,
      strongBufferBefore,
      strongBufferAfter,
      weakMarginBefore,
      weakMarginAfter,
      weakBufferBefore,
      weakBufferAfter,
      strongReleasedMarginUsd: reduced.releasedMarginUsd,
      strongRealizedPnlUsd: reduced.realizedPnlUsd,
      weakAddedMarginUsd: effectiveMarginChunk,
      executionCostUsd: cost,
      strongSideSelfFunded,
      weakSideSelfFunded,
      noCrossLegTransfer,
    })

    rebalanceCount += 1
    chunkSum += effectiveMarginChunk
    cooldown = params.cooldownBars
  }

  const finalMark = marks[marks.length - 1] ?? entry
  const finalEquity = computeEquity(room, finalMark) + computeEquity(agent, finalMark)
  const avgChunkUsd = rebalanceCount > 0 ? chunkSum / rebalanceCount : 0
  const finalLongNotionalUsd = notionalUsd(room, finalMark)
  const finalShortNotionalUsd = notionalUsd(agent, finalMark)
  const priceChangePct = entry > 0 ? (finalMark - entry) / entry : 0
  const riskPenalty = Math.max(0, 0.7 - Math.min(minHealthRoom, minHealthAgent)) * 1_000
  const turnoverPenalty = rebalanceCount * 0.5
  const objective = finalEquity - executionCost - riskPenalty - turnoverPenalty

  const result: BacktestResult = {
    symbol: config.symbol,
    interval: config.interval,
    windowHours: config.windowHours,
    leverage: config.leverage,
    params,
    startPrice: entry,
    endPrice: finalMark,
    priceChangePct,
    finalEquity,
    realizedPnl,
    executionCost,
    rebalanceCount,
    avgChunkUsd,
    finalLongQty: room.qty,
    finalShortQty: agent.qty,
    finalLongNotionalUsd,
    finalShortNotionalUsd,
    minHealthRoom: Number.isFinite(minHealthRoom) ? minHealthRoom : 0,
    minHealthAgent: Number.isFinite(minHealthAgent) ? minHealthAgent : 0,
    forcedSkipsInsufficientBuffer,
    commingleViolationCount,
    objective,
  }
  return { result, auditRows }
}

function toCsv(results: BacktestResult[]): string {
  const header = [
    'symbol',
    'interval',
    'windowHours',
    'leverage',
    'healthFloor',
    'deadband',
    'minChunkUsd',
    'maxChunkUsd',
    'cooldownBars',
    'startPrice',
    'endPrice',
    'priceChangePct',
    'finalEquity',
    'realizedPnl',
    'executionCost',
    'rebalanceCount',
    'avgChunkUsd',
    'finalLongQty',
    'finalShortQty',
    'finalLongNotionalUsd',
    'finalShortNotionalUsd',
    'minHealthRoom',
    'minHealthAgent',
    'forcedSkipsInsufficientBuffer',
    'commingleViolationCount',
    'objective',
  ].join(',')
  const rows = results.map((r) =>
    [
      r.symbol,
      r.interval,
      r.windowHours,
      r.leverage,
      r.params.healthFloor,
      r.params.deadband,
      r.params.minChunkUsd,
      r.params.maxChunkUsd,
      r.params.cooldownBars,
      r.startPrice.toFixed(4),
      r.endPrice.toFixed(4),
      r.priceChangePct.toFixed(8),
      r.finalEquity.toFixed(4),
      r.realizedPnl.toFixed(4),
      r.executionCost.toFixed(4),
      r.rebalanceCount,
      r.avgChunkUsd.toFixed(4),
      r.finalLongQty.toFixed(8),
      r.finalShortQty.toFixed(8),
      r.finalLongNotionalUsd.toFixed(4),
      r.finalShortNotionalUsd.toFixed(4),
      r.minHealthRoom.toFixed(6),
      r.minHealthAgent.toFixed(6),
      r.forcedSkipsInsufficientBuffer,
      r.commingleViolationCount,
      r.objective.toFixed(4),
    ].join(','),
  )
  return `${header}\n${rows.join('\n')}\n`
}

function toAuditCsv(rows: BacktestRebalanceAuditRow[]): string {
  const header = [
    'runId',
    'stepIndex',
    'mark',
    'weakSide',
    'strongSide',
    'weakHealth',
    'healthGap',
    'effectiveMarginChunk',
    'strongMarginBefore',
    'strongMarginAfter',
    'strongBufferBefore',
    'strongBufferAfter',
    'weakMarginBefore',
    'weakMarginAfter',
    'weakBufferBefore',
    'weakBufferAfter',
    'strongReleasedMarginUsd',
    'strongRealizedPnlUsd',
    'weakAddedMarginUsd',
    'executionCostUsd',
    'strongSideSelfFunded',
    'weakSideSelfFunded',
    'noCrossLegTransfer',
  ].join(',')
  const lines = rows.map((row) =>
    [
      row.runId,
      row.stepIndex,
      row.mark.toFixed(6),
      row.weakSide,
      row.strongSide,
      row.weakHealth.toFixed(8),
      row.healthGap.toFixed(8),
      row.effectiveMarginChunk.toFixed(6),
      row.strongMarginBefore.toFixed(6),
      row.strongMarginAfter.toFixed(6),
      row.strongBufferBefore.toFixed(6),
      row.strongBufferAfter.toFixed(6),
      row.weakMarginBefore.toFixed(6),
      row.weakMarginAfter.toFixed(6),
      row.weakBufferBefore.toFixed(6),
      row.weakBufferAfter.toFixed(6),
      row.strongReleasedMarginUsd.toFixed(6),
      row.strongRealizedPnlUsd.toFixed(6),
      row.weakAddedMarginUsd.toFixed(6),
      row.executionCostUsd.toFixed(6),
      row.strongSideSelfFunded ? 'true' : 'false',
      row.weakSideSelfFunded ? 'true' : 'false',
      row.noCrossLegTransfer ? 'true' : 'false',
    ].join(','),
  )
  return `${header}\n${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const windowHours = toNum(args.get('window-hours'), 24 * 7)
  const requestedInterval = (args.get('interval') ?? '').trim().toLowerCase()
  const interval =
    requestedInterval && requestedInterval !== 'auto'
      ? requestedInterval
      : chooseIntervalForWindowHours(windowHours)

  const config: BacktestConfig = {
    symbol: (args.get('symbol') ?? 'BTC').toUpperCase(),
    interval,
    windowHours,
    leverage: toNum(args.get('leverage'), 30),
    initialLongMarginUsd: toNum(
      args.get('initial-long-margin-usd'),
      toNum(args.get('initial-margin-usd'), 500),
    ),
    initialShortMarginUsd: toNum(
      args.get('initial-short-margin-usd'),
      toNum(args.get('initial-margin-usd'), 500),
    ),
    initialLongBufferUsd: toNum(
      args.get('initial-long-buffer-usd'),
      toNum(args.get('initial-buffer-usd'), 1000),
    ),
    initialShortBufferUsd: toNum(
      args.get('initial-short-buffer-usd'),
      toNum(args.get('initial-buffer-usd'), 1000),
    ),
    minBufferUsdPerSide: toNum(args.get('min-buffer-usd'), 200),
    feeBps: toNum(args.get('fee-bps'), 5),
    slippageBps: toNum(args.get('slippage-bps'), 3),
    alpha: toNum(args.get('alpha'), 0.2),
  }

  const cachedMarks = await fetchMarksFromSupabaseCache({
    symbol: config.symbol,
    interval: config.interval,
    windowHours: config.windowHours,
  })
  const marksFromCache = cachedMarks ?? []
  let marks: number[] = marksFromCache
  let marksSource: 'supabase' | 'live' = 'supabase'
  if (marks.length < 20) {
    const timeline = await buildRoomTimelineData({
      roomId: '1659',
      symbol: config.symbol,
      interval: config.interval,
      windowHours: config.windowHours,
    })
    marks = (timeline.candles ?? [])
      .map((c) => c.close)
      .filter((n): n is number => Number.isFinite(n) && n > 0)
    marksSource = 'live'
  }
  if (marks.length < 20) {
    throw new Error(`Not enough candle data for backtest (${marks.length})`)
  }

  console.log(
    `[backtest-counter-rebalance] interval=${config.interval} windowHours=${config.windowHours} candles=${marks.length} source=${marksSource}`,
  )

  const floors = parseNumberList(args.get('floors'), [0.7, 0.75, 0.8], { min: 0.1, max: 3 })
  const deadbands = parseNumberList(args.get('deadbands'), [0.08, 0.12, 0.16], { min: 0, max: 1 })
  const minChunks = parseNumberList(args.get('min-chunks'), [100, 250, 500], { integer: true, min: 1 })
  const maxChunks = parseNumberList(args.get('max-chunks'), [400, 800], { integer: true, min: 1 })
  const cooldownBars = parseNumberList(args.get('cooldowns'), [3, 6, 12], { integer: true, min: 0, max: 10_000 })
  const requireNoCommingle = parseBooleanFlag(args.get('require-no-commingle'), false)

  const results: BacktestResult[] = []
  const auditRows: BacktestRebalanceAuditRow[] = []
  for (const floor of floors) {
    for (const deadband of deadbands) {
      for (const minChunk of minChunks) {
        for (const maxChunk of maxChunks) {
          if (maxChunk < minChunk) continue
          for (const cooldown of cooldownBars) {
            const runId = `${config.symbol}-${config.interval}-${config.windowHours}-${config.leverage}-${floor}-${deadband}-${minChunk}-${maxChunk}-${cooldown}`
            const { result, auditRows: runAuditRows } = runBacktest(
              marks,
              config,
              {
                healthFloor: floor,
                deadband,
                minChunkUsd: minChunk,
                maxChunkUsd: maxChunk,
                cooldownBars: cooldown,
              },
              runId,
            )
            results.push(result)
            auditRows.push(...runAuditRows)
          }
        }
      }
    }
  }

  if (results.length === 0) {
    throw new Error(
      'No parameter sets were generated. Ensure max-chunks >= min-chunks and numeric sweep lists are valid.',
    )
  }

  results.sort((a, b) => b.objective - a.objective)
  const top = results.slice(0, 10)
  console.log('\nTop parameter sets (by objective):')
  for (const [idx, r] of top.entries()) {
    console.log(
      `${idx + 1}. floor=${r.params.healthFloor} deadband=${r.params.deadband} chunk=${r.params.minChunkUsd}-${r.params.maxChunkUsd} cooldown=${r.params.cooldownBars} | objective=${r.objective.toFixed(2)} equity=${r.finalEquity.toFixed(2)} trades=${r.rebalanceCount}`,
    )
  }

  const outDir = resolve(process.cwd(), 'tmp', 'backtests')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(
    outDir,
    `counter-rebalance-${config.symbol}-x${config.leverage}-${Date.now()}.csv`,
  )
  const auditPath = outPath.replace(/\.csv$/, '-rebalances.csv')
  writeFileSync(outPath, toCsv(results), 'utf8')
  writeFileSync(auditPath, toAuditCsv(auditRows), 'utf8')
  console.log(`\nSaved sweep CSV: ${outPath}`)
  console.log(`Saved rebalance audit CSV: ${auditPath}`)

  if (requireNoCommingle) {
    const violatingRuns = results.filter((row) => row.commingleViolationCount > 0)
    if (violatingRuns.length > 0) {
      const totalViolations = violatingRuns.reduce((sum, row) => sum + row.commingleViolationCount, 0)
      throw new Error(
        `No-commingle requirement failed: ${violatingRuns.length}/${results.length} parameter sets had cross-leg violations (${totalViolations} total). See ${auditPath}`,
      )
    }
    console.log('No-commingle requirement passed: zero cross-leg violations across all parameter sets.')
  }
}

void main().catch((err) => {
  console.error('[backtest-counter-rebalance] failed:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})

