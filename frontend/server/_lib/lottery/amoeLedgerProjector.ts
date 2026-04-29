// SPDX-License-Identifier: MIT
//
// AMOE points-burn ledger projector — L0 → L1.
//
// Reads operational `points` rows where `source = 'amoe_entry_spend'` and
// projects each into the derived `amoe_points_burn_ledger` table, pinning
// every witness-derived field element (signupIdHash, spendRefIdHash,
// pointsBurnedAsUSD, walletAddrCommit, leafHash) at projection time.
//
// IDEMPOTENCY
// ===========
// Each L1 row is keyed by `source_points_id` (UNIQUE), so projecting the
// same `points` row twice is a no-op. Re-running the projector after a
// partial failure produces an identical row-set; combined with the
// publisher-cron (PR 5b) only running one instance at a time per
// `publisher_runs` row-lock, this gives at-least-once → exactly-once
// semantics.
//
// SALT REQUIREMENT
// ================
// Projection consumes `AMOE_SIGNUP_SALT` (via `readAmoeSignupSalt`). If
// the salt is misconfigured the projector THROWS — it does NOT fall
// through with a placeholder. A salt-less projection would write
// rainbow-table-trivial nullifiers into the published Merkle root, which
// is the exact failure mode the salt exists to prevent.
//
// EPOCH ASSIGNMENT
// ================
// `epoch = floor((points.created_at - AMOE_EPOCH_GENESIS) / AMOE_EPOCH_LENGTH)`.
// We compute this in JS from the row's `created_at` rather than in SQL so
// the boundary semantic (epoch_close + grace) is centralized in
// `epochForTimestamp` and trivially unit-testable. SQL-side we just pull
// the timestamp.
//
// WALLET ↔ TWITTER-CREDIT NULLIFIER
// =================================
// `walletAddrCommit = Poseidon2(wallet, twitterCreditNullifier)`. The
// twitter credit nullifier is NOT stored on the original `points` row —
// it lives on the AMOE entry submission that triggered the burn (in
// `amoe_zk_submissions.twitter_credit_nullifier_hex` for ZK entries, or
// the legacy ECDSA path for v1 entries). The projector accepts a lookup
// callback so callers (the publisher cron, tests, fixtures) can wire the
// source of truth themselves. v1 callers MAY pass a constant value; PR
// 5b's cron joins against `amoe_zk_submissions`.
//
// See: docs/security/amoe-points-burn-ledger-sot.md §4.1, §6.

import {
  bigintToBe32Bytes,
  deriveSignupIdHash,
  deriveSpendRefIdHash,
  readAmoeSignupSalt,
} from './amoeIdentifiers.js'
import {
  AMOE_BN254_FIELD_MODULUS,
  AMOE_EPOCH_GENESIS_SECONDS,
  AMOE_EPOCH_LENGTH_SECONDS,
  AMOE_MAX_POINTS_BURNED_AS_USD,
  computeAmoeLedgerLeaf,
  computeAmoeWalletAddrCommit,
  epochForTimestamp,
} from './amoeWitness.js'

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Conversion factor from AMOE points to USD-1e6 (`pointsBurnedAsUSD`).
 * Locked-spec value: `pointsBurnedAsUSD = points * 10_000`.
 *
 *   100 points    → $1.00       → 1_000_000   (1e6) USD-1e6 units
 *   1_000_000 pts → $10_000.00  → 10_000_000_000 (1e10)
 *
 * Mirrors `LotteryAmoeRouter.MAX_POINTS_AS_USD = 10_000 * 1_000_000`.
 */
export const AMOE_POINTS_TO_USD_E6 = 10_000n as const

/**
 * Source-tag for AMOE-entry burn rows in the operational `points` table.
 * Single point of truth — must match `consumeAmoeCreditsForEntry` in
 * `lotteryAmoe.ts`.
 */
export const AMOE_ENTRY_SPEND_SOURCE = 'amoe_entry_spend' as const

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Minimal db-pool shape this module needs. Mirrors `amoeReplayStore.ts`
 * for consistency with the rest of the AMOE server-side code.
 */
export type AmoeProjectorDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

/**
 * Row shape returned by reading a candidate burn from L0.
 *
 * Note: `wallet_address` and `twitter_credit_nullifier_hex` are NOT on
 * `points` — they come from the entry-submission record (looked up via
 * the caller-supplied `lookupBurnContext`).
 */
export interface AmoeBurnContextLookupArgs {
  /** L0 points row id. */
  sourcePointsId: bigint
  /** L0 signup_id (profiles.id). */
  signupId: bigint
  /** L0 source_id (= the spendRefId used at debit time). */
  spendRefId: string
}

export interface AmoeBurnContext {
  /** EVM wallet address as hex (with or without 0x). */
  walletAddress: string
  /** twitterCreditNullifier as 0x-hex (32 bytes). */
  twitterCreditNullifierHex: string
}

/**
 * Args for {@link projectAmoeBurnsToLedger}. The lookup callback is
 * required because the wallet + twitter-credit-nullifier needed to
 * compute `walletAddrCommit` live on the entry-submission record, not
 * on the `points` row. Tests pass an in-memory map; PR 5b's cron joins
 * against `amoe_zk_submissions`.
 */
export interface ProjectAmoeBurnsToLedgerArgs {
  /** Database client. */
  db: AmoeProjectorDb
  /**
   * Epoch to project. Only `points` rows whose `created_at` falls in this
   * epoch are considered.
   */
  epoch: bigint
  /** UUID identifying the publisher run that owns these projections. */
  publisherRunId: string
  /**
   * Resolve the wallet + twitter-credit nullifier for a given burn. Must
   * return `null` for burns without a matching entry-submission (the
   * projector then SKIPS that row — it cannot project a burn it cannot
   * bind to a wallet). Skipped rows are returned in the `skipped` count
   * for observability.
   */
  lookupBurnContext: (
    args: AmoeBurnContextLookupArgs,
  ) => Promise<AmoeBurnContext | null>
  /**
   * Optional: cap on how many rows to project per call. Defaults to 1000.
   * The publisher cron pages through epochs in chunks to bound a single
   * transaction's size.
   */
  batchSize?: number
  /**
   * Optional cursor: only consider candidate rows whose `points.id` is
   * strictly greater than this value. The publisher uses this to advance
   * past rows that were permanently skipped (e.g. missing burn context),
   * which would otherwise occupy the head of every batch and starve
   * later rows. Defaults to 0n (start from the beginning of the epoch).
   *
   * Note: this is an *additional* filter on top of the anti-join against
   * `amoe_points_burn_ledger.source_points_id`. Already-projected rows
   * are always excluded, so re-running with `afterId = 0n` is safe and
   * idempotent — the cursor is only useful as a starvation escape valve.
   */
  afterId?: bigint
}

export interface ProjectedBurnRow {
  signupId: bigint
  spendRefId: string
  pointsBurned: bigint
  epoch: bigint
  walletAddress: string
  twitterCreditNullifierHex: string
  signupIdHashHex: string
  spendRefIdHashHex: string
  pointsBurnedAsUSD: bigint
  walletAddrCommitHex: string
  leafHashHex: string
  sourcePointsId: bigint
  publisherRunId: string
}

export interface ProjectAmoeBurnsToLedgerResult {
  /** Total candidate L0 rows scanned for the epoch. */
  scanned: number
  /** Rows projected (newly inserted into L1). */
  projected: number
  /** Rows already present in L1 (idempotent re-run). */
  alreadyPresent: number
  /** Rows the lookup callback returned `null` for; skipped + counted. */
  skippedMissingContext: number
  /** Rows projected this run (for downstream verification). */
  rows: ProjectedBurnRow[]
  /**
   * Highest `points.id` observed in this batch (or `null` if `scanned == 0`).
   * Callers paging through a large epoch should pass this back as
   * `afterId` on the next call to advance past permanently-skipped rows.
   */
  lastScannedId: bigint | null
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/**
 * Encode a non-negative bigint as 0x-hex bytes32. Used for the *_hex
 * columns in `amoe_points_burn_ledger`.
 */
function bigintToHex32(value: bigint): string {
  if (value < 0n) {
    throw new Error(`bigintToHex32: negative value ${value.toString()}`)
  }
  // Cap at bytes32 domain (2^256 - 1). Field elements < Q satisfy this.
  const bytes = bigintToBe32Bytes(value)
  let s = '0x'
  for (let i = 0; i < 32; i += 1) {
    s += (bytes[i] ?? 0).toString(16).padStart(2, '0')
  }
  return s
}

/**
 * Parse a 0x-hex (or unprefixed hex) wallet address into a uint160 bigint.
 * Throws on malformed input.
 */
function walletHexToBigint(walletHex: string): bigint {
  const raw = String(walletHex ?? '').trim()
  const hex = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw
  if (hex.length !== 40 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`walletHexToBigint: malformed wallet address ${walletHex}`)
  }
  return BigInt(`0x${hex}`)
}

/**
 * Parse a 0x-hex bytes32 into a non-negative bigint < Q. Used for
 * twitterCreditNullifier (which is already canonicalized upstream).
 */
function hex32ToBigint(name: string, hex: string): bigint {
  const raw = String(hex ?? '').trim()
  const stripped = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw
  if (stripped.length !== 64 || !/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error(`${name}: malformed bytes32 hex ${hex}`)
  }
  const v = BigInt(`0x${stripped}`)
  if (v >= AMOE_BN254_FIELD_MODULUS) {
    // The canonical form mod Q is what every other AMOE module produces;
    // a non-canonical input here would silently desync from the witness.
    throw new Error(`${name}: value not canonical (>= field modulus)`)
  }
  return v
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Project AMOE points-burn rows for a single epoch from L0 (`points`) into
 * L1 (`amoe_points_burn_ledger`). Idempotent and side-effect-free for
 * already-projected rows (UNIQUE on `source_points_id`). Throws if the
 * AMOE signup salt is misconfigured.
 *
 * Returns a per-run report describing what was done. Callers (the cron
 * in PR 5b, fixture tests) can use this to assert convergence.
 */
export async function projectAmoeBurnsToLedger(
  args: ProjectAmoeBurnsToLedgerArgs,
): Promise<ProjectAmoeBurnsToLedgerResult> {
  const batchSize = Math.max(1, Math.floor(args.batchSize ?? 1000))
  const salt = readAmoeSignupSalt()

  // Step 1: Pull candidate L0 rows for this epoch. The epoch boundary is
  // computed in JS, but the SQL filter narrows the timestamp window so the
  // projector doesn't scan the entire `points` table on each call.
  //
  // genesis + E*L  <=  created_at  <  genesis + (E+1)*L
  //
  // We pass the bounds as Postgres `to_timestamp(seconds)` to avoid string
  // parsing oddities on the driver side.
  const epoch = args.epoch
  if (typeof epoch !== 'bigint' || epoch < 0n) {
    throw new Error(`projectAmoeBurnsToLedger: invalid epoch ${epoch}`)
  }

  // Bound the SQL scan to this epoch's [start, end) window so we don't
  // table-scan all of `points`. Both modules import the same
  // AMOE_EPOCH_GENESIS_SECONDS / AMOE_EPOCH_LENGTH_SECONDS constants so
  // the boundary computed here matches `epochForTimestamp` exactly.
  const epochStartSec = AMOE_EPOCH_GENESIS_SECONDS + epoch * AMOE_EPOCH_LENGTH_SECONDS
  const epochEndSec = epochStartSec + AMOE_EPOCH_LENGTH_SECONDS

  // Anti-join against amoe_points_burn_ledger so already-projected rows
  // are excluded from the candidate scan. Without this, a fixed
  // ORDER BY id ASC LIMIT batchSize would re-read the same earliest rows
  // on every call and rows past the first batch would never be projected
  // in epochs with more than `batchSize` burns.
  //
  // The optional `afterId` cursor is an additional safeguard: rows that
  // are permanently skipped (e.g. lookupBurnContext returns null) never
  // land in L1, so the anti-join would still surface them in every
  // batch. Callers that observe such skips should pass the previous
  // call's `lastScannedId` as `afterId` to advance the window.
  const afterId = typeof args.afterId === 'bigint' && args.afterId >= 0n
    ? args.afterId
    : 0n
  const candidateResult = await args.db.sql`
    SELECT p.id, p.signup_id, p.source_id, p.amount, p.created_at
    FROM points AS p
    WHERE p.source = ${AMOE_ENTRY_SPEND_SOURCE}
      AND p.amount < 0
      AND p.created_at >= to_timestamp(${epochStartSec.toString()}::numeric)
      AND p.created_at <  to_timestamp(${epochEndSec.toString()}::numeric)
      AND p.id > ${afterId.toString()}::bigint
      AND NOT EXISTS (
        SELECT 1
        FROM amoe_points_burn_ledger AS l
        WHERE l.source_points_id = p.id
      )
    ORDER BY p.id ASC
    LIMIT ${batchSize.toString()}::integer
  `
  const candidates = (candidateResult.rows ?? []) as Array<{
    id: number | string | bigint
    signup_id: number | string | bigint
    source_id: string | null
    amount: number | string
    created_at: Date | string
  }>

  // Track the highest scanned id so the publisher can advance its
  // cursor past permanently-skipped rows on the next call.
  let lastScannedId: bigint | null = null
  for (const cand of candidates) {
    const candId = BigInt(cand.id as string | number | bigint)
    if (lastScannedId === null || candId > lastScannedId) {
      lastScannedId = candId
    }
  }

  const result: ProjectAmoeBurnsToLedgerResult = {
    scanned: candidates.length,
    projected: 0,
    alreadyPresent: 0,
    skippedMissingContext: 0,
    rows: [],
    lastScannedId,
  }

  for (const cand of candidates) {
    const sourcePointsId = BigInt(cand.id as string | number | bigint)
    const signupId = BigInt(cand.signup_id as string | number | bigint)
    const spendRefId = String(cand.source_id ?? '').trim()
    if (spendRefId.length === 0) {
      // A burn row with no source_id can't be deduped — skip and let
      // observability flag it. (The current consumeAmoeCreditsForEntry
      // path always sets source_id; this branch exists for forward-compat
      // robustness.)
      result.skippedMissingContext += 1
      continue
    }

    const amountSigned = BigInt(cand.amount as string | number)
    const pointsBurned = amountSigned < 0n ? -amountSigned : amountSigned
    if (pointsBurned < 100n || pointsBurned > 1_000_000n) {
      // Outside locked AMOE bounds — don't project. Ops can investigate.
      result.skippedMissingContext += 1
      continue
    }

    // Recompute the epoch from the actual created_at and assert it
    // matches the requested epoch. SQL filter is inclusive of start /
    // exclusive of end, so this should always agree — the assertion
    // catches a class of timezone bugs cheaply.
    const createdAtMs =
      cand.created_at instanceof Date
        ? cand.created_at.getTime()
        : new Date(String(cand.created_at)).getTime()
    if (!Number.isFinite(createdAtMs)) {
      throw new Error(
        `projectAmoeBurnsToLedger: malformed created_at on points.id=${sourcePointsId}`,
      )
    }
    const computedEpoch = epochForTimestamp(BigInt(Math.floor(createdAtMs / 1000)))
    if (computedEpoch !== epoch) {
      throw new Error(
        `projectAmoeBurnsToLedger: epoch mismatch on points.id=${sourcePointsId} (computed=${computedEpoch.toString()}, requested=${epoch.toString()})`,
      )
    }

    // Step 2: resolve the entry-submission context (wallet + twitter
    // credit nullifier). If the lookup returns null, the burn cannot be
    // bound to a wallet commit — skip.
    const ctx = await args.lookupBurnContext({
      sourcePointsId,
      signupId,
      spendRefId,
    })
    if (ctx === null) {
      result.skippedMissingContext += 1
      continue
    }

    // Step 3: derive every field element and the leaf hash. This must
    // produce values bit-identical to what the prover will compute when
    // the same burn is re-derived for proof generation.
    const signupIdHash = deriveSignupIdHash({ profileId: signupId, salt })
    const spendRefIdHash = deriveSpendRefIdHash({ spendRefId, salt })
    const pointsBurnedAsUSD = pointsBurned * AMOE_POINTS_TO_USD_E6
    if (pointsBurnedAsUSD > AMOE_MAX_POINTS_BURNED_AS_USD) {
      // The locked-spec cap (10^10) is well below 2^64 - 1, so this
      // branch is unreachable for any in-bounds `pointsBurned`. Defensive
      // assertion — a bug in `AMOE_POINTS_TO_USD_E6` would otherwise emit
      // an out-of-domain field element.
      throw new Error(
        `projectAmoeBurnsToLedger: pointsBurnedAsUSD ${pointsBurnedAsUSD} exceeds circuit bound`,
      )
    }
    const walletBigint = walletHexToBigint(ctx.walletAddress)
    const twitterCreditNullifier = hex32ToBigint(
      'twitterCreditNullifier',
      ctx.twitterCreditNullifierHex,
    )
    const walletAddrCommit = computeAmoeWalletAddrCommit(
      walletBigint,
      twitterCreditNullifier,
    )
    const leafHash = computeAmoeLedgerLeaf(
      signupIdHash,
      spendRefIdHash,
      pointsBurnedAsUSD,
      epoch,
      walletAddrCommit,
    )

    // Step 4: insert. UNIQUE(source_points_id) makes this idempotent —
    // re-projecting the same row is a no-op. We use ON CONFLICT DO NOTHING
    // and use RETURNING to detect whether the insert was applied vs
    // silently skipped (already-present case).
    const insertRes = await args.db.sql`
      INSERT INTO amoe_points_burn_ledger (
        signup_id,
        spend_ref_id,
        points_burned,
        epoch,
        wallet_address,
        twitter_credit_nullifier_hex,
        signup_id_hash_hex,
        spend_ref_id_hash_hex,
        points_burned_as_usd,
        wallet_addr_commit_hex,
        leaf_hash_hex,
        source_points_id,
        publisher_run_id
      ) VALUES (
        ${signupId.toString()}::bigint,
        ${spendRefId},
        ${pointsBurned.toString()}::bigint,
        ${epoch.toString()}::bigint,
        ${ctx.walletAddress},
        ${bigintToHex32(twitterCreditNullifier)},
        ${bigintToHex32(signupIdHash)},
        ${bigintToHex32(spendRefIdHash)},
        ${pointsBurnedAsUSD.toString()}::numeric(78,0),
        ${bigintToHex32(walletAddrCommit)},
        ${bigintToHex32(leafHash)},
        ${sourcePointsId.toString()}::bigint,
        ${args.publisherRunId}::uuid
      )
      ON CONFLICT (source_points_id) DO NOTHING
      RETURNING source_points_id
    `
    const inserted = (insertRes.rows ?? []).length > 0
    if (inserted) {
      result.projected += 1
    } else {
      result.alreadyPresent += 1
    }

    // Always emit the projected row in the report — callers may want to
    // audit the row even on idempotent re-runs (e.g. to verify the
    // already-present row matches what we would have produced).
    result.rows.push({
      signupId,
      spendRefId,
      pointsBurned,
      epoch,
      walletAddress: ctx.walletAddress,
      twitterCreditNullifierHex: bigintToHex32(twitterCreditNullifier),
      signupIdHashHex: bigintToHex32(signupIdHash),
      spendRefIdHashHex: bigintToHex32(spendRefIdHash),
      pointsBurnedAsUSD,
      walletAddrCommitHex: bigintToHex32(walletAddrCommit),
      leafHashHex: bigintToHex32(leafHash),
      sourcePointsId,
      publisherRunId: args.publisherRunId,
    })
  }

  return result
}
