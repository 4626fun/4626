import type {
  FundingBias,
  FundingOiRegime,
  OiParticipation,
} from './fundingOiRegime.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaclubFundingOiObservationSchema } from '../db/schemaBootstrap.js'

const OUTCOME_HORIZON_HOURS = [1, 4, 24] as const
const SOURCE_PROVIDER = 'hyperliquid-meta-and-asset-ctxs'
const CLASSIFIER_VERSION = 'funding-oi-signal-v2'

export type FundingOiObservationField =
  | 'markPriceUsd'
  | 'fundingRate'
  | 'openInterestUsd'
  | 'volume24hUsd'
  | 'priceChange24hPct'

type FundingOiDataQuality = 'complete' | 'partial' | 'insufficient'

export type FundingOiObservationInput = {
  idempotencyKey?: string
  observedAtMs: number
  symbol: string
  markPriceUsd: number | null
  fundingRate: number | null
  openInterestUsd: number | null
  volume24hUsd: number | null
  priceChange24hPct: number | null
  regime: FundingOiRegime
  fundingBias: FundingBias
  oiParticipation: OiParticipation
  confidence: number
  reasons: string[]
  missingFields?: FundingOiObservationField[]
}

type DueOutcomeRow = {
  observation_id: string
  symbol: string
  horizon_hours: number | string
  observed_price_usd: number | string
  due_at: Date | string
}

export type FundingOiTargetPrice = { priceUsd: number; priceAtMs: number }

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function recordFundingOiRegimeObservation(
  input: FundingOiObservationInput,
): Promise<{ observationId: string | null; inserted: boolean }> {
  const db = await getDb()
  if (!db) return { observationId: null, inserted: false }
  await ensureAlfaclubFundingOiObservationSchema(db)

  const symbol = input.symbol.trim().toUpperCase()
  const observedAt = new Date(input.observedAtMs)
  const idempotencyKey = input.idempotencyKey?.trim() || `${symbol}:${observedAt.toISOString()}`
  const missingFields = input.missingFields ?? (
    [
      'markPriceUsd',
      'fundingRate',
      'openInterestUsd',
      'volume24hUsd',
      'priceChange24hPct',
    ] as const
  ).filter((field) => input[field] == null || !Number.isFinite(input[field]))
  const dataQuality: FundingOiDataQuality =
    missingFields.length === 0
      ? 'complete'
      : input.regime === 'insufficient-data'
        ? 'insufficient'
        : 'partial'
  const result = await db.sql<{ id: string; inserted: boolean }>`
    WITH inserted_observation AS (
      INSERT INTO alfaclub.funding_oi_shadow_observation (
        symbol,
        observed_at,
        source_provider,
        idempotency_key,
        classifier_version,
        data_quality,
        missing_fields,
        mark_price_usd,
        funding_rate,
        open_interest_usd,
        volume_24h_usd,
        price_change_24h_pct,
        regime,
        funding_bias,
        oi_participation,
        confidence,
        reasons
      ) VALUES (
        ${symbol},
        ${observedAt},
        ${SOURCE_PROVIDER},
        ${idempotencyKey},
        ${CLASSIFIER_VERSION},
        ${dataQuality},
        ${missingFields},
        ${input.markPriceUsd},
        ${input.fundingRate},
        ${input.openInterestUsd},
        ${input.volume24hUsd},
        ${input.priceChange24hPct},
        ${input.regime},
        ${input.fundingBias},
        ${input.oiParticipation},
        ${input.confidence},
        ${input.reasons}
      )
      ON CONFLICT (source_provider, idempotency_key) DO UPDATE
      SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING id, observed_at, mark_price_usd, (xmax = 0) AS inserted
    ), inserted_outcomes AS (
      INSERT INTO alfaclub.funding_oi_shadow_outcome (
        observation_id,
        horizon_hours,
        due_at
      )
      SELECT
        inserted_observation.id,
        horizon_hours,
        inserted_observation.observed_at + make_interval(hours => horizon_hours)
      FROM inserted_observation
      CROSS JOIN unnest(${[...OUTCOME_HORIZON_HOURS]}::INTEGER[]) AS horizon_hours
      WHERE inserted_observation.mark_price_usd > 0
      ON CONFLICT (observation_id, horizon_hours) DO NOTHING
      RETURNING observation_id
    )
    SELECT id, inserted FROM inserted_observation
  `
  const row = result.rows[0]
  return { observationId: row?.id ?? null, inserted: Boolean(row?.inserted) }
}

export async function settleDueFundingOiRegimeHorizons(params: {
  nowMs: number
  readMarkPriceAt: (symbol: string, targetAtMs: number) => Promise<FundingOiTargetPrice | number | null>
}): Promise<{ due: number; settled: number; deferred: number }> {
  const db = await getDb()
  if (!db) return { due: 0, settled: 0, deferred: 0 }
  await ensureAlfaclubFundingOiObservationSchema(db)

  const now = new Date(params.nowMs)
  const dueResult = await db.sql<DueOutcomeRow>`
    SELECT
      outcome.observation_id,
      observation.symbol,
      outcome.horizon_hours,
      outcome.due_at,
      observation.mark_price_usd AS observed_price_usd
    FROM alfaclub.funding_oi_shadow_outcome AS outcome
    JOIN alfaclub.funding_oi_shadow_observation AS observation
      ON observation.id = outcome.observation_id
    WHERE outcome.settled_at IS NULL
      AND outcome.due_at <= ${now}
      AND observation.mark_price_usd > 0
    ORDER BY outcome.due_at ASC
    LIMIT 500
  `

  let settled = 0
  let deferred = 0
  for (const row of dueResult.rows) {
    const symbol = String(row.symbol ?? '').trim().toUpperCase()
    const dueAtMs = new Date(row.due_at).getTime()
    let targetPrice: FundingOiTargetPrice | null = null
    try {
      if (Number.isFinite(dueAtMs)) {
        const value = await params.readMarkPriceAt(symbol, dueAtMs)
        targetPrice = typeof value === 'number'
          ? { priceUsd: value, priceAtMs: dueAtMs }
          : value
      }
    } catch {
      targetPrice = null
    }
    const settledPrice = finitePositive(targetPrice?.priceUsd)
    const priceAtMs = targetPrice?.priceAtMs ?? Number.NaN
    const observedPrice = finitePositive(row.observed_price_usd)
    const horizonHours = Number(row.horizon_hours)
    if (
      settledPrice == null ||
      observedPrice == null ||
      !Number.isInteger(horizonHours) ||
      !Number.isFinite(priceAtMs)
    ) {
      deferred += 1
      continue
    }

    const returnPct = ((settledPrice - observedPrice) / observedPrice) * 100
    const updateResult = await db.sql`
      UPDATE alfaclub.funding_oi_shadow_outcome
      SET settled_at = ${now},
          price_at = ${new Date(priceAtMs)},
          settled_price_usd = ${settledPrice},
          return_pct = ${returnPct}
      WHERE observation_id = ${row.observation_id}::uuid
        AND horizon_hours = ${horizonHours}
        AND settled_at IS NULL
      RETURNING observation_id
    `
    if ((updateResult.rowCount ?? updateResult.rows.length) > 0) settled += 1
  }

  return {
    due: dueResult.rows.length,
    settled,
    deferred,
  }
}
