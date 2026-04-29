// PR 5a — `amoeLedgerSnapshotReader` (Postgres impl) unit tests.
//
// Covers:
//   * AmoeServerError('amoe_ledger_snapshot_unavailable') when the burn
//     row is missing OR the snapshot is unconfirmed.
//   * Filters on `publish_confirmed_at IS NOT NULL` (so state-1 / state-2
//     snapshots are NEVER returned).
//   * Recovers a deterministic leaf index by counting earlier rows in
//     the locked ORDER BY.
//   * Round-trips a real snapshot (build → blob → reader → witness path
//     verification) bit-exactly.
//   * Accepts both string and object JSONB shapes from the driver.

import { describe, expect, it } from 'vitest'

import {
  buildAmoeLedgerSnapshot,
  type AmoeLedgerTreeBlob,
} from '../lottery/amoeLedgerSnapshotBuilder.js'
import {
  AmoeLedgerSnapshotPgReader,
} from '../lottery/amoeLedgerSnapshotReader.js'
import {
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

function hex32(v: bigint): string {
  return '0x' + v.toString(16).padStart(64, '0')
}

describe('AmoeLedgerSnapshotPgReader.readSnapshotForBurn', () => {
  it('throws ledger_snapshot_unavailable when the burn row is missing', async () => {
    const { db } = makeCapturingDb([{ rows: [] }])
    const reader = new AmoeLedgerSnapshotPgReader(db)
    await expect(
      reader.readSnapshotForBurn({ signupId: 1n, spendRefId: 'sref-X' }),
    ).rejects.toThrow(/amoe_ledger_snapshot_unavailable/)
  })

  it('throws ledger_snapshot_unavailable when the snapshot is not yet confirmed', async () => {
    const { calls, db } = makeCapturingDb([
      // L1 lookup hits.
      {
        rows: [
          { epoch: 3, projected_at: new Date('2026-04-30T00:01:00Z') },
        ],
      },
      // L2 lookup misses (no confirmed snapshot).
      { rows: [] },
    ])
    const reader = new AmoeLedgerSnapshotPgReader(db)
    await expect(
      reader.readSnapshotForBurn({ signupId: 1n, spendRefId: 'sref-Y' }),
    ).rejects.toThrow(/amoe_ledger_snapshot_unavailable/)
    // The L2 query MUST filter on publish_confirmed_at IS NOT NULL.
    const l2Text = calls[1]!.textParts.join('?')
    expect(l2Text).toMatch(/publish_confirmed_at\s+IS\s+NOT\s+NULL/i)
  })

  it('round-trips: build → reader → verifyMerklePath works on the recovered snapshot', async () => {
    // Step 1: build a real 3-leaf snapshot via buildAmoeLedgerSnapshot to
    // produce a JSON blob that exercises the same serialization the
    // reader will deserialize.
    const leaves = [11n, 22n, 33n]
    const buildDb = makeCapturingDb([
      { rows: [] }, // pre-flight: no existing snapshot
      {
        rows: leaves.map((leaf, i) => ({
          signup_id: i + 1,
          spend_ref_id: `sref-${i}`,
          leaf_hash_hex: hex32(leaf),
          projected_at: new Date(2026, 4, 30, 0, i + 1),
        })),
      },
      { rows: [{ epoch: 0 }] }, // INSERT
    ])
    const built = await buildAmoeLedgerSnapshot({
      db: buildDb.db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000077',
      publisherVersion: 'test',
    })
    const blob: AmoeLedgerTreeBlob = built.treeBlob

    // Step 2: stage reader db calls. Burn lookup → snapshot lookup → index
    // count. The third query (index count) returns earlier_count = 1
    // because we're asking for the leaf at position 1 ('sref-1').
    const readerDb = makeCapturingDb([
      // L1 burn lookup
      {
        rows: [
          {
            epoch: 0,
            projected_at: new Date(2026, 4, 30, 0, 2),
          },
        ],
      },
      // L2 confirmed snapshot lookup — return our blob (object shape).
      {
        rows: [
          {
            root_hex: blob.rootHex,
            tree_blob: blob,
          },
        ],
      },
      // Index recovery.
      { rows: [{ earlier_count: '1' }] },
    ])
    const reader = new AmoeLedgerSnapshotPgReader(readerDb.db)
    const result = await reader.readSnapshotForBurn({
      signupId: 2n,
      spendRefId: 'sref-1',
    })
    expect(result.epoch).toBe(0n)
    expect(result.pointsLedgerLeafIndex).toBe(1)
    expect(result.rootHex).toBe(blob.rootHex)

    // The recovered snapshot's root must match an independent build for
    // the same leaves.
    const expected = buildAmoeMerkleSnapshot(leaves)
    expect(result.pointsLedgerSnapshot.root).toBe(expected.root)

    // And we should be able to construct + verify a Merkle path against
    // the recovered snapshot for the leaf at index 1 (= leaves[1] = 22n).
    const path = getAmoeMerklePath(result.pointsLedgerSnapshot, 1)
    expect(
      verifyAmoeMerklePath({
        leaf: leaves[1]!,
        root: result.pointsLedgerSnapshot.root,
        path,
      }),
    ).toBe(true)
  })

  it('accepts a stringified JSONB tree_blob (defensive against driver variance)', async () => {
    const leaves = [42n]
    const buildDb = makeCapturingDb([
      { rows: [] },
      {
        rows: [
          {
            signup_id: 1,
            spend_ref_id: 'one',
            leaf_hash_hex: hex32(42n),
            projected_at: new Date('2026-04-30T00:05:00Z'),
          },
        ],
      },
      { rows: [{ epoch: 0 }] },
    ])
    const built = await buildAmoeLedgerSnapshot({
      db: buildDb.db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000088',
      publisherVersion: 'test',
    })

    const readerDb = makeCapturingDb([
      {
        rows: [
          {
            epoch: 0,
            projected_at: new Date('2026-04-30T00:05:00Z'),
          },
        ],
      },
      {
        rows: [
          {
            root_hex: built.rootHex,
            tree_blob: JSON.stringify(built.treeBlob),
          },
        ],
      },
      { rows: [{ earlier_count: '0' }] },
    ])
    const reader = new AmoeLedgerSnapshotPgReader(readerDb.db)
    const result = await reader.readSnapshotForBurn({
      signupId: 1n,
      spendRefId: 'one',
    })
    expect(result.pointsLedgerLeafIndex).toBe(0)
    expect(result.pointsLedgerSnapshot.root).toBe(buildAmoeMerkleSnapshot(leaves).root)
  })

  it('rejects non-positive signupId or empty spendRefId at the API edge', async () => {
    const { db } = makeCapturingDb([])
    const reader = new AmoeLedgerSnapshotPgReader(db)
    await expect(
      reader.readSnapshotForBurn({ signupId: 0n, spendRefId: 'x' }),
    ).rejects.toThrow(/signupId must be a positive bigint/)
    await expect(
      reader.readSnapshotForBurn({ signupId: 1n, spendRefId: '' }),
    ).rejects.toThrow(/spendRefId must be a non-empty string/)
  })
})
