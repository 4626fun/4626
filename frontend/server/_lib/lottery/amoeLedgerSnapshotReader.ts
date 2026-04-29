// SPDX-License-Identifier: MIT
//
// AMOE points-burn ledger snapshot reader — interface + Postgres impl.
//
// This is the production drop-in for `amoeLedgerSnapshotStub.ts` (PR 3).
// The handler depends only on the interface. The stub returns a
// single-leaf in-memory snapshot; this module returns the real published
// snapshot from `amoe_points_burn_ledger_snapshots` plus the leaf index
// recovered from `amoe_points_burn_ledger`.
//
// SCOPE — PR 5a
// =============
// PR 5a covers the points-burn HALF of the witness's tree context. The
// allowlist half is independent (publisher already exists; that flow is
// untouched here) and will be wired through a sibling reader in a follow-
// up. Until the allowlist publisher PR ships, callers compose this reader
// with the existing single-wallet allowlist builder.
//
// FRESHNESS / STALENESS POLICY
// ============================
// Per design §8, the reader returns the most recent CONFIRMED snapshot
// (`publish_confirmed_at IS NOT NULL`) whose epoch contains the burn.
// State-1 (built, not broadcast) and state-2 (broadcast, not confirmed)
// rows are NOT returned — submitting a proof against them would race the
// on-chain root. Callers see `AmoeServerError('amoe_ledger_snapshot_unavailable')`.
//
// EPOCH ALIGNMENT
// ===============
// The leaf index returned here is recovered from L1 by counting earlier
// rows in the same locked deterministic ordering used by the builder.
// This is the only place we re-derive the index — any caller that asks
// for `(signupId, spendRefId)` gets the canonical index for the epoch
// the L1 row landed in.
//
// See: docs/security/amoe-points-burn-ledger-sot.md §7.

import type { AmoeMerkleSnapshot } from './amoeMerkleTree.js'
import {
  deserializeLedgerTreeBlob,
  type AmoeLedgerTreeBlob,
} from './amoeLedgerSnapshotBuilder.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

// ----------------------------------------------------------------------------
// Public interface
// ----------------------------------------------------------------------------

/**
 * Result returned to the handler / prover for a single burn lookup.
 *
 * Mirrors the relevant fields of `AmoeWitnessTreeContext`'s points-burn
 * half so callers can drop this directly into the witness assembler.
 */
export interface AmoeLedgerSnapshotReadResult {
  /** Epoch the burn was projected into — same as the snapshot's epoch. */
  epoch: bigint
  /** The deserialized Merkle snapshot for this epoch. */
  pointsLedgerSnapshot: AmoeMerkleSnapshot
  /** Leaf index of the burn within `pointsLedgerSnapshot`. */
  pointsLedgerLeafIndex: number
  /** The Merkle root, as 0x-hex bytes32. Convenience — equals snapshot.root. */
  rootHex: `0x${string}`
}

/**
 * Read confirmed snapshots from the AMOE ledger source-of-truth. The PR 3
 * handler dependency-injects an implementation; tests pass an in-memory
 * stub, the publisher cron + handler use {@link AmoeLedgerSnapshotPgReader}.
 */
export interface AmoeLedgerSnapshotReader {
  /**
   * Return the confirmed snapshot for the given burn.
   *
   * @throws AmoeServerError('amoe_ledger_snapshot_unavailable')
   *         when the burn has not yet been projected, OR when the burn's
   *         epoch snapshot has not yet been built / confirmed on-chain.
   *         (The handler maps this to a retryable 503 — the user should
   *         retry once the publisher catches up.)
   */
  readSnapshotForBurn(args: {
    signupId: bigint
    spendRefId: string
  }): Promise<AmoeLedgerSnapshotReadResult>
}

// ----------------------------------------------------------------------------
// Postgres implementation
// ----------------------------------------------------------------------------

export type AmoeSnapshotReaderDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

/**
 * Postgres-backed reader. Holds a reference to the db pool; one instance
 * per process is sufficient.
 */
export class AmoeLedgerSnapshotPgReader implements AmoeLedgerSnapshotReader {
  constructor(private readonly db: AmoeSnapshotReaderDb) {}

  async readSnapshotForBurn(args: {
    signupId: bigint
    spendRefId: string
  }): Promise<AmoeLedgerSnapshotReadResult> {
    if (typeof args.signupId !== 'bigint' || args.signupId <= 0n) {
      throw new Error(
        `readSnapshotForBurn: signupId must be a positive bigint (got ${args.signupId})`,
      )
    }
    const spendRefId = String(args.spendRefId ?? '').trim()
    if (spendRefId.length === 0) {
      throw new Error('readSnapshotForBurn: spendRefId must be a non-empty string')
    }

    // Step 1: locate the L1 row for this burn. There is at most one
    // (PRIMARY KEY (signup_id, spend_ref_id, epoch) — but we filter on
    // signup_id + spend_ref_id, which is unique because a single burn
    // can only appear in one epoch).
    const burnRowResult = await this.db.sql`
      SELECT epoch, projected_at
      FROM amoe_points_burn_ledger
      WHERE signup_id = ${args.signupId.toString()}::bigint
        AND spend_ref_id = ${spendRefId}
      LIMIT 1
    `
    const burnRows = (burnRowResult.rows ?? []) as Array<{
      epoch: number | string | bigint
      projected_at: Date | string
    }>
    if (burnRows.length === 0) {
      throw new AmoeServerError('amoe_ledger_snapshot_unavailable')
    }
    const epoch = BigInt(burnRows[0]!.epoch as string | number | bigint)

    // Step 2: locate the confirmed L2 snapshot for this epoch. We
    // explicitly filter on `publish_confirmed_at IS NOT NULL` to refuse
    // un-confirmed snapshots — the handler must not let a user prove
    // against a root that hasn't landed on-chain.
    const snapshotResult = await this.db.sql`
      SELECT root_hex, tree_blob
      FROM amoe_points_burn_ledger_snapshots
      WHERE epoch = ${epoch.toString()}::bigint
        AND publish_confirmed_at IS NOT NULL
      LIMIT 1
    `
    const snapshotRows = (snapshotResult.rows ?? []) as Array<{
      root_hex: string
      tree_blob: AmoeLedgerTreeBlob | string
    }>
    if (snapshotRows.length === 0) {
      throw new AmoeServerError('amoe_ledger_snapshot_unavailable')
    }
    const blobRaw = snapshotRows[0]!.tree_blob
    // node-postgres returns JSONB columns as already-parsed objects, but
    // some adapter wrappers stringify them. Handle both shapes.
    const blob: AmoeLedgerTreeBlob =
      typeof blobRaw === 'string'
        ? (JSON.parse(blobRaw) as AmoeLedgerTreeBlob)
        : blobRaw

    // Step 3: deserialize the tree, recover the leaf index from the
    // ordered L1 scan. The scan ORDER must match the builder's exactly,
    // which is why both modules pin the same ORDER BY clause.
    const snapshot = deserializeLedgerTreeBlob(blob)

    const indexResult = await this.db.sql`
      SELECT count(*)::bigint AS earlier_count
      FROM amoe_points_burn_ledger AS l
      WHERE l.epoch = ${epoch.toString()}::bigint
        AND (
          (l.projected_at, l.signup_id, l.spend_ref_id)
          <
          (
            (SELECT projected_at FROM amoe_points_burn_ledger
              WHERE signup_id = ${args.signupId.toString()}::bigint
                AND spend_ref_id = ${spendRefId}
                AND epoch = ${epoch.toString()}::bigint
              LIMIT 1),
            ${args.signupId.toString()}::bigint,
            ${spendRefId}
          )
        )
    `
    const indexRows = (indexResult.rows ?? []) as Array<{
      earlier_count: number | string | bigint
    }>
    const earlierCount = BigInt(indexRows[0]?.earlier_count ?? 0n)
    if (earlierCount > BigInt(Number.MAX_SAFE_INTEGER)) {
      // 2^20 caps the tree well below MAX_SAFE_INTEGER, but defend
      // against an anomalous L1 (e.g. mis-projected duplicates).
      throw new Error(
        `readSnapshotForBurn: leaf index ${earlierCount.toString()} exceeds Number.MAX_SAFE_INTEGER`,
      )
    }
    const pointsLedgerLeafIndex = Number(earlierCount)

    return {
      epoch,
      pointsLedgerSnapshot: snapshot,
      pointsLedgerLeafIndex,
      rootHex: snapshotRows[0]!.root_hex as `0x${string}`,
    }
  }
}
