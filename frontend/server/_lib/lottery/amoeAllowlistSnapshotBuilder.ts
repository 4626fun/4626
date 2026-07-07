// AMOE wallet allowlist snapshot builder — eligible wallets → Merkle L2 row.

import {
  AMOE_MERKLE_TREE_DEPTH,
  buildAmoeMerkleSnapshot,
  type AmoeMerkleSnapshot,
} from './amoeMerkleTree.js'
import { computeAmoeAllowlistLeaf } from './amoeWitness.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

export type AmoeAllowlistBuilderDb = {
  sql: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: unknown[] }>
}

export interface AmoeAllowlistTreeBlob {
  v: 1
  depth: typeof AMOE_MERKLE_TREE_DEPTH
  leafCount: number
  rootHex: string
  nodes: Array<[number, number, string]>
  leaves: Array<[number, string]>
}

export interface BuildAmoeAllowlistSnapshotArgs {
  db: AmoeAllowlistBuilderDb
  epoch: bigint
  publisherRunId: string
  publisherVersion: string
}

export interface BuildAmoeAllowlistSnapshotResult {
  epoch: bigint
  leafCount: number
  rootHex: string
  treeBlob: AmoeAllowlistTreeBlob
  snapshot: AmoeMerkleSnapshot
}

function bigintToHex32(value: bigint): string {
  if (value < 0n) throw new Error(`bigintToHex32: negative value ${value.toString()}`)
  const hex = value.toString(16)
  if (hex.length > 64) throw new Error(`bigintToHex32: value exceeds 32 bytes`)
  return `0x${hex.padStart(64, '0')}`
}

function hex32ToBigint(label: string, hex: string): bigint {
  const raw = hex.trim()
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(raw)) {
    throw new Error(`${label}: expected 0x-prefixed 32-byte hex, got ${hex}`)
  }
  return BigInt(raw)
}

function walletToBigint(address: string): bigint {
  const raw = address.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) {
    throw new AmoeServerError('amoe_allowlist_invalid_wallet')
  }
  return BigInt(raw)
}

export async function listEligibleAllowlistWallets(
  db: AmoeAllowlistBuilderDb,
): Promise<readonly `0x${string}`[]> {
  const result = await db.sql`
    SELECT DISTINCT LOWER(COALESCE(NULLIF(btrim(p.csw_address), ''), NULLIF(btrim(p.primary_wallet), ''))) AS wallet
    FROM points_amoe_eligible_balance b
    JOIN profiles p ON p.id = b.signup_id
    WHERE b.credits > 0
      AND COALESCE(NULLIF(btrim(p.csw_address), ''), NULLIF(btrim(p.primary_wallet), '')) IS NOT NULL
    ORDER BY wallet ASC
  `
  const rows = (result.rows ?? []) as Array<{ wallet: string }>
  return rows
    .map((r) => r.wallet as `0x${string}`)
    .filter((w) => /^0x[a-f0-9]{40}$/.test(w))
}

export function buildAllowlistSnapshotFromWallets(
  wallets: readonly `0x${string}`[],
  epoch: bigint,
): AmoeMerkleSnapshot {
  const leaves = wallets.map((w) => computeAmoeAllowlistLeaf(walletToBigint(w), epoch))
  return buildAmoeMerkleSnapshot(leaves)
}

export async function buildAmoeAllowlistSnapshot(
  args: BuildAmoeAllowlistSnapshotArgs,
): Promise<BuildAmoeAllowlistSnapshotResult> {
  const wallets = await listEligibleAllowlistWallets(args.db)
  const snapshot = buildAllowlistSnapshotFromWallets(wallets, args.epoch)

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

  const treeBlob: AmoeAllowlistTreeBlob = {
    v: 1,
    depth: AMOE_MERKLE_TREE_DEPTH,
    leafCount: snapshot.leafCount,
    rootHex: bigintToHex32(snapshot.root),
    nodes,
    leaves: leavesEncoded,
  }

  const insertResult = await args.db.sql`
    INSERT INTO amoe_wallet_allowlist_snapshots (
      epoch, leaf_count, root_hex, tree_depth, tree_blob,
      publisher_run_id, publisher_version
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
    throw new AmoeServerError('amoe_allowlist_snapshot_already_built')
  }

  return {
    epoch: args.epoch,
    leafCount: snapshot.leafCount,
    rootHex: treeBlob.rootHex,
    treeBlob,
    snapshot,
  }
}

export function deserializeAllowlistTreeBlob(blob: AmoeAllowlistTreeBlob): AmoeMerkleSnapshot {
  if (blob.v !== 1 || blob.depth !== AMOE_MERKLE_TREE_DEPTH) {
    throw new AmoeServerError('amoe_allowlist_tree_blob_version_mismatch')
  }
  const nodes = new Map<number, bigint>()
  for (let i = 0; i < blob.nodes.length; i += 1) {
    const entry = blob.nodes[i]!
    const [level, indexAtLevel, valueHex] = entry
    const packedKey = (level << 21) | indexAtLevel
    nodes.set(packedKey, hex32ToBigint(`nodes[${i}]`, valueHex))
  }
  const leavesByIndex = new Map<number, bigint>()
  for (let i = 0; i < blob.leaves.length; i += 1) {
    const entry = blob.leaves[i]!
    leavesByIndex.set(entry[0], hex32ToBigint(`leaves[${i}]`, entry[1]))
  }
  return {
    nodes,
    leavesByIndex,
    leafCount: blob.leafCount,
    root: hex32ToBigint('rootHex', blob.rootHex),
  }
}

export async function resolveAllowlistLeafIndex(
  db: AmoeAllowlistBuilderDb,
  wallet: `0x${string}`,
): Promise<number> {
  const wallets = await listEligibleAllowlistWallets(db)
  const idx = wallets.findIndex((w) => w.toLowerCase() === wallet.toLowerCase())
  if (idx < 0) throw new AmoeServerError('amoe_allowlist_wallet_not_eligible')
  return idx
}
