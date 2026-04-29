// SPDX-License-Identifier: MIT
//
// PR 4 follow-up — AMOE Poseidon-2 Merkle tree (sparse snapshot).
//
// SCOPE
// =====
// Pure functions for building the two daily Merkle trees the AMOE PLONK
// circuit consumes:
//
//   * Allowlist tree            (leaves = Poseidon2(wallet, epoch))
//   * Points-burn ledger tree   (leaves = Poseidon5(signupIdHash,
//                                spendRefIdHash, pointsBurnedAsUSD, epoch,
//                                walletAddrCommit))
//
// Both trees are conceptually padded to `2^DEPTH` with zero-leaves so the
// circuit's `pathElements` / `pathIndices` arrays line up regardless of
// how many real leaves were inserted. DEPTH is locked at 20 by the .circom
// file (see `circuits/amoe/amoe_eligibility.circom::component main`).
//
// IMPLEMENTATION — SPARSE WITH LITERAL-ZERO SIBLINGS
// ===================================================
// A naïve dense build would Poseidon-hash 2^20 - 1 ≈ 1M nodes — at
// ~250 µs/hash that's ~4 minutes per tree, which is unacceptable for
// every test run AND for the daily publisher when only a few hundred
// real leaves exist.
//
// The AMOE circuit uses a non-standard convention (see
// `AMOE_MERKLE_ZERO_HASHES` below): empty siblings at *every* level are
// the literal field-element `0`, not the zero-subtree hash. This is
// what `circuits/amoe/build/input_v2.json` encodes and what we must
// match bit-exactly.
//
// We exploit that by materializing only the nodes on the path from each
// real leaf to the root. With `n` real leaves this is at most
// `n * DEPTH` Poseidon hashes. Empty siblings during path extraction
// read literal `0`. For the canonical single-leaf fixture configuration
// (n=1) that's 20 Poseidon hashes — ~10 ms.
//
// IMPORTANT: with the literal-0 sibling convention, this snapshot does
// NOT model a textbook dense tree of zero leaves. It models a Merkle
// path commitment where each leaf is bound to its index by the
// `pathIndices` bits. Multi-leaf snapshots are correct only when leaves
// occupy indices whose paths to the root don't collide — the daily
// publisher (deferred to a later PR per #403 §2) is responsible for the
// index assignment scheme.
//
// Memory: a Map<bigint, bigint> keyed by node coordinate
// `(level << 21) | indexAtLevel`. For the full circuit DEPTH=20 the level
// shift fits comfortably in a JS number (max key ≈ 2^25), so we use
// number keys throughout.
//
// HASH FUNCTION
// =============
// We use `poseidon-lite` (no WASM, no async init, ~10 KB). It is
// bit-exactly compatible with circomlib's Poseidon spec on BN254 — this
// has been validated end-to-end against the production circuit using the
// canonical witness fixture in `circuits/amoe/build/input_v2.json`. Every
// hash in this module reproduces bit-exactly the circuit's output for
// that input.
//
// PATH-INDEX CONVENTION (locked by the circuit's MerkleProof template)
// ====================================================================
// `pathIndices[i] = 0` means the current node at level `i` is the LEFT
// child and the sibling in `pathElements[i]` is to the RIGHT. The Mux1
// wiring in the .circom file is:
//
//   left  = (1 - s)*cur + s*sibling
//   right = s*cur       + (1 - s)*sibling
//   parent = Poseidon2(left, right)
//
// Concretely: for leaf at index `i`, the bit at level `L` is
// `(i >> L) & 1` — 0 if `i`'s ancestor at that level is a left child, 1
// otherwise. Get this wrong and snarkjs's witness assertion will fire
// mid-prove with an opaque "Assert Failed" message.

import { poseidon2 } from 'poseidon-lite'

import { AmoeProofGenerationError } from './proveAmoeEntryPlonk.js'

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Locked Merkle tree depth (DEPTH=20) from
 * `circuits/amoe/amoe_eligibility.circom::component main = AmoeEligibility(20)`.
 * Bumping this requires regenerating the circuit + zkey.
 */
export const AMOE_MERKLE_TREE_DEPTH = 20 as const

/**
 * Maximum number of leaves a depth-20 tree can hold (2^20 = 1,048,576).
 * Snapshot construction throws if asked to insert more than this.
 */
export const AMOE_MERKLE_TREE_MAX_LEAVES = 1 << AMOE_MERKLE_TREE_DEPTH

/**
 * Zero-leaf value used to pad a sparse snapshot up to `2^DEPTH`. The .circom
 * file uses raw `0` for empty path positions, so we mirror that here. This
 * matches the canonical fixture (`input_v2.json`) where every
 * `pathElements[i]` is `"0"`.
 */
export const AMOE_MERKLE_ZERO_LEAF = 0n

/**
 * `AMOE_MERKLE_ZERO_HASHES[L]` is the value used for an empty ("missing")
 * sibling at every level of the path. Length is DEPTH+1.
 *
 * IMPORTANT — non-standard convention
 * -----------------------------------
 * In a textbook Merkle tree the empty-subtree value at level `L > 0`
 * would be `Poseidon(Z[L-1], Z[L-1])`. The AMOE circuit, however,
 * consumes `pathElements[i]` directly as the sibling — there is no
 * "is this an empty subtree?" flag — and the canonical fixture
 * (`circuits/amoe/build/input_v2.json`) encodes a single-leaf root with
 * `pathElements = [0, 0, ..., 0]` at every level. The circuit therefore
 * commits to a root computed by hashing `leaf` against literal `0` at
 * every level, NOT against zero-subtree hashes.
 *
 * Concretely: the on-chain semantic of the daily allowlist root for a
 * single allowlisted wallet is
 *   `H(... H(H(Poseidon2(wallet, epoch), 0), 0), ..., 0)`
 * iterated DEPTH times. We mirror that here so the publisher we ship
 * produces roots that round-trip with the existing fixture.
 *
 * Consequence: a wallet's leaf at index `i` is uniquely committed by the
 * `(leaf, [0]*DEPTH)` path regardless of how many other wallets are in
 * the snapshot, as long as those other wallets sit at indices that
 * never share an ancestor with `i`. The publisher (a separate workstream
 * — see #403 §2) is responsible for index assignment.
 */
export const AMOE_MERKLE_ZERO_HASHES: ReadonlyArray<bigint> = Array.from(
  { length: AMOE_MERKLE_TREE_DEPTH + 1 },
  () => 0n,
)

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Sparse snapshot — only stores nodes along the paths from real leaves
 * to the root. Empty subtrees are implied by `AMOE_MERKLE_ZERO_HASHES`.
 *
 * `nodes` keys are `(level << 21) | indexAtLevel`. The shift of 21 is
 * one more than DEPTH so level-0 indices (which can reach 2^20 - 1) never
 * collide with level-1+ indices in the same key.
 */
export interface AmoeMerkleSnapshot {
  /** Map from packed `(level, index)` key to node value. */
  nodes: ReadonlyMap<number, bigint>
  /** The Merkle root. */
  root: bigint
  /** Logical leaf count BEFORE zero-padding (for diagnostics). */
  leafCount: number
  /**
   * Mapping from leaf index → leaf value, kept around so callers can
   * cheaply re-read a leaf they put in (e.g. for membership checks).
   * Sparse — empty positions are absent.
   */
  leavesByIndex: ReadonlyMap<number, bigint>
}

/**
 * Inclusion proof in the shape the circuit consumes — `pathElements` are
 * the sibling values at each level, `pathIndices` are the left/right bits.
 * Both arrays are exactly `DEPTH` long.
 */
export interface AmoeMerklePath {
  pathElements: bigint[]
  pathIndices: bigint[]
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/**
 * Pack a `(level, indexAtLevel)` pair into a single number for use as a
 * Map key. We need `level << 21` because level-0 indices can be up to
 * 2^20 - 1 = 0xFFFFF, and shifting by exactly DEPTH+1 keeps each level's
 * key range disjoint.
 */
function packNodeKey(level: number, indexAtLevel: number): number {
  return (level << 21) | indexAtLevel
}

/**
 * Read a node value from a sparse store, falling back to the zero-subtree
 * hash for that level when the node was never materialized. This is the
 * single place that knows the "absent ⇒ zero subtree" mapping.
 */
function readNode(
  nodes: ReadonlyMap<number, bigint>,
  level: number,
  indexAtLevel: number,
): bigint {
  const key = packNodeKey(level, indexAtLevel)
  const v = nodes.get(key)
  if (v !== undefined) return v
  return AMOE_MERKLE_ZERO_HASHES[level]!
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Build a sparse depth-20 Poseidon Merkle tree snapshot from a list of
 * leaves.
 *
 * Behavior:
 *   * Leaves are inserted in the order provided. The position of each
 *     leaf is its array index — so callers must place each leaf at the
 *     index that corresponds to its slot in the snapshot (e.g. the
 *     allowlist publisher decides on a deterministic ordering).
 *   * Positions beyond `leaves.length` are implicitly
 *     `AMOE_MERKLE_ZERO_LEAF` — they are NOT stored in `nodes`, but
 *     `getAmoeMerklePath` reads them from `AMOE_MERKLE_ZERO_HASHES`.
 *   * `leaves.length > 2^DEPTH` throws
 *     `AmoeProofGenerationError('plonk_witness_input_invalid')`.
 *
 * Cost: `O(n * DEPTH)` Poseidon hashes for `n` leaves. With `n=1` that's
 * 20 hashes — about 5 ms.
 *
 * @throws {AmoeProofGenerationError} on overflow / non-bigint elements.
 */
export function buildAmoeMerkleSnapshot(
  leaves: ReadonlyArray<bigint>,
): AmoeMerkleSnapshot {
  if (!Array.isArray(leaves)) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      'buildAmoeMerkleSnapshot: leaves must be an array',
    )
  }
  if (leaves.length > AMOE_MERKLE_TREE_MAX_LEAVES) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `buildAmoeMerkleSnapshot: ${leaves.length} leaves exceeds the depth-${AMOE_MERKLE_TREE_DEPTH} cap of ${AMOE_MERKLE_TREE_MAX_LEAVES}`,
    )
  }

  const nodes = new Map<number, bigint>()
  const leavesByIndex = new Map<number, bigint>()

  // Step 1: validate + place every real leaf at level 0. Skip values
  // equal to `AMOE_MERKLE_ZERO_LEAF` — they don't need to be stored
  // (they collapse to zero-subtree hashes upstream) and elide the
  // overhead of recomputing redundant ancestors.
  for (let i = 0; i < leaves.length; i++) {
    const v = leaves[i]!
    if (typeof v !== 'bigint') {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_invalid',
        `buildAmoeMerkleSnapshot: leaves[${i}] must be a bigint`,
      )
    }
    if (v < 0n) {
      throw new AmoeProofGenerationError(
        'plonk_witness_input_invalid',
        `buildAmoeMerkleSnapshot: leaves[${i}] is negative`,
      )
    }
    if (v !== AMOE_MERKLE_ZERO_LEAF) {
      nodes.set(packNodeKey(0, i), v)
      leavesByIndex.set(i, v)
    }
  }

  // Step 2: walk up the tree level by level. At each level we visit
  // exactly the parents of every node we've already placed. With the
  // literal-0 sibling convention, an internal node at level `L>0` whose
  // both children are 0 still produces poseidon2(0,0) — but a node at
  // level `L>0` whose value happens to equal 0 cannot be reached by any
  // real leaf placement, so we never observe one. We always store every
  // computed parent to keep readNode lookups deterministic.
  let frontierParents: Set<number> = new Set()
  for (const [key] of nodes) {
    // key was placed at level 0 → parent index is i >> 1
    const i = key & ((1 << 21) - 1)
    frontierParents.add(i >> 1)
  }

  for (let lvl = 1; lvl <= AMOE_MERKLE_TREE_DEPTH; lvl++) {
    const childLevel = lvl - 1
    const nextFrontier = new Set<number>()
    for (const parentIdx of frontierParents) {
      const leftIdx = parentIdx << 1
      const rightIdx = leftIdx | 1
      const left = readNode(nodes, childLevel, leftIdx)
      const right = readNode(nodes, childLevel, rightIdx)
      const parentVal = poseidon2([left, right])
      nodes.set(packNodeKey(lvl, parentIdx), parentVal)
      if (lvl < AMOE_MERKLE_TREE_DEPTH) {
        nextFrontier.add(parentIdx >> 1)
      }
    }
    frontierParents = nextFrontier
  }

  // Step 3: read the root. If no leaves were placed, the root falls
  // through to the literal-0 zero hash at DEPTH (i.e., 0n).
  const root = readNode(nodes, AMOE_MERKLE_TREE_DEPTH, 0)

  return {
    nodes,
    root,
    leafCount: leaves.length,
    leavesByIndex,
  }
}

/**
 * Compute the inclusion path for a leaf at `leafIndex` in a snapshot built
 * by {@link buildAmoeMerkleSnapshot}. Returns sibling values + left/right
 * bits in exactly the shape the circuit's MerkleProof template expects.
 *
 * Empty siblings are read from `AMOE_MERKLE_ZERO_HASHES`, which is
 * indistinguishable from a dense tree's actual zero ancestors.
 *
 * @throws {AmoeProofGenerationError} if `leafIndex` is out of range.
 */
export function getAmoeMerklePath(
  snapshot: AmoeMerkleSnapshot,
  leafIndex: number,
): AmoeMerklePath {
  if (!Number.isInteger(leafIndex) || leafIndex < 0) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `getAmoeMerklePath: leafIndex must be a non-negative integer, got ${leafIndex}`,
    )
  }
  if (leafIndex >= AMOE_MERKLE_TREE_MAX_LEAVES) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `getAmoeMerklePath: leafIndex ${leafIndex} >= 2^${AMOE_MERKLE_TREE_DEPTH}`,
    )
  }

  const pathElements = new Array<bigint>(AMOE_MERKLE_TREE_DEPTH)
  const pathIndices = new Array<bigint>(AMOE_MERKLE_TREE_DEPTH)

  // Walk up the tree. At each level:
  //   * `cursorAtLevel` is the index of our subtree's root at this level.
  //   * `bit = cursorAtLevel & 1` — 0 if we're a left child, 1 if right.
  //   * Sibling index is `cursorAtLevel ^ 1`.
  //   * Move up: cursorAtLevel >>= 1.
  let cursor = leafIndex
  for (let lvl = 0; lvl < AMOE_MERKLE_TREE_DEPTH; lvl++) {
    const siblingIdx = cursor ^ 1
    pathElements[lvl] = readNode(snapshot.nodes, lvl, siblingIdx)
    pathIndices[lvl] = BigInt(cursor & 1)
    cursor >>= 1
  }

  return { pathElements, pathIndices }
}

/**
 * Read the leaf value at `leafIndex` from a snapshot. Returns
 * `AMOE_MERKLE_ZERO_LEAF` if the position was never filled. Used by
 * `amoeWitness.assembleAmoeWitness` to confirm a caller's claimed
 * leaf-index actually contains the leaf they say it does.
 */
export function readAmoeMerkleLeaf(
  snapshot: AmoeMerkleSnapshot,
  leafIndex: number,
): bigint {
  if (!Number.isInteger(leafIndex) || leafIndex < 0) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `readAmoeMerkleLeaf: leafIndex must be a non-negative integer, got ${leafIndex}`,
    )
  }
  if (leafIndex >= AMOE_MERKLE_TREE_MAX_LEAVES) {
    throw new AmoeProofGenerationError(
      'plonk_witness_input_invalid',
      `readAmoeMerkleLeaf: leafIndex ${leafIndex} >= 2^${AMOE_MERKLE_TREE_DEPTH}`,
    )
  }
  const v = snapshot.leavesByIndex.get(leafIndex)
  return v ?? AMOE_MERKLE_ZERO_LEAF
}

/**
 * Verify an inclusion proof against an expected root. Pure helper used in
 * tests and as a defensive sanity check before the witness is handed to
 * snarkjs (catches off-by-one path bugs locally instead of paying snarkjs's
 * 5-30s prove time only to get an opaque assertion).
 *
 * Mirrors the circuit's MerkleProof template logic exactly.
 */
export function verifyAmoeMerklePath(args: {
  leaf: bigint
  root: bigint
  path: AmoeMerklePath
}): boolean {
  const { leaf, root, path } = args
  if (
    path.pathElements.length !== AMOE_MERKLE_TREE_DEPTH ||
    path.pathIndices.length !== AMOE_MERKLE_TREE_DEPTH
  ) {
    return false
  }
  let cur = leaf
  for (let i = 0; i < AMOE_MERKLE_TREE_DEPTH; i++) {
    const bit = path.pathIndices[i]!
    if (bit !== 0n && bit !== 1n) return false
    const sibling = path.pathElements[i]!
    // bit=0 → cur is left, sibling right. bit=1 → cur is right, sibling left.
    cur = bit === 0n ? poseidon2([cur, sibling]) : poseidon2([sibling, cur])
  }
  return cur === root
}
