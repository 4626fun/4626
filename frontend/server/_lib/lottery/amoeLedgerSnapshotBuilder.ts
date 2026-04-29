// SPDX-License-Identifier: MIT
//
// AMOE points-burn Merkle snapshot builder — L1 → L2.
//
// Reads every projected row in `amoe_points_burn_ledger` for an epoch,
// orders them deterministically, builds the depth-20 Poseidon Merkle tree
// via `amoeMerkleTree.ts`, and inserts a row into
// `amoe_points_burn_ledger_snapshots` in state 1 (built, not yet
// broadcast). The row stays in state 1 until PR 5b's cron broadcasts the
// `setPointsLedgerRoot` tx and transitions it to state 2/3.
//
// LEAF-ASSIGNMENT POLICY (LOCKED)
// ===============================
// Leaves are placed in the tree at indices `[0, leafCount)` in this order:
//
//   ORDER BY epoch ASC, projected_at ASC, signup_id ASC, spend_ref_id ASC
//
// This matches `amoe_points_burn_ledger_epoch_position_idx`. The order is
// total (the (signup_id, spend_ref_id) PK breaks ties on the timestamp)
// and stable across re-runs because once a row is projected its
// `projected_at` is frozen. The position assigned to a burn row in this
// epoch is therefore deterministic — the publisher and the prover both
// re-derive the index by counting earlier rows in the same ordering.
//
// CIRCUIT COMPATIBILITY
// =====================
// The tree is depth-20 sparse with literal-zero siblings, exactly the
// shape `amoe_eligibility.circom::component main = AmoeEligibility(20)`
// consumes. Each leaf is `Poseidon5(signupIdHash, spendRefIdHash,
// pointsBurnedAsUSD, epoch, walletAddrCommit)` (we read the precomputed
// `leaf_hash_hex` rather than re-Poseidon-ing on the fly — the projector
// already pinned this and re-deriving here is wasted work that could
// drift if Poseidon implementations are upgraded asynchronously).
//
// IDEMPOTENCY
// ===========
// `amoe_points_burn_ledger_snapshots.epoch` is the primary key. Re-running
// the builder for an already-built epoch is rejected with
// `AmoeServerError('amoe_ledger_snapshot_already_built')` — callers that
// want to rebuild must delete the row first (only valid in state 1, and
// only via an ops runbook). State-2 / state-3 rows are immutable.
//
// See: docs/security/amoe-points-burn-ledger-sot.md §5, §6.

import {
  AMOE_MERKLE_TREE_DEPTH,
  buildAmoeMerkleSnapshot,
  type AmoeMerkleSnapshot,
} from './amoeMerkleTree.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Db pool shape this module needs (matches `amoeLedgerProjector.ts`). */
export type AmoeSnapshotBuilderDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

export interface BuildAmoeLedgerSnapshotArgs {
  db: AmoeSnapshotBuilderDb
  epoch: bigint
  publisherRunId: string
  /**
   * Git SHA (or other version tag) of the publisher binary writing this
   * snapshot. Pinned in the L2 row for forensics — if a circuit
   * regression turns up, we can identify which publisher revision produced
   * each affected snapshot.
   */
  publisherVersion: string
}

export interface BuildAmoeLedgerSnapshotResult {
  epoch: bigint
  leafCount: number
  rootHex: string
  /**
   * The serialized JSONB blob that was stored. Useful for tests + for the
   * cron to log a content hash without re-querying.
   */
  treeBlob: AmoeLedgerTreeBlob
  /**
   * The in-memory `AmoeMerkleSnapshot` produced. Returned for unit tests
   * that want to verify a path against the live tree. Not used by the
   * cron path.
   */
  snapshot: AmoeMerkleSnapshot
}

/**
 * Wire-format of the JSONB `tree_blob` column. Encoded as a tagged shape
 * (`v: 1`) so future tree-format changes can be detected without a schema
 * migration. The reader (`amoeLedgerSnapshotPg.ts`) refuses any other `v`.
 */
export interface AmoeLedgerTreeBlob {
  v: 1
  depth: number
  leafCount: number
  rootHex: string
  /**
   * Materialized non-zero internal nodes, as `[level, indexAtLevel,
   * value_hex]`. Only nodes on the path from a real leaf to the root.
   * Empty subtrees are reconstructed by the reader from
   * AMOE_MERKLE_ZERO_HASHES.
   */
  nodes: Array<[number, number, string]>
  /** Leaves indexed by tree position, `[leafIndex, value_hex]`. */
  leaves: Array<[number, string]>
}

// ----------------------------------------------------------------------------
// Hex helpers (avoid pulling viem into a hot DB path)
// ----------------------------------------------------------------------------

/**
 * Encode a non-negative bigint as a 0x-hex bytes32 string, big-endian.
 */
function bigintToHex32(value: bigint): string {
  if (value < 0n) {
    throw new Error(`bigintToHex32: negative value ${value.toString()}`)
  }
  let hex = value.toString(16)
  if (hex.length > 64) {
    throw new Error(`bigintToHex32: value exceeds 32 bytes (${hex.length / 2}b)`)
  }
  return `0x${hex.padStart(64, '0')}`
}

/**
 * Parse a 0x-hex bytes32 string into a bigint. Accepts any valid hex
 * length up to 64 chars and zero-extends. Throws on non-hex input.
 */
function hex32ToBigint(name: string, hex: string): bigint {
  const raw = String(hex ?? '').trim()
  const stripped = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw
  if (stripped.length === 0 || stripped.length > 64) {
    throw new Error(`${name}: invalid hex length (${stripped.length})`)
  }
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error(`${name}: invalid hex characters`)
  }
  return BigInt(`0x${stripped}`)
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Build the Merkle snapshot for a single epoch. Reads every L1 row in the
 * locked deterministic order, hashes the depth-20 sparse tree, and writes
 * the L2 row in state 1. Returns the snapshot for caller verification.
 *
 * @throws AmoeServerError('amoe_ledger_snapshot_already_built') if a
 *         snapshot already exists for this epoch.
 * @throws AmoeServerError('amoe_ledger_snapshot_too_many_leaves') if the
 *         epoch holds more than 2^20 burns (publisher cap).
 * @throws Error on malformed leaf hex in L1 (defensive — the projector
 *         already validates).
 */
export async function buildAmoeLedgerSnapshot(
  args: BuildAmoeLedgerSnapshotArgs,
): Promise<BuildAmoeLedgerSnapshotResult> {
  if (typeof args.epoch !== 'bigint' || args.epoch < 0n) {
    throw new Error(`buildAmoeLedgerSnapshot: invalid epoch ${args.epoch}`)
  }

  // Step 1: pre-flight — refuse to rebuild a published snapshot.
  const existing = await args.db.sql`
    SELECT epoch
    FROM amoe_points_burn_ledger_snapshots
    WHERE epoch = ${args.epoch.toString()}::bigint
    LIMIT 1
  `
  if ((existing.rows ?? []).length > 0) {
    throw new AmoeServerError('amoe_ledger_snapshot_already_built')
  }

  // Step 2: read every L1 row for this epoch in the locked order. The
  // ordering is what determines each leaf's index in the tree, so it
  // must match `amoe_points_burn_ledger_epoch_position_idx` and the
  // reader's index-recovery logic exactly.
  const leafRows = await args.db.sql`
    SELECT
      signup_id,
      spend_ref_id,
      leaf_hash_hex,
      projected_at
    FROM amoe_points_burn_ledger
    WHERE epoch = ${args.epoch.toString()}::bigint
    ORDER BY projected_at ASC, signup_id ASC, spend_ref_id ASC
  `
  const rows = (leafRows.rows ?? []) as Array<{
    signup_id: number | string | bigint
    spend_ref_id: string
    leaf_hash_hex: string
    projected_at: Date | string
  }>

  // Step 3: extract the leaves into bigint form. Refuse > 2^20 — that is
  // the depth-20 capacity, and getting near it indicates an AMOE volume
  // spike that warrants attention before we silently truncate.
  if (rows.length > (1 << AMOE_MERKLE_TREE_DEPTH)) {
    throw new AmoeServerError('amoe_ledger_snapshot_too_many_leaves')
  }
  const leaves: bigint[] = rows.map((row, i) => {
    try {
      return hex32ToBigint(`leaf_hash_hex[${i}]`, row.leaf_hash_hex)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `buildAmoeLedgerSnapshot: malformed leaf at row ${i} (signup_id=${row.signup_id}, spend_ref_id=${row.spend_ref_id}): ${msg}`,
      )
    }
  })

  // Step 4: build the tree.
  const snapshot = buildAmoeMerkleSnapshot(leaves)

  // Step 5: serialize the sparse tree into the wire format. We sort
  // entries deterministically so two builds of the same logical tree
  // produce byte-identical JSONB (helps reproducibility audits).
  const nodes: Array<[number, number, string]> = []
  for (const [packedKey, value] of snapshot.nodes) {
    const level = packedKey >>> 21
    const indexAtLevel = packedKey & ((1 << 21) - 1)
    nodes.push([level, indexAtLevel, bigintToHex32(value)])
  }
  nodes.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  const leavesEncoded: Array<[number, string]> = []
  for (const [idx, value] of snapshot.leavesByIndex) {
    leavesEncoded.push([idx, bigintToHex32(value)])
  }
  leavesEncoded.sort((a, b) => a[0] - b[0])

  const treeBlob: AmoeLedgerTreeBlob = {
    v: 1,
    depth: AMOE_MERKLE_TREE_DEPTH,
    leafCount: snapshot.leafCount,
    rootHex: bigintToHex32(snapshot.root),
    nodes,
    leaves: leavesEncoded,
  }

  // Step 6: insert L2 row in state 1. Use ON CONFLICT DO NOTHING +
  // RETURNING to convert the race (two concurrent builds for the same
  // epoch) into the idempotent "already built" path. The publisher cron
  // (PR 5b) holds a lock that prevents this race operationally; the
  // ON CONFLICT is a defensive safety net.
  const insertResult = await args.db.sql`
    INSERT INTO amoe_points_burn_ledger_snapshots (
      epoch,
      leaf_count,
      root_hex,
      tree_depth,
      tree_blob,
      publisher_run_id,
      publisher_version
    ) VALUES (
      ${args.epoch.toString()}::bigint,
      ${snapshot.leafCount.toString()}::bigint,
      ${treeBlob.rootHex},
      ${AMOE_MERKLE_TREE_DEPTH.toString()}::smallint,
      ${JSON.stringify(treeBlob)}::jsonb,
      ${args.publisherRunId}::uuid,
      ${args.publisherVersion}
    )
    ON CONFLICT (epoch) DO NOTHING
    RETURNING epoch
  `
  if ((insertResult.rows ?? []).length === 0) {
    // Lost the race — another publisher built it first. Surface as the
    // already-built error so the caller's idempotency logic kicks in.
    throw new AmoeServerError('amoe_ledger_snapshot_already_built')
  }

  return {
    epoch: args.epoch,
    leafCount: snapshot.leafCount,
    rootHex: treeBlob.rootHex,
    treeBlob,
    snapshot,
  }
}

/**
 * Reconstruct an `AmoeMerkleSnapshot` from a stored `AmoeLedgerTreeBlob`.
 * Used by the snapshot reader to reissue paths to the prover without
 * recomputing the entire tree on every read.
 *
 * @throws Error on unrecognized blob version or malformed entries.
 */
export function deserializeLedgerTreeBlob(
  blob: AmoeLedgerTreeBlob,
): AmoeMerkleSnapshot {
  if (!blob || typeof blob !== 'object') {
    throw new Error('deserializeLedgerTreeBlob: blob must be an object')
  }
  if (blob.v !== 1) {
    throw new Error(`deserializeLedgerTreeBlob: unrecognized blob version ${blob.v}`)
  }
  if (blob.depth !== AMOE_MERKLE_TREE_DEPTH) {
    throw new Error(
      `deserializeLedgerTreeBlob: depth mismatch (expected ${AMOE_MERKLE_TREE_DEPTH}, got ${blob.depth})`,
    )
  }
  if (!Array.isArray(blob.nodes) || !Array.isArray(blob.leaves)) {
    throw new Error('deserializeLedgerTreeBlob: nodes/leaves must be arrays')
  }

  const nodes = new Map<number, bigint>()
  for (let i = 0; i < blob.nodes.length; i += 1) {
    const entry = blob.nodes[i]!
    if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      typeof entry[0] !== 'number' ||
      typeof entry[1] !== 'number' ||
      typeof entry[2] !== 'string'
    ) {
      throw new Error(`deserializeLedgerTreeBlob: malformed node[${i}]`)
    }
    const [level, indexAtLevel, valueHex] = entry
    if (level < 0 || level > AMOE_MERKLE_TREE_DEPTH) {
      throw new Error(
        `deserializeLedgerTreeBlob: node[${i}] level=${level} out of range`,
      )
    }
    if (indexAtLevel < 0 || indexAtLevel >= 1 << 21) {
      throw new Error(
        `deserializeLedgerTreeBlob: node[${i}] indexAtLevel=${indexAtLevel} out of range`,
      )
    }
    const packedKey = (level << 21) | indexAtLevel
    nodes.set(packedKey, hex32ToBigint(`nodes[${i}].value`, valueHex))
  }

  const leavesByIndex = new Map<number, bigint>()
  for (let i = 0; i < blob.leaves.length; i += 1) {
    const entry = blob.leaves[i]!
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'number' ||
      typeof entry[1] !== 'string'
    ) {
      throw new Error(`deserializeLedgerTreeBlob: malformed leaf[${i}]`)
    }
    leavesByIndex.set(entry[0], hex32ToBigint(`leaves[${i}].value`, entry[1]))
  }

  return {
    nodes,
    leavesByIndex,
    leafCount: blob.leafCount,
    root: hex32ToBigint('blob.rootHex', blob.rootHex),
  }
}
