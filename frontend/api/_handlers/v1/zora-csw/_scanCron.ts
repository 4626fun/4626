// SPDX-License-Identifier: MIT
//
// Zora CSW scan cron — `GET /api/v1/zora-csw/scan-cron`.
//
// Scheduled every 15 minutes by `frontend/vercel.json:crons`. Each tick:
//   1. Reads `last_scanned_block` from `zora_csw_indexer_state`. If the
//      row is missing, bootstraps it to MAX(creation_block) FROM
//      `zora_csw_owners` so the first tick after deploy doesn't replay
//      the entire history.
//   2. Reads the chain tip from `BASE_RPC_URL`.
//   3. Computes `[fromBlock, toBlock]` honoring SAFETY_CONFIRMATIONS=12
//      and the `INDEXER_GETLOGS_WINDOW` cap (default 10 000 blocks).
//   4. Calls `eth_getLogs` for `ZoraSmartWalletCreated` over the window.
//   5. Upserts new rows into `zora_csw_owners` (ON CONFLICT DO NOTHING)
//      with `current_owners=NULL` so the enrich cron picks them up.
//   6. Bumps the state row's `last_scanned_block` to `toBlock`.
//
// AUTH — Vercel cron-secret bearer
// =================================
// `Authorization: Bearer <CRON_SECRET>` via `isAuthorizedCron`. Spurious
// public probes return 401.
//
// FEATURE FLAG
// ============
// `ZORA_CSW_INDEXER_ENABLED=1` — gates BOTH crons. Default off so the
// PR can merge before flipping in Vercel.
//
// FAILURE MODE
// ============
// We always return 200 with `tick: 'errored'` on RPC/DB exceptions so
// the schedule keeps ticking and observability sees a consistent
// envelope. 401 / 503 are the only non-200 responses (auth / config).

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from '../../../../server/_lib/db/supabaseAdmin.js'
import {
  isZoraCswIndexerEnabled,
  LAST_SCANNED_BLOCK_KEY,
  ZORA_CSW_INDEXER_STATE_TABLE,
  ZORA_CSW_OWNERS_TABLE,
} from '../../../../server/_lib/zora-csw/cronConfig.js'
import {
  fetchCreationsWindow,
  planScanWindow,
  readGetLogsWindow,
  type CswCreation,
} from '../../../../server/_lib/zora-csw/scanCreations.js'

declare const process: { env: Record<string, string | undefined> }

type SupabaseLike = ReturnType<typeof getSupabaseAdmin>

/**
 * Test seam — inject collaborators so handler tests can drive the cron
 * without a real RPC client or Supabase.
 */
export interface ZoraCswScanCronHandlerHooks {
  db?: SupabaseLike
  /** Returns the chain tip block. */
  getTipBlock?: () => Promise<bigint>
  /** Fetches creations for a single window. */
  fetchWindow?: (fromBlock: bigint, toBlock: bigint) => Promise<CswCreation[]>
}

let __testHooks: ZoraCswScanCronHandlerHooks = {}

export function __setZoraCswScanCronHandlerHooksForTest(
  hooks: ZoraCswScanCronHandlerHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetZoraCswScanCronHandlerHooksForTest(): void {
  __testHooks = {}
}

type TickResult =
  | {
      ok: true
      tick: 'idle' | 'scanned' | 'skipped'
      from_block: string | null
      to_block: string | null
      new_csws: number
    }
  | {
      ok: false
      tick: 'errored'
      from_block: string | null
      to_block: string | null
      new_csws: number
      error: string
    }

async function readLastScannedBlock(db: SupabaseLike): Promise<bigint | null> {
  const { data, error } = await db
    .from(ZORA_CSW_INDEXER_STATE_TABLE)
    .select('value')
    .eq('key', LAST_SCANNED_BLOCK_KEY)
    .maybeSingle()
  if (error) throw new Error(`read_state: ${error.message}`)
  if (!data) return null
  const value = (data as { value: { block?: number | string } | null }).value
  if (!value || value.block === undefined || value.block === null) return null
  return BigInt(value.block)
}

async function bootstrapFromOwners(db: SupabaseLike): Promise<bigint | null> {
  const { data, error } = await db
    .from(ZORA_CSW_OWNERS_TABLE)
    .select('creation_block')
    .order('creation_block', { ascending: false })
    .limit(1)
  if (error) throw new Error(`bootstrap_max_block: ${error.message}`)
  const row = (data ?? [])[0] as { creation_block: number | string | null } | undefined
  if (!row || row.creation_block === null || row.creation_block === undefined) return null
  return BigInt(row.creation_block)
}

async function writeLastScannedBlock(db: SupabaseLike, block: bigint): Promise<void> {
  const { error } = await db
    .from(ZORA_CSW_INDEXER_STATE_TABLE)
    .upsert(
      {
        key: LAST_SCANNED_BLOCK_KEY,
        value: { block: block.toString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
  if (error) throw new Error(`write_state: ${error.message}`)
}

async function upsertCreations(
  db: SupabaseLike,
  creations: CswCreation[],
): Promise<number> {
  if (creations.length === 0) return 0
  const rows = creations.map((c) => ({
    csw_address: c.cswAddress,
    base_owner: c.baseOwner,
    initial_owners: c.initialOwners,
    current_owners: null,
    creation_nonce: c.nonce.toString(),
    creation_block: Number(c.blockNumber),
    creation_tx_hash: c.txHash,
    first_indexed_at: new Date().toISOString(),
    source: 'zora_account_manager',
  }))
  // ON CONFLICT (csw_address) DO NOTHING — rows already enriched by an
  // earlier backfill must NOT be reset to current_owners=NULL. Use
  // `ignoreDuplicates: true` (postgrest "Prefer: resolution=ignore-duplicates").
  const { error } = await db
    .from(ZORA_CSW_OWNERS_TABLE)
    .upsert(rows, { onConflict: 'csw_address', ignoreDuplicates: true })
  if (error) throw new Error(`upsert_owners: ${error.message}`)
  return rows.length
}

async function defaultGetTipBlock(): Promise<bigint> {
  const rpcUrl = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!rpcUrl) throw new Error('BASE_RPC_URL not set')
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  return client.getBlockNumber()
}

async function defaultFetchWindow(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<CswCreation[]> {
  const rpcUrl = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!rpcUrl) throw new Error('BASE_RPC_URL not set')
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  return fetchCreationsWindow(client, fromBlock, toBlock)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!isZoraCswIndexerEnabled()) {
    res.status(503).json({ ok: false, error: 'feature_disabled' })
    return
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  if (!__testHooks.db && !isSupabaseAdminConfigured()) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }
  if (!__testHooks.getTipBlock && !String(process.env.BASE_RPC_URL ?? '').trim()) {
    res.status(503).json({ ok: false, error: 'base_rpc_url_not_configured' })
    return
  }

  const db = __testHooks.db ?? getSupabaseAdmin()
  const getTipBlock = __testHooks.getTipBlock ?? defaultGetTipBlock
  const fetchWindow = __testHooks.fetchWindow ?? defaultFetchWindow
  const windowSize = readGetLogsWindow()

  let result: TickResult = {
    ok: true,
    tick: 'idle',
    from_block: null,
    to_block: null,
    new_csws: 0,
  }

  try {
    let lastScanned = await readLastScannedBlock(db)
    if (lastScanned === null) {
      lastScanned = await bootstrapFromOwners(db)
      if (lastScanned === null) {
        // No state row, no owner rows — surface idle so an operator
        // knows to run the manual seed before the next tick.
        res.status(200).json({
          ok: true,
          tick: 'idle',
          from_block: null,
          to_block: null,
          new_csws: 0,
          note: 'no state row and no zora_csw_owners rows; seed last_scanned_block manually before next tick',
        })
        return
      }
    }

    const tipBlock = await getTipBlock()
    const window = planScanWindow({
      tipBlock,
      lastScannedBlock: lastScanned,
      windowSize,
    })
    if (!window) {
      result = {
        ok: true,
        tick: 'skipped',
        from_block: null,
        to_block: null,
        new_csws: 0,
      }
    } else {
      const creations = await fetchWindow(window.fromBlock, window.toBlock)
      const inserted = await upsertCreations(db, creations)
      await writeLastScannedBlock(db, window.toBlock)
      result = {
        ok: true,
        tick: 'scanned',
        from_block: window.fromBlock.toString(),
        to_block: window.toBlock.toString(),
        new_csws: inserted,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.warn('[zora-csw-scan-cron] tick failed', { error: message })
    result = {
      ok: false,
      tick: 'errored',
      from_block: null,
      to_block: null,
      new_csws: 0,
      error: message.slice(0, 500),
    }
  }

  res.status(200).json(result)
}
