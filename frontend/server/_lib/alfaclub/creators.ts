/**
 * AlfaClub creator enumerator.
 *
 * Scans FriendKey `TransferSingle(from=0x0)` logs on Base to identify every
 * tokenId ever minted, pairs each tokenId with its on-chain creator via
 * `creatorByTokenId(tokenId)`, and optionally resolves the per-tokenId
 * staking pool via `stakingPoolByTokenId(tokenId)`.
 *
 * Incremental by design: each run picks up from the last scanned block
 * stored in `alfaclub_indexer_cursor`. If Supabase is unavailable, the
 * indexer still works in-memory for the current call but cannot persist
 * state across cron runs.
 */

import { type Abi, type Address } from 'viem'

import { getDb } from '../db/postgres.js'
import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  ZERO_ADDRESS,
  getAlfaClubPublicClient,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Deploy-era floor for FriendKey mint scanning on Base.
 *
 * Direct onchain probe against the configured FriendKey contract
 * (`0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F`) shows the first
 * `TransferSingle(from=0x0)` mint around block ~40,462,900 and no
 * `TransferBatch(from=0x0)` mints in the historical scan window.
 *
 * Using a floor near 40M avoids spending cron/runtime budget on a long
 * pre-deploy range with guaranteed zero results while still leaving a
 * safety buffer below the first observed mint.
 */
const DEFAULT_DEPLOY_BLOCK = 40_000_000n

/** Max blocks per getLogs call — keep well under public-RPC ceilings. */
const DEFAULT_CHUNK_BLOCKS = 9_900n

/** Safety cap on chunks per invocation so cron stays under Vercel's 300s timeout. */
const DEFAULT_MAX_CHUNKS_PER_RUN = 24

/** Throttle the staking-pool resolver to avoid flooding public RPCs. */
const MAX_POOL_LOOKUPS_PER_RUN = 100

const CURSOR_KEY = 'friend_key_transfer_single_from_zero'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlfaClubCreator = {
  tokenId: bigint
  creatorAddress: Address
  mintedAtBlock: bigint
  stakingPool: Address | null
}

export type IndexerReport = {
  ok: boolean
  reason?: string
  dbConfigured: boolean
  scannedFromBlock: bigint
  scannedToBlock: bigint
  newCreators: number
  totalKnownCreators: number | null
}

type TransferSingleLog = {
  args?: { from?: Address; to?: Address; id?: bigint; value?: bigint }
  blockNumber?: bigint
}

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

async function readCursor(): Promise<bigint | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`
      SELECT last_block::text AS last_block
      FROM alfaclub_indexer_cursor
      WHERE cursor_key = ${CURSOR_KEY}
      LIMIT 1;
    `
    const rows = (result.rows ?? []) as Array<{ last_block: string }>
    const row = rows[0]
    if (!row) return null
    const n = BigInt(row.last_block)
    return n >= 0n ? n : null
  } catch {
    return null
  }
}

async function writeCursor(block: bigint): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.sql`
      INSERT INTO alfaclub_indexer_cursor (cursor_key, last_block, updated_at)
      VALUES (${CURSOR_KEY}, ${block.toString()}, NOW())
      ON CONFLICT (cursor_key) DO UPDATE
      SET last_block = EXCLUDED.last_block, updated_at = NOW();
    `
  } catch {
    // Best-effort cursor write.
  }
}

// ---------------------------------------------------------------------------
// Log scanning
// ---------------------------------------------------------------------------

function parseEnvBigInt(key: string): bigint | null {
  const raw = (process.env[key] ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

/** Returns the configured deploy-block floor. */
export function getAlfaClubDeployBlock(): bigint {
  return parseEnvBigInt('ALFACLUB_FRIEND_KEY_DEPLOY_BLOCK') ?? DEFAULT_DEPLOY_BLOCK
}

/** Returns the scan chunk size. */
export function getAlfaClubScanChunk(): bigint {
  return parseEnvBigInt('ALFACLUB_INDEXER_BLOCK_CHUNK') ?? DEFAULT_CHUNK_BLOCKS
}

/** Returns the max chunks per run. */
export function getAlfaClubMaxChunks(): number {
  const raw = (process.env.ALFACLUB_INDEXER_MAX_CHUNKS ?? '').trim()
  if (!/^\d+$/.test(raw)) return DEFAULT_MAX_CHUNKS_PER_RUN
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_CHUNKS_PER_RUN
  return Math.min(120, Math.floor(n))
}

async function getLatestBlock(client: AlfaClubPublicClientLike): Promise<bigint | null> {
  try {
    const anyClient = client as unknown as {
      getBlockNumber?: () => Promise<bigint>
    }
    if (typeof anyClient.getBlockNumber !== 'function') return null
    const n = await anyClient.getBlockNumber()
    if (typeof n !== 'bigint') return null
    return n
  } catch {
    return null
  }
}

async function scanMintsInRange(
  client: AlfaClubPublicClientLike,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<TransferSingleLog[]> {
  try {
    const logs = (await client.getLogs({
      address: ALFACLUB.friendKey,
      event: FRIEND_KEY_ABI.find(
        (x: Abi[number]) => x.type === 'event' && x.name === 'TransferSingle',
      ),
      args: { from: ZERO_ADDRESS as Address },
      fromBlock,
      toBlock,
    })) as ReadonlyArray<TransferSingleLog>
    return [...logs]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function loadKnownTokenIds(): Promise<Set<string>> {
  const db = await getDb()
  if (!db) return new Set()
  try {
    const result = await db.sql`SELECT token_id FROM alfaclub_creators;`
    const rows = (result.rows ?? []) as Array<{ token_id: string }>
    return new Set(rows.map((r) => String(r.token_id)))
  } catch {
    return new Set()
  }
}

async function upsertCreator(row: AlfaClubCreator): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.sql`
      INSERT INTO alfaclub_creators (token_id, creator_address, minted_at_block, staking_pool, updated_at)
      VALUES (
        ${row.tokenId.toString()},
        ${row.creatorAddress.toLowerCase()},
        ${row.mintedAtBlock.toString()},
        ${row.stakingPool ? row.stakingPool.toLowerCase() : null},
        NOW()
      )
      ON CONFLICT (token_id) DO UPDATE
      SET creator_address = EXCLUDED.creator_address,
          staking_pool    = COALESCE(EXCLUDED.staking_pool, alfaclub_creators.staking_pool),
          updated_at      = NOW();
    `
  } catch {
    // Best-effort.
  }
}

async function countKnownCreators(): Promise<number | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`SELECT COUNT(*)::text AS n FROM alfaclub_creators;`
    const rows = (result.rows ?? []) as Array<{ n: string }>
    const row = rows[0]
    if (!row?.n) return null
    return Number.parseInt(row.n, 10)
  } catch {
    return null
  }
}

/** Return all known (tokenId, creator) pairs, lowercased. */
export async function listAllCreators(): Promise<AlfaClubCreator[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      SELECT token_id, creator_address, minted_at_block::text AS minted_at_block, staking_pool
      FROM alfaclub_creators;
    `
    const rows = (result.rows ?? []) as Array<{
      token_id: string
      creator_address: string
      minted_at_block: string
      staking_pool: string | null
    }>
    return rows.map((r) => ({
      tokenId: BigInt(r.token_id),
      creatorAddress: r.creator_address.toLowerCase() as Address,
      mintedAtBlock: BigInt(r.minted_at_block),
      stakingPool: (r.staking_pool?.toLowerCase() ?? null) as Address | null,
    }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Creator resolver
// ---------------------------------------------------------------------------

async function resolveCreator(
  tokenId: bigint,
  client: AlfaClubPublicClientLike,
): Promise<Address | null> {
  try {
    const creator = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [tokenId],
    })) as Address
    if (!creator || creator.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return null
    return creator
  } catch {
    return null
  }
}

async function resolveStakingPool(
  tokenId: bigint,
  client: AlfaClubPublicClientLike,
): Promise<Address | null> {
  try {
    const pool = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'stakingPoolByTokenId',
      args: [tokenId],
    })) as Address
    if (!pool || pool.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return null
    return pool
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RunIndexerOptions = {
  client?: AlfaClubPublicClientLike
  fromBlock?: bigint
  toBlock?: bigint
  maxChunks?: number
  skipSchemaBootstrap?: boolean
}

/**
 * Scan FriendKey for new creators between the stored cursor (or deploy block)
 * and the chain head. Persists newly-discovered creators in Supabase and
 * advances the cursor. Safe to re-run.
 */
export async function runCreatorIndexer(
  opts: RunIndexerOptions = {},
): Promise<IndexerReport> {
  const client = opts.client ?? (await getAlfaClubPublicClient())

  if (!opts.skipSchemaBootstrap) {
    try {
      await ensureAlfaClubVigilanteSchema()
    } catch {
      // Schema bootstrap failure is fatal for persistence but we still
      // return a report so the caller can decide to continue in-memory.
    }
  }

  const cursor = (await readCursor()) ?? null
  const deployBlock = getAlfaClubDeployBlock()
  const fromBlock =
    opts.fromBlock ?? (cursor !== null ? cursor + 1n : deployBlock)

  const latest = opts.toBlock ?? (await getLatestBlock(client))
  if (latest === null) {
    return {
      ok: false,
      reason: 'no_latest_block',
      dbConfigured: Boolean(await getDb()),
      scannedFromBlock: fromBlock,
      scannedToBlock: fromBlock,
      newCreators: 0,
      totalKnownCreators: await countKnownCreators(),
    }
  }

  if (fromBlock > latest) {
    return {
      ok: true,
      dbConfigured: Boolean(await getDb()),
      scannedFromBlock: fromBlock,
      scannedToBlock: latest,
      newCreators: 0,
      totalKnownCreators: await countKnownCreators(),
    }
  }

  const chunk = getAlfaClubScanChunk()
  const maxChunks = opts.maxChunks ?? getAlfaClubMaxChunks()

  const known = await loadKnownTokenIds()
  const newCreators: AlfaClubCreator[] = []
  const seenInRun = new Set<string>()

  let start = fromBlock
  let lastScanned = start - 1n
  let chunks = 0
  while (start <= latest && chunks < maxChunks) {
    const end = start + chunk > latest ? latest : start + chunk
    const logs = await scanMintsInRange(client, start, end)
    for (const log of logs) {
      const id = log.args?.id
      if (typeof id !== 'bigint') continue
      const idKey = id.toString()
      if (known.has(idKey) || seenInRun.has(idKey)) continue
      seenInRun.add(idKey)
      const creator = await resolveCreator(id, client)
      if (!creator) continue
      const pool =
        newCreators.length < MAX_POOL_LOOKUPS_PER_RUN
          ? await resolveStakingPool(id, client)
          : null
      newCreators.push({
        tokenId: id,
        creatorAddress: creator.toLowerCase() as Address,
        mintedAtBlock: log.blockNumber ?? start,
        stakingPool: pool ? (pool.toLowerCase() as Address) : null,
      })
    }
    lastScanned = end
    start = end + 1n
    chunks += 1
  }

  // Persist one row at a time — these are rare writes.
  for (const c of newCreators) {
    await upsertCreator(c)
  }

  await writeCursor(lastScanned)

  return {
    ok: true,
    dbConfigured: Boolean(await getDb()),
    scannedFromBlock: fromBlock,
    scannedToBlock: lastScanned,
    newCreators: newCreators.length,
    totalKnownCreators: await countKnownCreators(),
  }
}
