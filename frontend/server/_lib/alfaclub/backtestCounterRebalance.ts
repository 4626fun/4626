/**
 * Gradual dual-leg rebalance backtest (no cross-side bridging).
 * Used by the CLI script and `/api/v1/alfaclub/backtest-run`.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  chooseBacktestInterval,
  clampBacktestHealthFloor,
  parseBacktestInterval,
} from './backtestIntervalPolicy.js'
import { loadFinestBacktestMarketBars } from './backtestMarketBars.js'
import {
  downsampleBacktestSeries,
  type BacktestSeriesPoint,
} from './backtestSeriesDownsample.js'

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
  liquidationCount: number
  objective: number
}

export type BacktestRebalanceEvent = {
  t: number
  mark: number
  weakSide: Side
  strongSide: Side
  weakHealth: number
  healthGap: number
  chunkUsd: number
  executionCostUsd: number
}

type BacktestRebalanceAuditRow = {
  runId: string
  stepIndex: number
  t: number
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function liqPrice(entry: number, side: Side, leverage: number): number {
  if (side === 'long') return entry * (1 - 1 / leverage)
  return entry * (1 + 1 / leverage)
}

function legHealth(mark: number, leg: LegState, leverage: number): number {
  if (leg.qty <= 0) return 1
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

/** Isolated-margin liquidation: wipe open leg when health <= 0 (prevents unrealized loss beyond posted margin). */
function liquidateLegIfNeeded(
  leg: LegState,
  mark: number,
  leverage: number,
): { liquidated: boolean; marginLostUsd: number } {
  if (leg.qty <= 0 || leg.marginUsd <= 0) return { liquidated: false, marginLostUsd: 0 }
  const health = legHealth(mark, leg, leverage)
  if (health > 0) return { liquidated: false, marginLostUsd: 0 }
  const marginLostUsd = leg.marginUsd
  leg.qty = 0
  leg.marginUsd = 0
  return { liquidated: true, marginLostUsd }
}

type BacktestRunOutput = {
  result: BacktestResult
  auditRows: BacktestRebalanceAuditRow[]
  rebalanceEvents: BacktestRebalanceEvent[]
  series?: BacktestSeriesPoint[]
}

function runBacktest(
  marks: number[],
  timesMs: number[],
  config: BacktestConfig,
  params: BacktestParams,
  runId: string,
  options?: { captureSeries?: boolean },
): BacktestRunOutput {
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
  let liquidationCount = 0
  const auditRows: BacktestRebalanceAuditRow[] = []
  const rebalanceEvents: BacktestRebalanceEvent[] = []
  const series: BacktestSeriesPoint[] = []

  for (let barIndex = 0; barIndex < marks.length; barIndex += 1) {
    const mark = marks[barIndex] ?? 0
    const barTimeMs = timesMs[barIndex] ?? barIndex

    for (const leg of [room, agent]) {
      const { liquidated, marginLostUsd } = liquidateLegIfNeeded(leg, mark, config.leverage)
      if (liquidated) {
        liquidationCount += 1
        realizedPnl -= marginLostUsd
      }
    }

    const hr = legHealth(mark, room, config.leverage)
    const ha = legHealth(mark, agent, config.leverage)
    minHealthRoom = Math.min(minHealthRoom, hr)
    minHealthAgent = Math.min(minHealthAgent, ha)

    let rebalancedThisBar = false

    if (cooldown > 0) {
      cooldown -= 1
    } else {
      const weak = hr <= ha ? room : agent
      const strong = hr <= ha ? agent : room
      const weakHealth = Math.min(hr, ha)
      const gap = Math.abs(hr - ha)
      if (weakHealth < params.healthFloor && gap > params.deadband) {
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
        } else {

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
          strong.bufferUsd = Math.max(0, strong.bufferUsd - cost)
          executionCost += cost

          const strongMarginAfter = strong.marginUsd
          const strongBufferAfter = strong.bufferUsd
          const weakMarginAfter = weak.marginUsd
          const weakBufferAfter = weak.bufferUsd

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

          rebalancedThisBar = true
          rebalanceEvents.push({
            t: barTimeMs,
            mark,
            weakSide: weak.side,
            strongSide: strong.side,
            weakHealth,
            healthGap: gap,
            chunkUsd: effectiveMarginChunk,
            executionCostUsd: cost,
          })
          auditRows.push({
            runId,
            stepIndex: barIndex,
            t: barTimeMs,
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
      }
    }

    if (options?.captureSeries) {
      series.push({
        t: timesMs[barIndex] ?? barIndex,
        mark,
        equity: computeEquity(room, mark) + computeEquity(agent, mark),
        longHealth: legHealth(mark, room, config.leverage),
        shortHealth: legHealth(mark, agent, config.leverage),
        ...(rebalancedThisBar ? { rebalance: true } : {}),
      })
    }
  }

  const finalMark = marks[marks.length - 1] ?? entry
  const finalEquity = computeEquity(room, finalMark) + computeEquity(agent, finalMark)
  const avgChunkUsd = rebalanceCount > 0 ? chunkSum / rebalanceCount : 0
  const finalLongNotionalUsd = notionalUsd(room, finalMark)
  const finalShortNotionalUsd = notionalUsd(agent, finalMark)
  const priceChangePct = entry > 0 ? (finalMark - entry) / entry : 0
  const riskPenalty = Math.max(0, 0.7 - Math.min(minHealthRoom, minHealthAgent)) * 1_000
  const turnoverPenalty = rebalanceCount * 0.5
  // executionCost is already deducted from leg buffers during simulation — do not subtract twice.
  const objective = finalEquity - riskPenalty - turnoverPenalty

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
    liquidationCount,
    objective,
  }
  return {
    result,
    auditRows,
    rebalanceEvents,
    series: options?.captureSeries ? series : undefined,
  }
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
    'liquidationCount',
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
      r.liquidationCount,
      r.objective.toFixed(4),
    ].join(','),
  )
  return `${header}\n${rows.join('\n')}\n`
}

function toAuditCsv(rows: BacktestRebalanceAuditRow[]): string {
  const header = [
    'runId',
    'stepIndex',
    't',
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
      row.t,
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

export type BacktestCounterRebalanceInput = {
  symbol: string
  interval: string
  windowHours: number
  leverage: number
  initialLongMarginUsd: number
  initialShortMarginUsd: number
  initialLongBufferUsd: number
  initialShortBufferUsd: number
  healthFloor: number
  deadband: number
  minChunkUsd: number
  maxChunkUsd: number
  cooldownBars: number
  requireNoCommingle: boolean
  /** Optional multi-value sweeps (CLI). When omitted, only the scalar fields above run once. */
  healthFloors?: number[]
  deadbands?: number[]
  minChunks?: number[]
  maxChunks?: number[]
  cooldownBarsList?: number[]
  outDir?: string
}

export type BacktestCounterRebalanceOutput = {
  stdout: string
  resolvedInterval: string
  sweepBasename: string | null
  series: Record<string, unknown> | null
}

function resolveBacktestOutDir(explicit?: string): string {
  if (explicit?.trim()) return resolve(explicit)
  if (process.env.VERCEL) return resolve(tmpdir(), '4626-backtests')
  return resolve(process.cwd(), 'tmp', 'backtests')
}

export async function executeBacktestCounterRebalance(
  input: BacktestCounterRebalanceInput,
): Promise<BacktestCounterRebalanceOutput> {
  const logLines: string[] = []
  const log = (line: string) => {
    logLines.push(line)
    console.log(line)
  }

  const windowHours = input.windowHours
  const requestedInterval = input.interval.trim().toLowerCase()
  const interval =
    requestedInterval && requestedInterval !== 'auto'
      ? parseBacktestInterval(requestedInterval, windowHours)
      : chooseBacktestInterval(windowHours)

  const config: BacktestConfig = {
    symbol: input.symbol.toUpperCase(),
    interval,
    windowHours,
    leverage: input.leverage,
    initialLongMarginUsd: input.initialLongMarginUsd,
    initialShortMarginUsd: input.initialShortMarginUsd,
    initialLongBufferUsd: input.initialLongBufferUsd,
    initialShortBufferUsd: input.initialShortBufferUsd,
    minBufferUsdPerSide: 200,
    feeBps: 5,
    slippageBps: 3,
    alpha: 0.2,
  }

  const marketBars = await loadFinestBacktestMarketBars({
    symbol: config.symbol,
    windowHours: config.windowHours,
    preferInterval:
      requestedInterval && requestedInterval !== 'auto'
        ? parseBacktestInterval(requestedInterval, config.windowHours)
        : undefined,
  })
  config.interval = marketBars.interval
  const marks = marketBars.bars.map((bar) => bar.close)
  const timesMs = marketBars.bars.map((bar) => bar.timeMs)

  log(
    `[backtest-counter-rebalance] interval=${config.interval} windowHours=${config.windowHours} candles=${marks.length} source=${marketBars.source} coverage=${(marketBars.coverageRatio * 100).toFixed(1)}%`,
  )

  const floors = (input.healthFloors ?? [input.healthFloor]).map(clampBacktestHealthFloor)
  const deadbands = input.deadbands ?? [input.deadband]
  const scalarFloor = clampBacktestHealthFloor(input.healthFloor)
  if (scalarFloor !== input.healthFloor) {
    log(
      `[backtest-counter-rebalance] health floor clamped ${input.healthFloor} → ${scalarFloor} (health is ~1.0 at entry, 0 at liquidation)`,
    )
  }
  const minChunks = input.minChunks ?? [input.minChunkUsd]
  const maxChunks = input.maxChunks ?? [input.maxChunkUsd]
  const cooldownBarsList = input.cooldownBarsList ?? [input.cooldownBars]
  const requireNoCommingle = input.requireNoCommingle

  const results: BacktestResult[] = []
  const auditRows: BacktestRebalanceAuditRow[] = []
  for (const floor of floors) {
    for (const deadband of deadbands) {
      for (const minChunk of minChunks) {
        for (const maxChunk of maxChunks) {
          if (maxChunk < minChunk) continue
          for (const cooldown of cooldownBarsList) {
            const runId = `${config.symbol}-${config.interval}-${config.windowHours}-${config.leverage}-${floor}-${deadband}-${minChunk}-${maxChunk}-${cooldown}`
            const { result, auditRows: runAuditRows } = runBacktest(
              marks,
              timesMs,
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
  log('\nTop parameter sets (by objective):')
  for (const [idx, r] of top.entries()) {
    log(
      `${idx + 1}. floor=${r.params.healthFloor} deadband=${r.params.deadband} chunk=${r.params.minChunkUsd}-${r.params.maxChunkUsd} cooldown=${r.params.cooldownBars} | objective=${r.objective.toFixed(2)} equity=${r.finalEquity.toFixed(2)} trades=${r.rebalanceCount}`,
    )
  }

  const outDir = resolveBacktestOutDir(input.outDir)
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(
    outDir,
    `counter-rebalance-${config.symbol}-x${config.leverage}-${Date.now()}.csv`,
  )
  const auditPath = outPath.replace(/\.csv$/, '-rebalances.csv')
  const seriesPath = outPath.replace(/\.csv$/, '-series.json')
  writeFileSync(outPath, toCsv(results), 'utf8')
  writeFileSync(auditPath, toAuditCsv(auditRows), 'utf8')

  const topResult = results[0]
  let seriesPayload: Record<string, unknown> | null = null
  if (topResult) {
    const topRunId = `${config.symbol}-${config.interval}-${config.windowHours}-${config.leverage}-${topResult.params.healthFloor}-${topResult.params.deadband}-${topResult.params.minChunkUsd}-${topResult.params.maxChunkUsd}-${topResult.params.cooldownBars}`
    const { series: rawSeries, rebalanceEvents: topRebalanceEvents } = runBacktest(
      marks,
      timesMs,
      config,
      topResult.params,
      topRunId,
      { captureSeries: true },
    )
    const initialCapital =
      config.initialLongMarginUsd +
      config.initialLongBufferUsd +
      config.initialShortMarginUsd +
      config.initialShortBufferUsd
    const downsampled = downsampleBacktestSeries(rawSeries ?? [], 4_000)
    seriesPayload = {
      runId: topRunId,
      symbol: config.symbol,
      interval: config.interval,
      windowHours: config.windowHours,
      leverage: config.leverage,
      dataQuality: {
        source: marketBars.source,
        barCount: marks.length,
        expectedBars: marketBars.expectedBars,
        coveragePct: marketBars.coverageRatio,
      },
      summary: {
        initialCapital,
        finalEquity: topResult.finalEquity,
        returnPct: initialCapital > 0 ? (topResult.finalEquity - initialCapital) / initialCapital : 0,
        rebalanceCount: topResult.rebalanceCount,
        commingleViolationCount: topResult.commingleViolationCount,
        minHealthLong: topResult.minHealthRoom,
        minHealthShort: topResult.minHealthAgent,
        startPrice: topResult.startPrice,
        endPrice: topResult.endPrice,
        priceChangePct: topResult.priceChangePct,
        liquidationCount: topResult.liquidationCount,
        realizedPnl: topResult.realizedPnl,
        executionCost: topResult.executionCost,
        forcedSkipsInsufficientBuffer: topResult.forcedSkipsInsufficientBuffer,
        objective: topResult.objective,
      },
      rebalanceEvents: topRebalanceEvents,
      points: downsampled,
    }
    writeFileSync(seriesPath, JSON.stringify(seriesPayload), 'utf8')
  }

  log(`\nSaved sweep CSV: ${outPath}`)
  log(`Saved rebalance audit CSV: ${auditPath}`)
  if (topResult) log(`Saved playback series JSON: ${seriesPath}`)

  if (requireNoCommingle) {
    const violatingRuns = results.filter((row) => row.commingleViolationCount > 0)
    if (violatingRuns.length > 0) {
      const totalViolations = violatingRuns.reduce((sum, row) => sum + row.commingleViolationCount, 0)
      throw new Error(
        `No-commingle requirement failed: ${violatingRuns.length}/${results.length} parameter sets had cross-leg violations (${totalViolations} total). See ${auditPath}`,
      )
    }
    log('No-commingle requirement passed: zero cross-leg violations across all parameter sets.')
  }

  const sweepBasename = outPath.split(/[/\\]/).pop() ?? null
  return {
    stdout: logLines.join('\n'),
    resolvedInterval: config.interval,
    sweepBasename,
    series: seriesPayload,
  }
}

export async function runBacktestCounterRebalanceCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv)
  const windowHours = toNum(args.get('window-hours'), 24 * 7)
  await executeBacktestCounterRebalance({
    symbol: (args.get('symbol') ?? 'BTC').toUpperCase(),
    interval: (args.get('interval') ?? 'auto').trim().toLowerCase(),
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
    healthFloor: 0.7,
    deadband: 0.08,
    minChunkUsd: 500,
    maxChunkUsd: 800,
    cooldownBars: 3,
    healthFloors: parseNumberList(args.get('floors'), [0.7, 0.75, 0.8], { min: 0.1, max: 3 }),
    deadbands: parseNumberList(args.get('deadbands'), [0.08, 0.12, 0.16], { min: 0, max: 1 }),
    minChunks: parseNumberList(args.get('min-chunks'), [100, 250, 500], { integer: true, min: 1 }),
    maxChunks: parseNumberList(args.get('max-chunks'), [400, 800], { integer: true, min: 1 }),
    cooldownBarsList: parseNumberList(args.get('cooldowns'), [3, 6, 12], { integer: true, min: 0, max: 10_000 }),
    requireNoCommingle: parseBooleanFlag(args.get('require-no-commingle'), false),
  })
}

