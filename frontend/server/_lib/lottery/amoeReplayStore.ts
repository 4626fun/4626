// SPDX-License-Identifier: MIT
//
// AMOE replay store — `amoe_zk_submissions` table wrapper.
//
// This is the off-chain mirror of `LotteryAmoeRouter`'s on-chain
// nullifier maps, plus two state machines the on-chain layer cannot
// express:
//
//   1. **In-flight tracking.** Between proof generation and on-chain
//      confirmation, the same `(nonce, wallet)` could legitimately be
//      submitted twice (UI double-click, retry on flaky network). The
//      on-chain mapping rejects the second one with `NonceReplayed` —
//      but the user has already paid for two PLONK proofs and the
//      second error message is wrong (it should say "submission in
//      flight", not "replay attempt").
//
//   2. **`ManagerDeclinedEntry` retry.** The router intentionally
//      reverts the entire transaction (rolling back the nullifier
//      writes) when `manager.processAmoeEntry` returns 0 (inactive
//      coin / below `minSwapAmount` / lottery paused). The user's
//      proof is reusable — but only if someone tracks that the proof
//      exists, why it failed, and when conditions become favorable
//      again.
//
// Design doc: `docs/security/amoe-pr4-replay-store-design.md`.
//
// ============================================================
// STATE MACHINE
// ============================================================
//   pending → proven → broadcast → settled        (happy path)
//                                ↘ manager_declined → (retry) → broadcast → ...
//                                ↘ rejected_chain                            (terminal, user-actionable)
//   pending →                       prove_failed                              (terminal, server-side bug)
//   manager_declined →              abandoned                                 (terminal, retry budget exhausted)
//
// State invariants:
//   * `pending`, `proven`, `broadcast`, `manager_declined` are transient.
//   * `settled`, `prove_failed`, `abandoned`, `rejected_chain` are terminal.
//   * Any non-`settled` terminal state means the on-chain nullifiers
//     are NOT marked used — the user can craft a fresh submission.
//   * Only `manager_declined` is "retryable as-is": the same proof +
//     same nullifiers are still usable because the router reverted them.
//
// ============================================================
// CONCURRENCY
// ============================================================
//   The unique constraint on `nonce_commit_hex` (NULLS NOT DISTINCT)
//   gives us "one in-flight or terminal row per (nonce_commit) once the
//   commit is known". `markProven` is the moment we write that column,
//   so two concurrent submitters racing the same nonce will deterministically
//   fail at `markProven`, returning `submission_in_flight` to the loser.
//
//   The retry cron uses `FOR UPDATE SKIP LOCKED` (callers see the
//   `pickRetriesForCron` SQL) to make multi-replica execution safe.

import { getDb } from '../db/postgres.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from './lotteryAmoeErrors.js'
import { ensureMigrationApplied, ensureAmoeSchema } from '../db/schemaBootstrap.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Replay-store state enum. Lives here (not in a shared types file)
 * because every consumer is in this module's blast radius and we want
 * the source of truth co-located with the schema.
 */
export type AmoeSubmissionState =
  | 'pending'
  | 'proven'
  | 'broadcast'
  | 'manager_declined'
  | 'settled'
  | 'prove_failed'
  | 'rejected_chain'
  | 'abandoned'

/**
 * Terminal states — once a row reaches one of these, the state machine
 * never advances. Exported so the cron / retry endpoint can short-circuit.
 */
export const AMOE_SUBMISSION_TERMINAL_STATES: ReadonlySet<AmoeSubmissionState> =
  new Set(['settled', 'prove_failed', 'abandoned', 'rejected_chain'])

/**
 * The retry budget for `manager_declined` rows. After this many
 * consecutive declines, the row transitions to `abandoned`.
 *
 * Default 8. Tunable via `AMOE_MAX_RETRIES` env. We deliberately keep
 * the default low because each retry burns gas-priced relayer credits;
 * an eight-times-declined submission is almost certainly waiting on a
 * lottery-paused / coin-deactivated condition that requires manual ops.
 */
export const DEFAULT_AMOE_MAX_RETRIES = 8

export function readAmoeMaxRetries(): number {
  const raw = String((globalThis as any).process?.env?.AMOE_MAX_RETRIES ?? '').trim()
  if (!raw) return DEFAULT_AMOE_MAX_RETRIES
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 64) {
    return DEFAULT_AMOE_MAX_RETRIES
  }
  return n
}

/**
 * The shape we pass to `insertPending` — the minimum binding info
 * before the proof is generated.
 */
export interface AmoeSubmissionInsertParams {
  /** `profiles.id` (Postgres bigint) for the caller. */
  signupId: bigint
  /** Caller's lowercased EVM wallet address. */
  wallet: `0x${string}`
  /** Lowercased creator coin address. */
  creatorCoin: `0x${string}`
  /** AMOE epoch (`amoeSubmitZk.computeAmoeEpoch`). */
  epoch: bigint
  /**
   * Idempotency key used by the points ledger. Carried through the
   * row so an audit-time join from `points` -> `amoe_zk_submissions`
   * is one column.
   */
  spendRefId: string
  /** Points being burned (validated upstream). */
  pointsBurned: number
}

/**
 * Marks a row as `proven` and writes the nullifier commitments. After
 * this call the unique constraint on `nonce_commit_hex` is in force.
 */
export interface AmoeSubmissionMarkProvenParams {
  /** Hex `0x...` of the nonce commitment (pubInputs slot). */
  nonceCommitHex: `0x${string}`
  /** Hex `0x...` of the wallet commitment (pubInputs slot). */
  walletCommitHex: `0x${string}`
  /** Hex `0x...` of the points-burn nullifier (pubInputs slot). */
  pointsBurnNullifierHex: `0x${string}`
  /**
   * Hex `0x...` of the twitter-credit nullifier (private input the
   * orchestrator derived from the user's twitter handle). Persisted
   * here so the publisher's projection step can recover it without
   * round-tripping the handle. Optional for backwards-compat with
   * pre-PR-5b callers; new code MUST supply it.
   */
  twitterCreditNullifierHex?: `0x${string}`
  /**
   * The full proof + pubInputs blob, kept as JSONB for retries. We
   * GC this aggressively (see §7 of the design doc) because at ~5KB
   * per row it adds up.
   */
  proofBlob: AmoeReplayProofBlob
}

export interface AmoeReplayProofBlob {
  proof: ReadonlyArray<string>
  pubInputs: ReadonlyArray<string>
}

export interface AmoeSubmissionMarkBroadcastingParams {
  /** Set when relay returns the submitted hash. */
  txHash?: `0x${string}` | null
}

export interface AmoeSubmissionMarkSettledParams {
  txHash: `0x${string}`
  blockNumber: bigint
  managerEntryId: bigint | null
}

export interface AmoeSubmissionMarkManagerDeclinedParams {
  txHash: `0x${string}`
  reason: string
  /**
   * When to retry next. If absent, `markManagerDeclined` computes
   * a default backoff from `retry_count`.
   */
  nextRetryAt?: Date
}

export interface AmoeSubmissionMarkRejectedChainParams {
  reason: string
  txHash?: `0x${string}` | null
}

/**
 * The fully-shaped row read by `findById` / cron pickup. Mirrors the
 * `amoe_zk_submissions` table 1:1, but with bigints lifted out of
 * Postgres `bigint` (which `pg` returns as `string` by default).
 */
export interface AmoeSubmissionRow {
  id: string
  signupId: bigint
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  epoch: bigint
  nonceCommitHex: `0x${string}` | null
  walletCommitHex: `0x${string}` | null
  pointsBurnNullifierHex: `0x${string}` | null
  proofBlob: AmoeReplayProofBlob | null
  spendRefId: string
  pointsBurned: bigint
  state: AmoeSubmissionState
  stateReason: string | null
  createdAt: Date
  provenAt: Date | null
  broadcastAt: Date | null
  settledAt: Date | null
  txHash: `0x${string}` | null
  blockNumber: bigint | null
  managerEntryId: bigint | null
  retryCount: number
  nextRetryAt: Date | null
  lastRetryError: string | null
  /**
   * Timestamp at which a cron replica claimed this row for retry.
   * `null` for fresh / settled / abandoned rows; non-null only while
   * the row is in flight. The reclaim sweeper uses this to tell
   * "in flight by another replica" apart from "crashed mid-retry".
   */
  retryStartedAt: Date | null
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

let amoeReplayStoreSchemaEnsured = false

/**
 * Reset the schema-ensured cache. Vitest only — production callers must
 * never need this because the bootstrap is idempotent.
 */
export function __resetAmoeReplayStoreSchemaEnsuredForTest(): void {
  amoeReplayStoreSchemaEnsured = false
}

/**
 * Idempotent runtime DDL bootstrap.
 *
 * KEEP THIS BLOCK BYTE-FOR-BYTE IDENTICAL to
 * `frontend/db/migrations/032_amoe_zk_submissions.sql`. The migration
 * is the source of truth in CI / prod; this function is the runtime
 * safety net for dev / preview environments where migrations may not
 * have been applied yet.
 */
async function ensureAmoeReplayStoreSchema(
  db: { sql: (s: TemplateStringsArray, ...v: any[]) => Promise<{ rows: any[] }> },
): Promise<void> {
  if (amoeReplayStoreSchemaEnsured) return

  // Condensed path
  await ensureAmoeSchema(db as any)

  // All core amoe_zk_submissions DDL + indexes are now covered by the migration
  // via ensureAmoeSchema(). The raw block above has been removed.
  // Only keep truly dynamic logic here if needed in the future.
  amoeReplayStoreSchemaEnsured = true
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireDb(): Promise<{
  sql: (s: TemplateStringsArray, ...v: any[]) => Promise<{ rows: any[] }>
}> {
  const db = await getDb()
  if (!db) {
    // Mirroring `amoeNonceStore.ts`: the ZK submit path MUST have a DB.
    // No in-memory fallback — replay correctness is too important.
    throw new AmoeServerError('amoe_db_unavailable')
  }
  return db as any
}

function rowToTyped(raw: Record<string, any>): AmoeSubmissionRow {
  return {
    id: String(raw.id),
    signupId: BigInt(raw.signup_id ?? raw.signupId ?? 0),
    wallet: String(raw.wallet_address ?? raw.walletAddress ?? '').toLowerCase() as `0x${string}`,
    creatorCoin: String(raw.creator_coin ?? raw.creatorCoin ?? '').toLowerCase() as `0x${string}`,
    epoch: BigInt(raw.epoch ?? 0),
    nonceCommitHex: (raw.nonce_commit_hex ?? raw.nonceCommitHex ?? null) as `0x${string}` | null,
    walletCommitHex: (raw.wallet_commit_hex ?? raw.walletCommitHex ?? null) as `0x${string}` | null,
    pointsBurnNullifierHex:
      (raw.points_burn_nullifier_hex ?? raw.pointsBurnNullifierHex ?? null) as `0x${string}` | null,
    proofBlob: (raw.proof_blob ?? raw.proofBlob ?? null) as AmoeReplayProofBlob | null,
    spendRefId: String(raw.spend_ref_id ?? raw.spendRefId ?? ''),
    pointsBurned: BigInt(raw.points_burned ?? raw.pointsBurned ?? 0),
    state: String(raw.state) as AmoeSubmissionState,
    stateReason: raw.state_reason ?? raw.stateReason ?? null,
    createdAt: raw.created_at instanceof Date ? raw.created_at : new Date(raw.created_at),
    provenAt:
      raw.proven_at == null
        ? null
        : raw.proven_at instanceof Date
          ? raw.proven_at
          : new Date(raw.proven_at),
    broadcastAt:
      raw.broadcast_at == null
        ? null
        : raw.broadcast_at instanceof Date
          ? raw.broadcast_at
          : new Date(raw.broadcast_at),
    settledAt:
      raw.settled_at == null
        ? null
        : raw.settled_at instanceof Date
          ? raw.settled_at
          : new Date(raw.settled_at),
    txHash: (raw.tx_hash ?? raw.txHash ?? null) as `0x${string}` | null,
    blockNumber: raw.block_number == null ? null : BigInt(raw.block_number),
    managerEntryId: raw.manager_entry_id == null ? null : BigInt(raw.manager_entry_id),
    retryCount: Number(raw.retry_count ?? raw.retryCount ?? 0),
    nextRetryAt:
      raw.next_retry_at == null
        ? null
        : raw.next_retry_at instanceof Date
          ? raw.next_retry_at
          : new Date(raw.next_retry_at),
    lastRetryError: raw.last_retry_error ?? raw.lastRetryError ?? null,
    retryStartedAt:
      raw.retry_started_at == null
        ? null
        : raw.retry_started_at instanceof Date
          ? raw.retry_started_at
          : new Date(raw.retry_started_at),
  }
}

/**
 * Default retry backoff: `30 min × 2^retryCount + uniform(0, 5 min)`,
 * capped at 24h. Jitter avoids thundering-herd retries when a paused
 * lottery is unpaused and 50 declined rows all fire at the same minute.
 */
export function defaultRetryBackoffMs(retryCount: number): number {
  const base = 30 * 60 * 1000 // 30 minutes
  const exp = Math.min(retryCount, 8) // cap exponent so we don't overflow
  const grown = base * Math.pow(2, exp)
  const cap = 24 * 60 * 60 * 1000 // 24 hours
  const capped = Math.min(grown, cap)
  const jitter = Math.floor(Math.random() * 5 * 60 * 1000)
  return capped + jitter
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new `pending` row. Returns the generated submission UUID.
 *
 * No uniqueness gate at this stage — multiple `pending` rows are
 * legal until proof generation pins `nonce_commit_hex`. This means the
 * caller is expected to dedupe via the unique constraint at `markProven`.
 */
export async function insertPending(
  params: AmoeSubmissionInsertParams,
): Promise<string> {
  if (typeof params.signupId !== 'bigint' || params.signupId <= 0n) {
    throw new AmoeBadRequestError('amoe_signup_id_invalid')
  }
  if (typeof params.epoch !== 'bigint' || params.epoch <= 0n) {
    throw new AmoeBadRequestError('amoe_epoch_invalid')
  }
  if (typeof params.spendRefId !== 'string' || params.spendRefId.trim().length === 0) {
    throw new AmoeBadRequestError('amoe_spend_ref_empty')
  }
  if (
    typeof params.pointsBurned !== 'number' ||
    !Number.isFinite(params.pointsBurned) ||
    !Number.isInteger(params.pointsBurned) ||
    params.pointsBurned <= 0
  ) {
    throw new AmoeBadRequestError('amoe_points_burned_invalid')
  }
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const wallet = params.wallet.toLowerCase()
  const creatorCoin = params.creatorCoin.toLowerCase()
  const result = await db.sql`
    INSERT INTO amoe_zk_submissions (
      signup_id,
      wallet_address,
      creator_coin,
      epoch,
      spend_ref_id,
      points_burned,
      state
    ) VALUES (
      ${params.signupId.toString()},
      ${wallet},
      ${creatorCoin},
      ${params.epoch.toString()},
      ${params.spendRefId},
      ${params.pointsBurned},
      'pending'
    )
    RETURNING id;
  `
  const id = result.rows?.[0]?.id
  if (!id) {
    throw new AmoeServerError('amoe_replay_insert_failed')
  }
  return String(id)
}

/**
 * Look up by row id. Returns `null` if not found.
 */
export async function findById(id: string): Promise<AmoeSubmissionRow | null> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    SELECT *
    FROM amoe_zk_submissions
    WHERE id = ${id}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? rowToTyped(row) : null
}

/**
 * Look up the active (non-terminal) submission for a given
 * `nonce_commit_hex`. Used pre-relay to short-circuit on a pre-existing
 * settled or in-flight row with the same commitment.
 */
export async function findActiveByNonceCommit(
  nonceCommitHex: `0x${string}`,
): Promise<AmoeSubmissionRow | null> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    SELECT *
    FROM amoe_zk_submissions
    WHERE nonce_commit_hex = ${nonceCommitHex.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? rowToTyped(row) : null
}

/**
 * Transition `pending → proven`. Writes the three nullifier columns
 * and the proof blob.
 *
 * Returns the row.
 *
 * @throws `AmoeBadRequestError('submission_in_flight')` when a different
 *         row already has the same `nonce_commit_hex` (PG unique
 *         constraint races collapse here).
 */
export async function markProven(
  id: string,
  params: AmoeSubmissionMarkProvenParams,
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const proofBlobJson = JSON.stringify(params.proofBlob)
  // 7-day GC window for the proof blob on terminal-but-not-settled
  // rows. Keep simple: set proof_kept_until at proven time; the GC
  // cron / settled transition will null-out the blob.
  const proofKeptUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  let result: { rows: any[] }
  try {
    result = await db.sql`
      UPDATE amoe_zk_submissions
      SET state = 'proven',
          proven_at = NOW(),
          nonce_commit_hex = ${params.nonceCommitHex.toLowerCase()},
          wallet_commit_hex = ${params.walletCommitHex.toLowerCase()},
          points_burn_nullifier_hex = ${params.pointsBurnNullifierHex.toLowerCase()},
          twitter_credit_nullifier_hex = ${
            params.twitterCreditNullifierHex
              ? params.twitterCreditNullifierHex.toLowerCase()
              : null
          },
          proof_blob = ${proofBlobJson}::jsonb,
          proof_kept_until = ${proofKeptUntil}
      WHERE id = ${id}
        AND state = 'pending'
      RETURNING *;
    `
  } catch (err) {
    // PG unique violation — `nonce_commit_hex` already taken.
    if (isUniqueViolation(err)) {
      throw new AmoeBadRequestError('submission_in_flight')
    }
    throw err
  }
  const row = result.rows?.[0]
  if (!row) {
    // Either the row vanished or the precondition `state='pending'`
    // was false. Either way, re-read to surface a useful error.
    const current = await findById(id)
    if (!current) throw new AmoeServerError('amoe_replay_row_not_found')
    if (current.state === 'proven' || current.state === 'broadcast') {
      throw new AmoeBadRequestError('submission_in_flight')
    }
    if (current.state === 'settled') {
      throw new AmoeBadRequestError('submission_already_settled')
    }
    throw new AmoeBadRequestError('submission_state_invalid')
  }
  return rowToTyped(row)
}

/**
 * Transition `proven → broadcast`. Optionally records the tx hash if
 * the relayer returns synchronously.
 */
export async function markBroadcasting(
  id: string,
  params: AmoeSubmissionMarkBroadcastingParams = {},
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const txHash = params.txHash ? params.txHash.toLowerCase() : null
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET state = 'broadcast',
        broadcast_at = NOW(),
        tx_hash = COALESCE(${txHash}, tx_hash)
    WHERE id = ${id}
      AND state IN ('proven', 'manager_declined')
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Transition any → `settled`. Clears `proof_blob` because settled rows
 * never need it again. Writes audit metadata.
 */
export async function markSettled(
  id: string,
  params: AmoeSubmissionMarkSettledParams,
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET state = 'settled',
        settled_at = NOW(),
        tx_hash = ${params.txHash.toLowerCase()},
        block_number = ${params.blockNumber.toString()},
        manager_entry_id = ${params.managerEntryId == null ? null : params.managerEntryId.toString()},
        proof_blob = NULL,
        proof_kept_until = NULL,
        retry_started_at = NULL
    WHERE id = ${id}
      AND state IN ('broadcast', 'proven')
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Transition broadcast → `manager_declined`. Increments retry count
 * and schedules the next retry.
 *
 * If the new `retry_count` reaches the budget, transitions to
 * `abandoned` instead (terminal, retry-budget-exhausted).
 */
export async function markManagerDeclined(
  id: string,
  params: AmoeSubmissionMarkManagerDeclinedParams,
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const maxRetries = readAmoeMaxRetries()
  // Backoff per *current* retry_count. Documented policy:
  // 30min × 2^retryCount + uniform(0, 5min), cap 24h. The prior
  // implementation hardcoded `defaultRetryBackoffMs(0)` for every
  // decline, so each retry was scheduled ~30min out instead of
  // exponentially backing off (Codex review on PR #444).
  //
  // Caller-supplied `nextRetryAt` (used by tests and any future
  // "force this row to retry at T" admin path) overrides the policy.
  const overrideAt = params.nextRetryAt ? params.nextRetryAt.toISOString() : null
  const nowMs = Date.now()
  // For each possible value of `retry_count` at decline time
  // (0..maxRetries-1), pre-compute the corresponding next-retry
  // ISO string. The SQL below selects the right one via per-count
  // WHEN branches.
  const backoffByCount: string[] = []
  for (let n = 0; n < maxRetries; n++) {
    backoffByCount.push(new Date(nowMs + defaultRetryBackoffMs(n)).toISOString())
  }
  // We need the SQL to bind a stable number of parameters regardless
  // of `maxRetries`, so we compose the per-count branches as a
  // VALUES (CTE) join that maps `retry_count` (the row's current
  // value at UPDATE evaluation time) to the chosen ISO string.
  // PostgreSQL allows `unnest` of two parallel arrays passed via
  // a single bound `text[]` parameter, which keeps the prepared
  // statement shape stable. Fallback for retry_count >= maxRetries-1
  // (shouldn't happen because of the abandon branch above, but kept
  // for safety) uses the largest precomputed delay.
  const fallbackBackoff = backoffByCount[backoffByCount.length - 1]!
  const result = await db.sql`
    UPDATE amoe_zk_submissions AS s
    SET retry_count = s.retry_count + 1,
        last_retry_error = ${params.reason},
        tx_hash = ${params.txHash.toLowerCase()},
        retry_started_at = NULL,
        state = CASE
          WHEN s.retry_count + 1 >= ${maxRetries} THEN 'abandoned'
          ELSE 'manager_declined'
        END,
        state_reason = CASE
          WHEN s.retry_count + 1 >= ${maxRetries} THEN 'retry_budget_exhausted'
          ELSE ${params.reason}
        END,
        next_retry_at = CASE
          WHEN ${overrideAt}::text IS NOT NULL THEN ${overrideAt}::timestamptz
          WHEN s.retry_count + 1 >= ${maxRetries} THEN NULL
          ELSE COALESCE(
            (
              SELECT b.next_at
              FROM unnest(${backoffByCount}::timestamptz[]) WITH ORDINALITY AS b(next_at, idx)
              WHERE b.idx = s.retry_count + 1
              LIMIT 1
            ),
            ${fallbackBackoff}::timestamptz
          )
        END
    WHERE s.id = ${id}
      AND s.state IN ('broadcast', 'manager_declined')
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Terminal: prove crashed (witness invariant broken / snarkjs blew up).
 * Clears the proof blob (we have nothing useful to keep).
 */
export async function markProveFailed(
  id: string,
  reason: string,
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET state = 'prove_failed',
        state_reason = ${String(reason).slice(0, 1024)},
        proof_blob = NULL,
        proof_kept_until = NULL,
        retry_started_at = NULL
    WHERE id = ${id}
      AND state = 'pending'
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Terminal: on-chain rejected with a non-ManagerDeclinedEntry revert
 * (bad proof, UnknownEpoch, etc.). User-actionable.
 */
export async function markRejectedChain(
  id: string,
  params: AmoeSubmissionMarkRejectedChainParams,
): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const txHash = params.txHash ? params.txHash.toLowerCase() : null
  const proofKeptUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET state = 'rejected_chain',
        state_reason = ${String(params.reason).slice(0, 1024)},
        tx_hash = COALESCE(${txHash}, tx_hash),
        proof_kept_until = ${proofKeptUntil},
        retry_started_at = NULL
    WHERE id = ${id}
      AND state IN ('pending', 'proven', 'broadcast')
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Terminal: epoch rolled while submission was in flight. Same shape as
 * `markRejectedChain` but with a fixed reason; exists separately so we
 * can metric/alert independently.
 */
export async function markAbandonedEpochRolled(id: string): Promise<AmoeSubmissionRow> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET state = 'abandoned',
        state_reason = 'epoch_rolled',
        next_retry_at = NULL,
        retry_started_at = NULL,
        proof_blob = NULL,
        proof_kept_until = NULL
    WHERE id = ${id}
      AND state IN ('manager_declined', 'pending', 'proven', 'broadcast')
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new AmoeServerError('amoe_replay_state_invalid')
  return rowToTyped(row)
}

/**
 * Cron pickup query — claim up to `limit` rows that are due for retry.
 * Uses `FOR UPDATE SKIP LOCKED` so multiple cron replicas can run
 * safely in parallel.
 *
 * Caller must process each returned row (call retry path) inside the
 * same transaction-equivalent (we lock for the duration of the cron
 * invocation; pg drivers hold the row lock until commit/rollback).
 *
 * For simplicity and because the `getDb()` interface here is a
 * tagged-template wrapper without explicit transaction support, the
 * cron simply claims rows by setting `next_retry_at = NULL` (so it
 * won't be re-picked while in flight) inside the same UPDATE.
 *
 * NOTE: this two-phase pattern (claim → process → restore on failure)
 * is a tiny bit weaker than `FOR UPDATE SKIP LOCKED` because a process
 * crash between claim and re-broadcast leaves the row stranded with
 * `next_retry_at = NULL`. The cron has a sweep query
 * (`reclaimStrandedRetries`) that recovers from that case.
 */
export async function pickRetriesForCron(limit: number): Promise<AmoeSubmissionRow[]> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const cap = Math.max(1, Math.min(limit, 200))
  // Two-phase claim: mark `next_retry_at = NULL` (so the row drops
  // out of the candidate set for any other replica) AND stamp
  // `retry_started_at = NOW()` so the reclaim sweeper can tell a
  // fresh in-flight claim apart from a row stranded by a process
  // crash. See `reclaimStrandedRetries` for the recovery logic.
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET next_retry_at = NULL,
        retry_started_at = NOW()
    WHERE id IN (
      SELECT id
      FROM amoe_zk_submissions
      WHERE state = 'manager_declined'
        AND next_retry_at IS NOT NULL
        AND next_retry_at <= NOW()
        AND retry_count < ${readAmoeMaxRetries()}
      ORDER BY next_retry_at
      LIMIT ${cap}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `
  return (result.rows ?? []).map(rowToTyped)
}

/**
 * How long a claim is allowed to be in flight before reclaim treats
 * the row as stranded. Sized well above the worst-case prove + relay
 * round-trip (typically <30s), and well below the smallest backoff
 * (30 min) so reclaim never fights healthy retries.
 */
export const STRANDED_CLAIM_AGE_MS = 15 * 60 * 1000

/**
 * Reclaim rows whose claim (`pickRetriesForCron` set
 * `next_retry_at = NULL` AND `retry_started_at = NOW()`) never
 * advanced to a new state because the worker crashed mid-retry.
 *
 * Race-safety: only resurrect rows whose `retry_started_at` is older
 * than `STRANDED_CLAIM_AGE_MS` (15 minutes). Without this guard, an
 * overlapping cron tick would immediately requeue rows another
 * worker is actively processing, causing duplicate rebroadcasts and
 * unnecessary relay spend (Codex review on PR #444).
 *
 * Sets `retry_started_at = NULL` so the row presents as a fresh,
 * unclaimed candidate after this update.
 */
export async function reclaimStrandedRetries(): Promise<number> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  // Cutoff is a static constant; bind as text and cast inside SQL to
  // avoid driver-specific interval-literal quirks.
  const cutoffSeconds = Math.floor(STRANDED_CLAIM_AGE_MS / 1000)
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET next_retry_at = NOW(),
        retry_started_at = NULL
    WHERE state = 'manager_declined'
      AND next_retry_at IS NULL
      AND retry_count < ${readAmoeMaxRetries()}
      AND retry_started_at IS NOT NULL
      AND retry_started_at < NOW() - make_interval(secs => ${cutoffSeconds})
    RETURNING id;
  `
  return result.rows?.length ?? 0
}

/**
 * Garbage-collect proof blobs whose `proof_kept_until` has passed.
 * Returns the number of rows scrubbed.
 */
export async function gcExpiredProofBlobs(): Promise<number> {
  const db = await requireDb()
  await ensureAmoeReplayStoreSchema(db)
  const result = await db.sql`
    UPDATE amoe_zk_submissions
    SET proof_blob = NULL,
        proof_kept_until = NULL
    WHERE proof_blob IS NOT NULL
      AND proof_kept_until IS NOT NULL
      AND proof_kept_until <= NOW()
    RETURNING id;
  `
  return result.rows?.length ?? 0
}

// ---------------------------------------------------------------------------
// Error matchers
// ---------------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  // Postgres `23505 unique_violation`. The pg driver surfaces this on
  // `.code`; @vercel/postgres does the same. Be defensive about both.
  const code = (err as any)?.code ?? (err as any)?.cause?.code
  if (code === '23505') return true
  const message = String((err as Error)?.message ?? '').toLowerCase()
  return (
    message.includes('duplicate key value') ||
    message.includes('unique constraint') ||
    message.includes('amoe_zk_submissions_nonce_commit_unique')
  )
}
