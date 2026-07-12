import { getCandleSnapshot } from '../hyperliquid.js'
import { getDb } from '../../db/postgres.js'
import { ensureAlfaclubDecisionLedgerSchema } from '../../db/schemaBootstrap.js'

type DueOutcomeRow = {
  decision_id: string
  asset: string
  source_side: 'LONG' | 'SHORT'
  decision: 'COUNTER' | 'DELAY' | 'SKIP'
  counter_side: 'LONG' | 'SHORT' | null
  horizon_hours: number | string
  due_at: Date | string
  mark_at_decision: number | string | null
  estimated_cost_bps: number | string | null
}

export type DecisionTargetPrice = { priceUsd: number; priceAtMs: number }

export type DecisionHorizonSettlement = {
  returnBps: number
  fundingPnlBpsEst: number
  costBps: number
  netBps: number
  alwaysInverseBps: number
}

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function sideReturnBps(params: {
  side: 'LONG' | 'SHORT'
  entry: number
  exit: number
}): number {
  const raw = ((params.exit - params.entry) / params.entry) * 10_000
  return params.side === 'LONG' ? raw : -raw
}

/** Pure settlement math used by due-outcome cron; safe for unit tests. */
export function computeDecisionHorizonSettlement(params: {
  sourceSide: 'LONG' | 'SHORT'
  decision: 'COUNTER' | 'DELAY' | 'SKIP'
  counterSide: 'LONG' | 'SHORT' | null
  markAtDecision: number
  markAtHorizon: number
  estimatedCostBps?: number | null
}): DecisionHorizonSettlement {
  const alwaysInverseSide = params.sourceSide === 'LONG' ? 'SHORT' : 'LONG'
  const alwaysInverseBps = sideReturnBps({
    side: alwaysInverseSide,
    entry: params.markAtDecision,
    exit: params.markAtHorizon,
  })
  const decisionSide =
    params.decision === 'COUNTER' && params.counterSide ? params.counterSide : null
  const returnBps = decisionSide
    ? sideReturnBps({
        side: decisionSide,
        entry: params.markAtDecision,
        exit: params.markAtHorizon,
      })
    : 0
  const costBps = Number(params.estimatedCostBps ?? 0) || 0
  const fundingPnlBpsEst = 0
  return {
    returnBps,
    fundingPnlBpsEst,
    costBps,
    netBps: returnBps + fundingPnlBpsEst - costBps,
    alwaysInverseBps,
  }
}

export async function readMarkPriceAt(
  symbol: string,
  targetAtMs: number,
): Promise<DecisionTargetPrice | null> {
  const candles = await getCandleSnapshot({
    coin: symbol,
    interval: '1m',
    startTimeMs: targetAtMs - 60_000,
    endTimeMs: targetAtMs + 120_000,
  })
  const candle = candles
    ?.filter((item) => Number.isFinite(item.close) && item.close > 0)
    .sort((a, b) => Math.abs(a.time - targetAtMs) - Math.abs(b.time - targetAtMs))[0]
  return candle ? { priceUsd: candle.close, priceAtMs: candle.time } : null
}

export async function settleDueDecisionOutcomes(params?: {
  nowMs?: number
  readMarkPriceAt?: (symbol: string, targetAtMs: number) => Promise<DecisionTargetPrice | null>
}): Promise<{
  due: number
  settled: number
  deferred: number
  maxSettlementLagMs: number | null
}> {
  const db = await getDb()
  if (!db) return { due: 0, settled: 0, deferred: 0, maxSettlementLagMs: null }
  await ensureAlfaclubDecisionLedgerSchema(db)

  const nowMs = params?.nowMs ?? Date.now()
  const now = new Date(nowMs)
  const readPrice = params?.readMarkPriceAt ?? readMarkPriceAt
  let maxSettlementLagMs = 0

  const dueResult = await db.sql<DueOutcomeRow>`
    SELECT
      outcome.decision_id,
      ledger.asset,
      ledger.source_side,
      ledger.decision,
      ledger.counter_side,
      outcome.horizon_hours,
      outcome.due_at,
      outcome.mark_at_decision,
      ledger.estimated_cost_bps
    FROM alfaclub.decision_outcomes AS outcome
    JOIN alfaclub.decision_ledger AS ledger
      ON ledger.decision_id = outcome.decision_id
    WHERE outcome.status = 'pending'
      AND outcome.due_at <= ${now}
      AND outcome.mark_at_decision > 0
    ORDER BY outcome.due_at ASC
    LIMIT 500
  `

  let settled = 0
  let deferred = 0
  for (const row of dueResult.rows) {
    const asset = String(row.asset ?? '').trim().toUpperCase()
    const dueAtMs = new Date(row.due_at).getTime()
    let target: DecisionTargetPrice | null = null
    try {
      if (Number.isFinite(dueAtMs)) target = await readPrice(asset, dueAtMs)
    } catch {
      target = null
    }

    const markAtDecision = finitePositive(row.mark_at_decision)
    const markAtHorizon = finitePositive(target?.priceUsd)
    const priceAtMs = target?.priceAtMs ?? Number.NaN
    const horizonHours = Number(row.horizon_hours)
    if (
      markAtDecision == null ||
      markAtHorizon == null ||
      !Number.isInteger(horizonHours) ||
      !Number.isFinite(priceAtMs)
    ) {
      deferred += 1
      continue
    }

    const settlement = computeDecisionHorizonSettlement({
      sourceSide: row.source_side,
      decision: row.decision,
      counterSide: row.counter_side,
      markAtDecision,
      markAtHorizon,
      estimatedCostBps:
        row.estimated_cost_bps == null ? null : Number(row.estimated_cost_bps),
    })
    const { returnBps, fundingPnlBpsEst, costBps, netBps, alwaysInverseBps } = settlement

    const updateResult = await db.sql`
      UPDATE alfaclub.decision_outcomes
      SET settled_at = ${now},
          price_at = ${new Date(priceAtMs)},
          mark_at_horizon = ${markAtHorizon},
          return_bps = ${returnBps},
          funding_pnl_bps_est = ${fundingPnlBpsEst},
          cost_bps_est = ${costBps},
          net_bps = ${netBps},
          would_have_been_always_inverse_bps = ${alwaysInverseBps},
          status = 'settled'
      WHERE decision_id = ${row.decision_id}::uuid
        AND horizon_hours = ${horizonHours}
        AND status = 'pending'
      RETURNING decision_id
    `
    if ((updateResult.rowCount ?? updateResult.rows.length) > 0) {
      settled += 1
      const lagMs = Math.max(0, nowMs - dueAtMs)
      maxSettlementLagMs = Math.max(maxSettlementLagMs, lagMs)
    }
  }

  return {
    due: dueResult.rows.length,
    settled,
    deferred,
    maxSettlementLagMs: settled > 0 ? maxSettlementLagMs : null,
  }
}
