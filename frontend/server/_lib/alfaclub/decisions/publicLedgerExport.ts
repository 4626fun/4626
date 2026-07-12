import { createHash } from 'node:crypto'

import { getDb } from '../../db/postgres.js'
import { ensureAlfaclubDecisionLedgerSchema } from '../../db/schemaBootstrap.js'
import {
  evaluateConditionalInverseEdge,
  type WalkForwardPoint,
} from '../audits/walkForwardSelectiveCounter.js'
import { DECISION_METHODOLOGY_VERSION } from './types.js'

function hashSourceId(value: string | null): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/**
 * Privacy-safe daily JSONL export of settled decisions + Conditional Inverse Edge.
 * Excludes buyer/job/private payloads; hashes external source identifiers.
 */
export async function exportSettledDecisionsJsonl(params?: {
  nowMs?: number
  minSampleForClaims?: number
}): Promise<{
  jsonl: string
  report: ReturnType<typeof evaluateConditionalInverseEdge>
  rowCount: number
}> {
  const db = await getDb()
  const emptyReport = evaluateConditionalInverseEdge({
    points: [],
    methodologyVersion: DECISION_METHODOLOGY_VERSION,
    minSample: params?.minSampleForClaims ?? 100,
  })
  if (!db) return { jsonl: '', report: emptyReport, rowCount: 0 }
  await ensureAlfaclubDecisionLedgerSchema(db)

  const result = await db.sql<{
    decision_id: string
    observed_at: Date | string
    asset: string
    source_id: string | null
    decision: string
    confidence: number | string
    regime_fine: string
    methodology_version: string
    horizon_hours: number | string
    net_bps: number | string | null
    would_have_been_always_inverse_bps: number | string | null
  }>`
    SELECT
      ledger.decision_id,
      ledger.observed_at,
      ledger.asset,
      ledger.source_id,
      ledger.decision,
      ledger.confidence,
      ledger.regime_fine,
      ledger.methodology_version,
      outcome.horizon_hours,
      outcome.net_bps,
      outcome.would_have_been_always_inverse_bps
    FROM alfaclub.decision_ledger AS ledger
    JOIN alfaclub.decision_outcomes AS outcome
      ON outcome.decision_id = ledger.decision_id
    WHERE outcome.status = 'settled'
      AND outcome.horizon_hours = 8
    ORDER BY ledger.observed_at ASC
    LIMIT 5000
  `

  const points: WalkForwardPoint[] = []
  const lines: string[] = []
  for (const row of result.rows) {
    const selective = Number(row.net_bps ?? 0)
    const alwaysInverse = Number(row.would_have_been_always_inverse_bps ?? 0)
    points.push({
      timestampMs: new Date(row.observed_at).getTime(),
      asset: String(row.asset),
      selectiveCounterNetBps: selective,
      alwaysInverseNetBps: alwaysInverse,
    })
    lines.push(
      JSON.stringify({
        decision_id: row.decision_id,
        observed_at: new Date(row.observed_at).toISOString(),
        asset: row.asset,
        source_id_hash: hashSourceId(row.source_id),
        decision: row.decision,
        confidence: Number(row.confidence),
        regime_fine: row.regime_fine,
        methodology_version: row.methodology_version,
        horizon_hours: Number(row.horizon_hours),
        net_bps: selective,
        always_inverse_bps: alwaysInverse,
        conditional_inverse_edge_bps: selective - alwaysInverse,
      }),
    )
  }

  const report = evaluateConditionalInverseEdge({
    points,
    methodologyVersion: DECISION_METHODOLOGY_VERSION,
    minSample: params?.minSampleForClaims ?? 100,
  })

  return {
    jsonl: lines.join('\n'),
    report,
    rowCount: lines.length,
  }
}
