// SPDX-License-Identifier: MIT
//
// AMOE orphan-burn refund helper.
//
// The phase-A → phase-B split (PR 6b, design doc
// `amoe-burn-then-submit-design.md`) introduces a new failure mode:
// the user's `points` debit is written by `consumeAmoeCreditsForEntry`
// (phase A) but they never complete `submit-zk` (phase B). The debit
// row stays. The user's AMOE-eligible balance is permanently reduced
// even though no on-chain entry was ever submitted.
//
// PR 6c (this file + `_amoeBurnRefundCron.ts`) closes the loop by
// writing a compensating positive row to `points` for every phase-A
// debit older than `REFUND_AGE_EPOCHS` that has NO corresponding
// settled `amoe_zk_submissions` row. The compensation row uses
// `source = 'amoe_entry_refund'` and the SAME `source_id` as the
// original debit, so:
//
//   1. `INSERT ... ON CONFLICT DO NOTHING` against the existing
//      `points_unique_source_full` UNIQUE index makes the refund
//      operation strictly idempotent — running the cron twice on the
//      same orphan emits at most one refund.
//   2. The view `points_amoe_eligible_balance` (updated by migration
//      035 to include an `amoe_entry_refund` arm in its CASE) folds the
//      refund into the eligible-balance calculation, so the next phase-A
//      attempt sees credits restored.
//   3. The L0 → L1 projector at `amoeLedgerProjector.ts:316-317` filters
//      `amount < 0`, so positive refund rows CANNOT enter the on-chain
//      ledger root. Refunds only affect off-chain eligibility — they
//      cannot retroactively forge a ledger leaf.
//
// Settled-burn detection
// ----------------------
// "Settled" means a row in `amoe_zk_submissions` with the same
// `(signup_id, spend_ref_id)` and `state = 'settled'`. If the relayer
// is still in flight (`state IN ('pending', 'submitted')`) we do NOT
// refund — we only refund burns where phase B is provably abandoned
// past the TTL.
//
// TTL
// ---
// `REFUND_AGE_EPOCHS = 7` per design §5.1 ("e.g. 7 days = 7 epochs").
// Computed as wall-clock seconds since `points.created_at`, NOT
// epoch-aligned, because the debit's `created_at` is recorded with
// fractional precision and we want a smooth TTL rather than an epoch
// boundary that could refund mid-tick.
//
// Why scan `points` directly (not `amoe_points_burn_ledger`)
// ----------------------------------------------------------
// `amoe_points_burn_ledger` (L1) is populated by the publisher cron
// (PR 5b). If the publisher is paused, mis-deployed, or behind, L1
// rows for a given debit may not exist yet. Scanning L0 (`points`)
// directly guarantees we catch every orphan regardless of publisher
// state. The publisher's role is to mint Merkle leaves for phase-B
// ZK proofs; refunds only affect the off-chain debit ledger and
// don't need L1.
//
// Design doc: `docs/security/amoe-burn-then-submit-design.md` §5.1
// (option 1) and §7.5 (`_amoeBurnRefundCron.ts` plan).

import { getDb } from '../db/postgres.js'

declare const process: { env: Record<string, string | undefined> }

// ----------------------------------------------------------------------------
// Tunables
// ----------------------------------------------------------------------------

/**
 * AMOE epoch length in seconds. Mirrors `AMOE_EPOCH_LEN_SEC` in
 * `amoeSubmitZk.ts` (locked spec: 1-day epochs).
 */
const AMOE_EPOCH_LENGTH_SEC = 86_400

/**
 * Default TTL before an unclaimed burn becomes refundable. Design
 * §5.1 calls for 7 epochs (~7 days).
 */
export const DEFAULT_REFUND_AGE_EPOCHS = 7

/**
 * Default cap on refund rows emitted per cron tick. Keeps a single
 * tick bounded so a backlog drains across multiple ticks rather than
 * holding the function open for minutes.
 */
export const DEFAULT_MAX_REFUNDS_PER_TICK = 50

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Db pool shape this module needs (matches `AmoePublisherDb`). */
export type AmoeBurnRefundDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

/**
 * One orphan-burn candidate identified by {@link findOrphanBurns}.
 * `pointsId` is the L0 `points.id` for diagnostic logging only — the
 * refund INSERT keys off `(signup_id, source_id, amount)` to remain
 * stable across schema changes.
 */
export interface OrphanBurnCandidate {
  pointsId: bigint
  signupId: bigint
  spendRefId: string
  pointsBurned: number
  burnedAt: string
}

/**
 * Outcome of {@link refundOrphanBurn}. `inserted=false` indicates the
 * refund row already existed (idempotent re-run). `inserted=true` is
 * a fresh refund.
 */
export interface RefundInsertOutcome {
  inserted: boolean
}

// ----------------------------------------------------------------------------
// Env helpers
// ----------------------------------------------------------------------------

/**
 * Top-level enable for the refund cron. Distinct from
 * `AMOE_ZK_SUBMIT_ENABLED` (the feature) and
 * `AMOE_LEDGER_PUBLISHER_ENABLED` (the publisher cron) so ops can
 * pause refunds independently — e.g. while debugging an unexpected
 * orphan-burn rate.
 */
export function isAmoeBurnRefundCronEnabled(): boolean {
  return String(process.env.AMOE_REFUND_CRON_ENABLED ?? '').trim() === '1'
}

/**
 * Refund-age TTL, in seconds. Operators can override via
 * `AMOE_REFUND_AGE_EPOCHS` (integer epochs ≥ 1). Out-of-range or
 * non-numeric values fall back to {@link DEFAULT_REFUND_AGE_EPOCHS}.
 */
export function readRefundAgeSec(): number {
  const raw = String(process.env.AMOE_REFUND_AGE_EPOCHS ?? '').trim()
  const parsed = Number(raw)
  const epochs =
    Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1
      ? parsed
      : DEFAULT_REFUND_AGE_EPOCHS
  return epochs * AMOE_EPOCH_LENGTH_SEC
}

/**
 * Per-tick cap on refunds. Operators can raise/lower via
 * `AMOE_REFUND_MAX_PER_TICK`.
 */
export function readMaxRefundsPerTick(): number {
  const raw = String(process.env.AMOE_REFUND_MAX_PER_TICK ?? '').trim()
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
    return parsed
  }
  return DEFAULT_MAX_REFUNDS_PER_TICK
}

// ----------------------------------------------------------------------------
// DB acquisition (mirrors `requirePublisherDb`)
// ----------------------------------------------------------------------------

export async function requireBurnRefundDb(): Promise<AmoeBurnRefundDb> {
  const db = await getDb()
  if (!db) {
    throw new Error('amoe_db_unavailable')
  }
  return db as unknown as AmoeBurnRefundDb
}

// ----------------------------------------------------------------------------
// Orphan detection
// ----------------------------------------------------------------------------

/**
 * Coerce a value coming back from the pg driver (which can be `bigint`,
 * `string`, or `number`) to a JS `bigint`. Throws on non-integer input
 * so we surface driver oddities early rather than emit a corrupted
 * refund row.
 */
function toBigint(value: unknown, field: string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
  throw new Error(`amoe_refund_invalid_field:${field}`)
}

/**
 * Coerce a points amount to a positive integer (the refund amount).
 * The original debit row stores `-pointsBurned`; the refund inserts
 * `+pointsBurned`. We re-derive the positive amount from the
 * (negative) debit row, so a manual `points` mutation that clamps the
 * amount on the negative side cannot inflate the refund.
 */
function debitAmountToRefundUnits(value: unknown): number {
  let n: number
  if (typeof value === 'bigint') {
    n = Number(value)
  } else if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string') {
    n = Number(value)
  } else {
    throw new Error('amoe_refund_invalid_amount')
  }
  if (!Number.isFinite(n) || !Number.isInteger(n) || n >= 0) {
    throw new Error('amoe_refund_invalid_amount')
  }
  return -n
}

/**
 * Coerce a Date | string | null timestamp to ISO-8601. Falls back to
 * an empty string if the driver returned something unparseable; the
 * caller treats this as a diagnostic signal only.
 */
function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 0) {
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  return ''
}

/**
 * Find AMOE phase-A debit rows in `points` that:
 *   1. are older than `ageSec` seconds (`created_at` < NOW() - ageSec),
 *   2. have NO `amoe_zk_submissions` row in state `settled` for the
 *      same `(signup_id, spend_ref_id)` (phase B never landed),
 *   3. have NO existing `amoe_entry_refund` row keyed by the same
 *      `source_id` (refund hasn't run yet).
 *
 * Returns at most `limit` candidates, oldest-first, so a backlog
 * drains deterministically across ticks.
 */
export async function findOrphanBurns(
  db: AmoeBurnRefundDb,
  args: { ageSec: number; limit: number },
): Promise<OrphanBurnCandidate[]> {
  const { ageSec, limit } = args
  if (!Number.isFinite(ageSec) || ageSec <= 0) {
    throw new Error('amoe_refund_invalid_age_sec')
  }
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1) {
    throw new Error('amoe_refund_invalid_limit')
  }

  // INTERVAL '1 second' * <number> — use multiplication rather than
  // string concatenation so we never inject untrusted input into the
  // INTERVAL literal. (`ageSec` is an int we control via env, but the
  // safer pattern hardens future refactors.)
  const result = await db.sql`
    SELECT
      p.id           AS points_id,
      p.signup_id    AS signup_id,
      p.source_id    AS spend_ref_id,
      p.amount       AS amount,
      p.created_at   AS created_at
    FROM points AS p
    WHERE p.source = ${'amoe_entry_spend'}
      AND p.amount < 0
      AND p.source_id IS NOT NULL
      AND p.created_at < NOW() - (INTERVAL '1 second' * ${ageSec})
      AND NOT EXISTS (
        SELECT 1
        FROM amoe_zk_submissions AS s
        WHERE s.signup_id = p.signup_id
          AND s.spend_ref_id = p.source_id
          AND s.state = ${'settled'}
      )
      AND NOT EXISTS (
        SELECT 1
        FROM points AS r
        WHERE r.signup_id = p.signup_id
          AND r.source = ${'amoe_entry_refund'}
          AND r.source_id = p.source_id
      )
    ORDER BY p.created_at ASC
    LIMIT ${limit};
  `

  const rows = Array.isArray(result.rows) ? result.rows : []
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>
    const refId = row.spend_ref_id
    if (typeof refId !== 'string' || refId.length === 0) {
      throw new Error('amoe_refund_invalid_spend_ref_id')
    }
    return {
      pointsId: toBigint(row.points_id, 'points_id'),
      signupId: toBigint(row.signup_id, 'signup_id'),
      spendRefId: refId,
      pointsBurned: debitAmountToRefundUnits(row.amount),
      burnedAt: toIsoString(row.created_at),
    }
  })
}

// ----------------------------------------------------------------------------
// Refund insert
// ----------------------------------------------------------------------------

/**
 * Insert a compensating `amoe_entry_refund` row for a single orphan
 * burn. Idempotent: relies on the existing
 * `points_unique_source_full` UNIQUE index on
 * `(signup_id, source, source_id)` — a second call with the same
 * `(signupId, spendRefId)` is a no-op (`inserted=false`).
 *
 * The refund amount is positive and equals the magnitude of the
 * original debit. The view `points_amoe_eligible_balance` (post-
 * migration 035) maps `amoe_entry_refund` 1:1 into the eligible-
 * balance sum, so the user's AMOE-balance is fully restored on the
 * next phase-A attempt.
 */
export async function refundOrphanBurn(
  db: AmoeBurnRefundDb,
  args: { signupId: bigint; spendRefId: string; pointsBurned: number },
): Promise<RefundInsertOutcome> {
  const { signupId, spendRefId, pointsBurned } = args
  if (
    !Number.isFinite(pointsBurned) ||
    !Number.isInteger(pointsBurned) ||
    pointsBurned <= 0
  ) {
    throw new Error('amoe_refund_invalid_points_burned')
  }
  if (typeof spendRefId !== 'string' || spendRefId.length === 0) {
    throw new Error('amoe_refund_invalid_spend_ref_id')
  }

  const result = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${signupId}, ${'amoe_entry_refund'}, ${spendRefId}, ${pointsBurned}, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  const rows = Array.isArray(result.rows) ? result.rows : []
  return { inserted: rows.length > 0 }
}

// ----------------------------------------------------------------------------
// Tick driver — composes detection + per-row refund.
// ----------------------------------------------------------------------------

/**
 * Aggregate per-tick result. `scannedCount` is the number of orphan
 * candidates returned by {@link findOrphanBurns}; `refundedCount` is
 * the number of those that produced a fresh INSERT (skipping any
 * idempotent-no-op rows). Any per-row error is captured in `errors`
 * — we keep going so a single bad row doesn't stall the queue.
 */
export interface RefundTickResult {
  scannedCount: number
  refundedCount: number
  errors: Array<{ pointsId: string; message: string }>
}

export async function runBurnRefundTick(
  db: AmoeBurnRefundDb,
  args: { ageSec?: number; limit?: number } = {},
): Promise<RefundTickResult> {
  const ageSec = args.ageSec ?? readRefundAgeSec()
  const limit = args.limit ?? readMaxRefundsPerTick()

  const candidates = await findOrphanBurns(db, { ageSec, limit })
  let refundedCount = 0
  const errors: RefundTickResult['errors'] = []

  for (const c of candidates) {
    try {
      const outcome = await refundOrphanBurn(db, {
        signupId: c.signupId,
        spendRefId: c.spendRefId,
        pointsBurned: c.pointsBurned,
      })
      if (outcome.inserted) refundedCount += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      errors.push({ pointsId: c.pointsId.toString(), message: message.slice(0, 500) })
    }
  }

  return {
    scannedCount: candidates.length,
    refundedCount,
    errors,
  }
}
