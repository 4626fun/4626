import { randomUUID } from 'node:crypto'

import { getDb } from '../../db/postgres.js'
import { ensureAlfaclubDecisionLedgerSchema } from '../../db/schemaBootstrap.js'
import type { DecisionRecord } from './types.js'

const OUTCOME_HORIZONS = [1, 4, 8, 24] as const
const SOURCE_PROVIDER = 'inverse-akita-decision'

export async function recordDecisionLedgerEntry(params: {
  decision: DecisionRecord
  idempotencyKey: string
  acpJobId?: string | null
}): Promise<{ decisionId: string | null; inserted: boolean }> {
  const db = await getDb()
  if (!db) return { decisionId: null, inserted: false }
  await ensureAlfaclubDecisionLedgerSchema(db)

  const decisionId = params.decision.decision_id || randomUUID()
  const result = await db.sql<{ decision_id: string; inserted: boolean }>`
    WITH inserted_decision AS (
      INSERT INTO alfaclub.decision_ledger (
        decision_id,
        observed_at,
        data_as_of,
        venue,
        asset,
        source_id,
        source_side,
        source_entry_price,
        source_notional_usd,
        source_leverage,
        source_timestamp,
        decision,
        counter_side,
        confidence,
        regime_fine,
        regime_coarse,
        methodology_version,
        market_state,
        evidence,
        invalidation,
        suggested_risk_pct,
        suggested_notional_usd,
        estimated_cost_bps,
        modeled_edge_bps,
        edge_prior_version,
        valid_for_minutes,
        evaluation_horizons_hours,
        acp_job_id,
        shadow_only,
        source_provider,
        idempotency_key
      ) VALUES (
        ${decisionId}::uuid,
        ${new Date(params.decision.observed_at)},
        ${new Date(params.decision.data_as_of)},
        ${params.decision.venue},
        ${params.decision.asset},
        ${params.decision.source.id ?? null},
        ${params.decision.source.side},
        ${params.decision.source.entryPrice},
        ${params.decision.source.notionalUsd ?? null},
        ${params.decision.source.leverage ?? null},
        ${params.decision.source.sourceTimestamp ? new Date(params.decision.source.sourceTimestamp) : null},
        ${params.decision.decision},
        ${params.decision.counter_side},
        ${params.decision.confidence},
        ${params.decision.regime},
        ${params.decision.regime_coarse ?? null},
        ${params.decision.methodology_version},
        ${JSON.stringify(params.decision.market_state_vector)}::jsonb,
        ${JSON.stringify({
          supporting: params.decision.supporting_evidence,
          contradicting: params.decision.contradicting_evidence,
        })}::jsonb,
        ${JSON.stringify(params.decision.invalidation)}::jsonb,
        ${params.decision.suggested_risk_pct},
        ${params.decision.suggested_notional_usd},
        ${params.decision.estimated_cost_bps},
        ${params.decision.modeled_edge_bps},
        ${params.decision.edge_prior_version},
        ${params.decision.valid_for_minutes},
        ${[...OUTCOME_HORIZONS]},
        ${params.acpJobId ?? null},
        ${params.decision.shadow_only},
        ${SOURCE_PROVIDER},
        ${params.idempotencyKey}
      )
      ON CONFLICT (source_provider, idempotency_key) DO UPDATE
      SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING decision_id, observed_at, source_entry_price, (xmax = 0) AS inserted
    ), inserted_outcomes AS (
      INSERT INTO alfaclub.decision_outcomes (
        decision_id,
        horizon_hours,
        due_at,
        mark_at_decision,
        status
      )
      SELECT
        inserted_decision.decision_id,
        horizon_hours,
        inserted_decision.observed_at + make_interval(hours => horizon_hours),
        inserted_decision.source_entry_price,
        'pending'
      FROM inserted_decision
      CROSS JOIN unnest(${[...OUTCOME_HORIZONS]}::INTEGER[]) AS horizon_hours
      WHERE inserted_decision.source_entry_price > 0
      ON CONFLICT (decision_id, horizon_hours) DO NOTHING
      RETURNING decision_id
    )
    SELECT decision_id, inserted FROM inserted_decision
  `
  const row = result.rows[0]
  return { decisionId: row?.decision_id ?? null, inserted: Boolean(row?.inserted) }
}
