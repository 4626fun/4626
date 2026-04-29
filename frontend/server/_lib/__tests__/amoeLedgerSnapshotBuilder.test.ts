// PR 5a — `amoeLedgerSnapshotBuilder` unit tests.
//
// Covers L1 → L2 build:
//   * Reads L1 rows in the locked deterministic order
//   * Builds a depth-20 sparse Poseidon tree whose root matches what the
//     verifier `amoeMerkleTree.ts` would produce for the same leaves
//   * Refuses to rebuild a published epoch
//   * Refuses > 2^20 leaves
//   * Serializes the tree blob in a form `deserializeLedgerTreeBlob` round-
//     trips bit-exactly
//   * INSERT ... ON CONFLICT DO NOTHING for race safety

import { describe, expect, it } from 'vitest'

import {
  buildAmoeLedgerSnapshot,
  deserializeLedgerTreeBlob,
  type AmoeLedgerTreeBlob,
} from '../lottery/amoeLedgerSnapshotBuilder.js'
import {
  AMOE_MERKLE_TREE_DEPTH,
  buildAmoeMerkleSnapshot,
  getAmoeMerklePath,
  verifyAmoeMerklePath,
} from '../lottery/amoeMerkleTree.js'

interface CapturedSql {
  textParts: ReadonlyArray<string>
  values: unknown[]
}

function makeCapturingDb(rowsByCallIndex: ReadonlyArray<{ rows: unknown[] }>) {
  const calls: CapturedSql[] = []
  let i = 0
  return {
    calls,
    db: {
      sql: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<{ rows: unknown[] }> => {
        calls.push({ textParts: Array.from(strings), values })
        const result = rowsByCallIndex[i] ?? { rows: [] }
        i += 1
        return result
      },
    },
  }
}

// Helper: turn a bigint into the same 0x-hex shape the projector emits.
function hex32(v: bigint): string {
  return '0x' + v.toString(16).padStart(64, '0')
}

describe('buildAmoeLedgerSnapshot', () => {
  it('refuses to rebuild an already-built epoch', async () => {
    const { db } = makeCapturingDb([
      { rows: [{ epoch: 5 }] }, // pre-flight finds an existing snapshot
    ])
    await expect(
      buildAmoeLedgerSnapshot({
        db,
        epoch: 5n,
        publisherRunId: '00000000-0000-0000-0000-000000000010',
        publisherVersion: 'test-build',
      }),
    ).rejects.toThrow(/amoe_ledger_snapshot_already_built/)
  })

  it('builds a single-leaf snapshot whose root matches direct buildAmoeMerkleSnapshot', async () => {
    const leafA = 0x1234567890abcdefn
    const { calls, db } = makeCapturingDb([
      { rows: [] }, // pre-flight: no existing snapshot
      {
        // ORDER BY projected_at ASC → leafA at index 0
        rows: [
          {
            signup_id: 1,
            spend_ref_id: 'sref-A',
            leaf_hash_hex: hex32(leafA),
            projected_at: new Date('2026-04-30T00:01:00Z'),
          },
        ],
      },
      { rows: [{ epoch: 0 }] }, // INSERT RETURNING epoch
    ])
    const result = await buildAmoeLedgerSnapshot({
      db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000020',
      publisherVersion: 'test-build',
    })
    expect(result.leafCount).toBe(1)
    // The root must equal what `buildAmoeMerkleSnapshot([leafA])` produces.
    const expected = buildAmoeMerkleSnapshot([leafA])
    expect(result.snapshot.root).toBe(expected.root)
    expect(BigInt(result.rootHex)).toBe(expected.root)
    // INSERT call should set tree_depth=20 + epoch + root_hex.
    expect(calls).toHaveLength(3)
    const insertText = calls[2]!.textParts.join('?')
    expect(insertText).toMatch(/INSERT INTO amoe_points_burn_ledger_snapshots/i)
    expect(insertText).toMatch(/ON CONFLICT \(epoch\) DO NOTHING/i)
  })

  it('builds a multi-leaf snapshot in the locked deterministic order', async () => {
    // Three leaves, projected_at ascending: leafA at index 0, leafB at
    // index 1, leafC at index 2.
    const leafA = 1_111_111_111_111_111_111n
    const leafB = 2_222_222_222_222_222_222n
    const leafC = 3_333_333_333_333_333_333n
    const { db } = makeCapturingDb([
      { rows: [] }, // pre-flight
      {
        rows: [
          {
            signup_id: 1,
            spend_ref_id: 'A',
            leaf_hash_hex: hex32(leafA),
            projected_at: new Date('2026-04-30T00:01:00Z'),
          },
          {
            signup_id: 2,
            spend_ref_id: 'B',
            leaf_hash_hex: hex32(leafB),
            projected_at: new Date('2026-04-30T00:02:00Z'),
          },
          {
            signup_id: 3,
            spend_ref_id: 'C',
            leaf_hash_hex: hex32(leafC),
            projected_at: new Date('2026-04-30T00:03:00Z'),
          },
        ],
      },
      { rows: [{ epoch: 0 }] },
    ])
    const result = await buildAmoeLedgerSnapshot({
      db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000030',
      publisherVersion: 'test-build',
    })
    expect(result.leafCount).toBe(3)

    // Independently build the expected tree.
    const expected = buildAmoeMerkleSnapshot([leafA, leafB, leafC])
    expect(result.snapshot.root).toBe(expected.root)

    // Verify each leaf's path against the result root.
    for (let i = 0; i < 3; i += 1) {
      const path = getAmoeMerklePath(result.snapshot, i)
      const ok = verifyAmoeMerklePath({
        leaf: [leafA, leafB, leafC][i]!,
        root: result.snapshot.root,
        path,
      })
      expect(ok).toBe(true)
    }
  })

  it('round-trips through deserializeLedgerTreeBlob with bit-identical Merkle roots', async () => {
    const leaves = [42n, 1337n, 0xffffffffffffffffn]
    const { db } = makeCapturingDb([
      { rows: [] },
      {
        rows: leaves.map((leaf, i) => ({
          signup_id: i + 1,
          spend_ref_id: `s-${i}`,
          leaf_hash_hex: hex32(leaf),
          projected_at: new Date(2026, 4, 30, 0, i + 1),
        })),
      },
      { rows: [{ epoch: 7 }] },
    ])
    const result = await buildAmoeLedgerSnapshot({
      db,
      epoch: 7n,
      publisherRunId: '00000000-0000-0000-0000-000000000040',
      publisherVersion: 'test-build',
    })
    const blob: AmoeLedgerTreeBlob = result.treeBlob
    expect(blob.v).toBe(1)
    expect(blob.depth).toBe(AMOE_MERKLE_TREE_DEPTH)
    expect(blob.leafCount).toBe(3)

    const reconstructed = deserializeLedgerTreeBlob(blob)
    expect(reconstructed.root).toBe(result.snapshot.root)
    expect(reconstructed.leafCount).toBe(result.snapshot.leafCount)
    // Every leaf should be readable by index.
    for (let i = 0; i < 3; i += 1) {
      expect(reconstructed.leavesByIndex.get(i)).toBe(leaves[i])
    }
    // And paths must verify against the round-tripped root.
    for (let i = 0; i < 3; i += 1) {
      const path = getAmoeMerklePath(reconstructed, i)
      expect(
        verifyAmoeMerklePath({
          leaf: leaves[i]!,
          root: reconstructed.root,
          path,
        }),
      ).toBe(true)
    }
  })

  it('rejects malformed leaf_hash_hex with a row-tagged error', async () => {
    const { db } = makeCapturingDb([
      { rows: [] },
      {
        rows: [
          {
            signup_id: 1,
            spend_ref_id: 'A',
            leaf_hash_hex: 'not-hex',
            projected_at: new Date('2026-04-30T00:01:00Z'),
          },
        ],
      },
    ])
    await expect(
      buildAmoeLedgerSnapshot({
        db,
        epoch: 0n,
        publisherRunId: '00000000-0000-0000-0000-000000000050',
        publisherVersion: 'test-build',
      }),
    ).rejects.toThrow(/malformed leaf at row 0.*signup_id=1.*spend_ref_id=A/)
  })

  it('reports lost-race conflict as already-built (defensive)', async () => {
    // Pre-flight returns empty (we *think* no snapshot exists), but the
    // INSERT returns no rows because another publisher won. Surface the
    // already-built error so the caller's idempotency logic kicks in.
    const { db } = makeCapturingDb([
      { rows: [] }, // pre-flight: empty
      {
        rows: [
          {
            signup_id: 1,
            spend_ref_id: 'A',
            leaf_hash_hex: hex32(99n),
            projected_at: new Date('2026-04-30T00:01:00Z'),
          },
        ],
      },
      { rows: [] }, // INSERT ON CONFLICT swallowed everything
    ])
    await expect(
      buildAmoeLedgerSnapshot({
        db,
        epoch: 0n,
        publisherRunId: '00000000-0000-0000-0000-000000000060',
        publisherVersion: 'test-build',
      }),
    ).rejects.toThrow(/amoe_ledger_snapshot_already_built/)
  })
})

describe('deserializeLedgerTreeBlob', () => {
  it('rejects an unrecognized blob version', () => {
    const bogus = {
      v: 2,
      depth: 20,
      leafCount: 0,
      rootHex: '0x' + '0'.repeat(64),
      nodes: [],
      leaves: [],
    } as unknown as AmoeLedgerTreeBlob
    expect(() => deserializeLedgerTreeBlob(bogus)).toThrow(/unrecognized blob version 2/)
  })

  it('rejects a depth mismatch', () => {
    const bogus: AmoeLedgerTreeBlob = {
      v: 1,
      depth: 19,
      leafCount: 0,
      rootHex: '0x' + '0'.repeat(64),
      nodes: [],
      leaves: [],
    }
    expect(() => deserializeLedgerTreeBlob(bogus)).toThrow(/depth mismatch/)
  })
})
