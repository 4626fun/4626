// AMOE wallet allowlist snapshot reader for submit-zk witness assembly.

import type { AmoeMerkleSnapshot } from './amoeMerkleTree.js'
import {
  deserializeAllowlistTreeBlob,
  resolveAllowlistLeafIndex,
  type AmoeAllowlistBuilderDb,
  type AmoeAllowlistTreeBlob,
} from './amoeAllowlistSnapshotBuilder.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

export interface AmoeAllowlistSnapshotReadResult {
  epoch: bigint
  allowlistSnapshot: AmoeMerkleSnapshot
  allowlistLeafIndex: number
  rootHex: `0x${string}`
}

export class AmoeAllowlistSnapshotPgReader {
  constructor(private readonly db: AmoeAllowlistBuilderDb) {}

  async readSnapshotForWallet(args: {
    wallet: `0x${string}`
    epoch: bigint
  }): Promise<AmoeAllowlistSnapshotReadResult> {
    const snapRes = await this.db.sql`
      SELECT epoch, root_hex, tree_blob, publish_confirmed_at
      FROM amoe_wallet_allowlist_snapshots
      WHERE epoch = ${args.epoch.toString()}::bigint
      LIMIT 1
    `
    const row = (snapRes.rows ?? [])[0] as {
      epoch: string | number | bigint
      root_hex: string
      tree_blob: AmoeAllowlistTreeBlob
      publish_confirmed_at: string | Date | null
    } | undefined
    if (!row || row.publish_confirmed_at === null) {
      throw new AmoeServerError('amoe_allowlist_snapshot_unavailable')
    }
    const allowlistLeafIndex = await resolveAllowlistLeafIndex(this.db, args.wallet)
    const allowlistSnapshot = deserializeAllowlistTreeBlob(row.tree_blob)
    return {
      epoch: BigInt(row.epoch as string | number | bigint),
      allowlistSnapshot,
      allowlistLeafIndex,
      rootHex: row.root_hex as `0x${string}`,
    }
  }
}
