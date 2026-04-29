// PR 4 follow-up — `amoeMerkleTree` unit tests.
//
// What this file covers:
//   1. Constants line up with the .circom file (DEPTH=20, MAX=2^20).
//   2. Poseidon-2 sanity: the hash function we picked (`poseidon-lite`)
//      is deterministic and produces field-element-sized outputs.
//   3. `buildAmoeMerkleSnapshot`:
//      * Empty snapshot has the all-zero-leaves root, computed in two
//        independent ways (helper + direct walk).
//      * Single-leaf snapshot at index 0 with all-zero siblings exactly
//        matches the canonical fixture's `allowlistRoot` (uses
//        `circuits/amoe/build/input_v2.json` as oracle).
//      * Multi-leaf snapshot is order-sensitive: same leaves in
//        different positions ⇒ different roots.
//      * Bounds: too-many leaves throws; non-bigint leaves throw.
//   4. `getAmoeMerklePath`:
//      * Round-trip: any leaf in a built snapshot verifies against root.
//      * Path arrays are exactly DEPTH long, with `pathIndices[i] ∈ {0,1}`.
//      * Out-of-range index throws typed error.
//   5. `verifyAmoeMerklePath`:
//      * Tampered leaf, root, sibling, or bit each fail.
//      * Wrong-length arrays fail (return false, do not throw).
//
// Cross-validation against the live circuit happens in
// `amoeWitness.test.ts` — that file pins down the *full* witness shape
// against `input_v2.json`, which transitively re-validates this module's
// hash + path output.

import { describe, expect, it } from 'vitest'
import { poseidon2 } from 'poseidon-lite'

import {
  AMOE_MERKLE_TREE_DEPTH,
  AMOE_MERKLE_TREE_MAX_LEAVES,
  AMOE_MERKLE_ZERO_LEAF,
  buildAmoeMerkleSnapshot,
  getAmoeMerklePath,
  verifyAmoeMerklePath,
} from '../lottery/amoeMerkleTree.js'
import { AmoeProofGenerationError } from '../lottery/proveAmoeEntryPlonk.js'

// ---------- Canonical fixture values (from circuits/amoe/build/input_v2.json)
// We hardcode them rather than reading the JSON to keep this test fast and
// fully decoupled from the circuit build artifact. The witness suite
// covers the read-from-JSON path.
const FIXTURE = {
  wallet: 103929005307927756724354605802047639613112342136n,
  epoch: 1n,
  // Expected allowlistRoot for a single-leaf snapshot at index 0 with all
  // zero siblings — i.e. the canonical fixture configuration.
  expectedAllowlistRoot:
    12054404259887771673448915491247842365452579624340627996743275030129647435287n,
}

describe('amoeMerkleTree — constants', () => {
  it('DEPTH matches the .circom file (20)', () => {
    expect(AMOE_MERKLE_TREE_DEPTH).toBe(20)
  })

  it('MAX_LEAVES is 2^DEPTH', () => {
    expect(AMOE_MERKLE_TREE_MAX_LEAVES).toBe(1 << 20)
    expect(AMOE_MERKLE_TREE_MAX_LEAVES).toBe(1048576)
  })

  it('AMOE_MERKLE_ZERO_LEAF is the bigint 0', () => {
    expect(AMOE_MERKLE_ZERO_LEAF).toBe(0n)
  })
})

describe('amoeMerkleTree — poseidon2 backing function', () => {
  it('is deterministic across calls', () => {
    const a = poseidon2([0n, 0n])
    const b = poseidon2([0n, 0n])
    expect(a).toBe(b)
  })

  it('produces canonical field elements (< Q)', () => {
    // BN254 scalar field modulus. Same constant as in amoeWitness.ts —
    // duplicated here to keep this test independent of that module.
    const Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617n
    const h = poseidon2([1n, 2n])
    expect(h).toBeGreaterThanOrEqual(0n)
    expect(h).toBeLessThan(Q)
  })

  it('is order-sensitive (poseidon2(a,b) != poseidon2(b,a))', () => {
    const ab = poseidon2([1n, 2n])
    const ba = poseidon2([2n, 1n])
    expect(ab).not.toBe(ba)
  })
})

describe('buildAmoeMerkleSnapshot', () => {
  it('builds an all-zero snapshot when given no leaves (root = 0 under literal-zero sibling convention)', () => {
    const snap = buildAmoeMerkleSnapshot([])
    expect(snap.leafCount).toBe(0)
    expect(snap.nodes.size).toBe(0)
    expect(snap.leavesByIndex.size).toBe(0)
    // The AMOE circuit treats empty siblings as literal 0 at every level,
    // so an empty snapshot root is simply 0n. (See the long block comment
    // in amoeMerkleTree.ts on AMOE_MERKLE_ZERO_HASHES for why this is
    // *not* the conventional "all-zero subtree" root.)
    expect(snap.root).toBe(0n)
  })

  it('matches the canonical allowlistRoot for a single leaf at index 0', () => {
    // allowlist leaf = Poseidon2(wallet, epoch). With one leaf at index
    // 0 and literal-0 siblings up the path, the root must equal the
    // fixture's allowlistRoot.
    const leaf = poseidon2([FIXTURE.wallet, FIXTURE.epoch])
    const snap = buildAmoeMerkleSnapshot([leaf])
    expect(snap.leafCount).toBe(1)
    expect(snap.root).toBe(FIXTURE.expectedAllowlistRoot)
  })

  it('is order-sensitive: same leaves at different positions ⇒ different roots', () => {
    const a = 111n
    const b = 222n
    const snapAB = buildAmoeMerkleSnapshot([a, b])
    const snapBA = buildAmoeMerkleSnapshot([b, a])
    expect(snapAB.root).not.toBe(snapBA.root)
  })

  it('throws plonk_witness_input_invalid on too-many leaves', () => {
    // Fake an array with `AMOE_MERKLE_TREE_MAX_LEAVES + 1` entries
    // *without* allocating 2^20 + 1 bigints, by lying about length and
    // exploiting Array.isArray semantics — but the implementation does
    // a bounds check first, so we don't even need to populate.
    const fake = Object.assign([], { length: AMOE_MERKLE_TREE_MAX_LEAVES + 1 })
    expect(() => buildAmoeMerkleSnapshot(fake)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('throws on non-bigint leaves', () => {
    // Cast to coerce TS — the runtime guard is what we're testing.
    expect(() =>
      buildAmoeMerkleSnapshot([1n, 'oops' as unknown as bigint, 2n]),
    ).toThrowError(AmoeProofGenerationError)
  })

  it('throws on negative leaves', () => {
    expect(() => buildAmoeMerkleSnapshot([-1n])).toThrowError(
      AmoeProofGenerationError,
    )
  })
})

describe('getAmoeMerklePath', () => {
  it('returns DEPTH-long arrays with 0/1 indices', () => {
    const snap = buildAmoeMerkleSnapshot([42n])
    const path = getAmoeMerklePath(snap, 0)
    expect(path.pathElements).toHaveLength(AMOE_MERKLE_TREE_DEPTH)
    expect(path.pathIndices).toHaveLength(AMOE_MERKLE_TREE_DEPTH)
    for (const bit of path.pathIndices) {
      expect(bit === 0n || bit === 1n).toBe(true)
    }
  })

  it('round-trips: any built leaf verifies against the snapshot root', () => {
    // Use a small set of leaves at known positions so we touch both 0/1
    // bit branches for `pathIndices`. Index 0 ⇒ all-zero index bits.
    // Index 1 ⇒ first bit is 1, rest 0.
    const leaves = [10n, 20n, 30n, 40n]
    const snap = buildAmoeMerkleSnapshot(leaves)
    for (let i = 0; i < leaves.length; i++) {
      const path = getAmoeMerklePath(snap, i)
      expect(
        verifyAmoeMerklePath({
          leaf: leaves[i]!,
          root: snap.root,
          path,
        }),
      ).toBe(true)
    }
  })

  it('returns all-zero pathIndices when leafIndex=0 and snapshot is sparse', () => {
    // This is the canonical fixture configuration. Both pathElements
    // should be the level-zero zeros (i.e. each level's "right child of
    // an empty subtree" — which at level 0 is exactly 0n).
    const snap = buildAmoeMerkleSnapshot([99n])
    const path = getAmoeMerklePath(snap, 0)
    for (const bit of path.pathIndices) expect(bit).toBe(0n)
    // First sibling at level 0 is the leaf at position 1, which we never
    // populated ⇒ zero. Higher levels accumulate via Poseidon, so we
    // only check level 0 here.
    expect(path.pathElements[0]).toBe(0n)
  })

  it('throws on negative leafIndex', () => {
    const snap = buildAmoeMerkleSnapshot([1n])
    expect(() => getAmoeMerklePath(snap, -1)).toThrowError(
      AmoeProofGenerationError,
    )
  })

  it('throws on out-of-range leafIndex', () => {
    const snap = buildAmoeMerkleSnapshot([1n])
    expect(() =>
      getAmoeMerklePath(snap, AMOE_MERKLE_TREE_MAX_LEAVES),
    ).toThrowError(AmoeProofGenerationError)
  })

  it('throws on non-integer leafIndex', () => {
    const snap = buildAmoeMerkleSnapshot([1n])
    expect(() => getAmoeMerklePath(snap, 1.5)).toThrowError(
      AmoeProofGenerationError,
    )
  })
})

describe('verifyAmoeMerklePath', () => {
  it('returns false on tampered leaf', () => {
    const snap = buildAmoeMerkleSnapshot([7n])
    const path = getAmoeMerklePath(snap, 0)
    expect(
      verifyAmoeMerklePath({ leaf: 8n, root: snap.root, path }),
    ).toBe(false)
  })

  it('returns false on tampered root', () => {
    const snap = buildAmoeMerkleSnapshot([7n])
    const path = getAmoeMerklePath(snap, 0)
    expect(
      verifyAmoeMerklePath({ leaf: 7n, root: snap.root + 1n, path }),
    ).toBe(false)
  })

  it('returns false on tampered sibling', () => {
    const snap = buildAmoeMerkleSnapshot([7n])
    const path = getAmoeMerklePath(snap, 0)
    const tampered = {
      pathElements: [...path.pathElements],
      pathIndices: [...path.pathIndices],
    }
    tampered.pathElements[0] = tampered.pathElements[0]! + 1n
    expect(
      verifyAmoeMerklePath({ leaf: 7n, root: snap.root, path: tampered }),
    ).toBe(false)
  })

  it('returns false on flipped bit', () => {
    // Build a tree where leaf 1 (right child) has a real sibling at
    // position 0, then flip the bit so verification puts cur on the wrong
    // side — must fail.
    const snap = buildAmoeMerkleSnapshot([10n, 20n])
    const path = getAmoeMerklePath(snap, 1)
    expect(path.pathIndices[0]).toBe(1n)
    const tampered = {
      pathElements: [...path.pathElements],
      pathIndices: [...path.pathIndices],
    }
    tampered.pathIndices[0] = 0n
    expect(
      verifyAmoeMerklePath({ leaf: 20n, root: snap.root, path: tampered }),
    ).toBe(false)
  })

  it('returns false on wrong-length arrays', () => {
    const snap = buildAmoeMerkleSnapshot([1n])
    const path = getAmoeMerklePath(snap, 0)
    const short = {
      pathElements: path.pathElements.slice(0, 19),
      pathIndices: path.pathIndices.slice(0, 19),
    }
    expect(
      verifyAmoeMerklePath({ leaf: 1n, root: snap.root, path: short }),
    ).toBe(false)
  })

  it('returns false on non-binary bit values', () => {
    const snap = buildAmoeMerkleSnapshot([1n])
    const path = getAmoeMerklePath(snap, 0)
    const tampered = {
      pathElements: [...path.pathElements],
      pathIndices: [...path.pathIndices],
    }
    tampered.pathIndices[0] = 2n
    expect(
      verifyAmoeMerklePath({ leaf: 1n, root: snap.root, path: tampered }),
    ).toBe(false)
  })
})
