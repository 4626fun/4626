import { randomUUID } from 'node:crypto'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { getDb, getDbForCron } from '../db/postgres.js'
import { logger } from '../infra/logger.js'
import { requireServerKey } from '../../zora/_shared.js'
import {
  DEFAULT_HOT_REFRESH_LISTS,
  createDefaultExploreBackfillCheckpoints,
  detectFeeModel,
  extractExploreListEdges,
  feeRateFromModel,
  isExploreBackfillComplete,
  isStaleRunningLock,
  normalizeAddress,
  parseExploreBackfillCheckpoints,
  parseExploreCoinFinancialSnapshot,
  parseTimestamp,
  serializeExploreBackfillCheckpoints,
  toFiniteNumber,
  toIntegerOrNull,
  type ExploreBackfillCheckpoints,
  type ExploreCoinFinancialSnapshot,
  type ExploreList,
} from './creatorMetricsSyncHelpers.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type SyncStatus = 'idle' | 'running' | 'error'

type SyncMode = 'backfill' | 'incremental'

export type CreatorMetricsSyncResult = {
  ok: boolean
  runId: string
  mode: SyncMode
  pagesProcessed: number
  sampledCreators: number
  coinsUpserted: number
  nextCursor: string | null
  backfillComplete: boolean
  syncStatus: SyncStatus
  driftEstimateTotal: number | null
  driftPct: number | null
  deadLetters: number
  error?: string
}

type StateRow = {
  checkpointCursor: string | null
  checkpointBlock: bigint | null
  checkpointLogIndex: number | null
  backfillComplete: boolean
  syncStatus: SyncStatus
}

type CoinCandidate = {
  address?: unknown
  creatorAddress?: unknown
  payoutRecipientAddress?: unknown
  createdAt?: unknown
  marketCap?: unknown
  volume24h?: unknown
  chainId?: unknown
  market?: { protocolVersion?: unknown; feeBps?: unknown } | null
}

const BASE_CHAIN_ID = 8453
const BASE_CHAIN_NAME = base
const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214f9df38e35bf45baf3'
const ZORA_FACTORY_DEPLOY_BLOCK = 26602741n
const ZORA_FACTORY_COIN_CREATED_EVENT = parseAbiItem(
  'event CoinCreated(address indexed caller,address indexed payoutRecipient,address indexed platformReferrer,address currency,string uri,string name,string symbol,address coin,address pool,string version)',
)

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_MAX_PAGES_PER_RUN = 120
const DEFAULT_CHAIN_SCAN_BLOCK_SPAN = 90_000
const DEFAULT_MAX_CHAIN_SCAN_CHUNKS = 8
const DEFAULT_ENRICH_BATCH_SIZE = 200
const DEFAULT_HOT_REFRESH_PAGES_PER_LIST = 8
const DEFAULT_STALE_RUNNING_LOCK_MS = 20 * 60 * 1000
const DEFAULT_COIN_UPSERT_BATCH_SIZE = 200
const DEFAULT_BLOCK_FETCH_CONCURRENCY = 32
const DEFAULT_EXPLORE_BACKFILL_MAX_PAGES_PER_LIST = 500
const DEFAULT_EXPLORE_REQUEST_INTERVAL_MS = 75
const MAX_SYNC_RETRIES = 4
let creatorMetricsSchemaEnsured = false
let creatorMetricsSchemaEnsurePromise: Promise<void> | null = null

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function parseOptionalTimestamp(v: unknown): number | null {
  if (v == null) return null
  const s = typeof v === 'string' ? v : String(v)
  const ms = Date.parse(s)
  if (!Number.isFinite(ms)) return null
  return ms
}

function parseOptionalBigInt(v: unknown): bigint | null {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v))
  if (typeof v === 'string' && v.trim().length > 0) {
    try {
      return BigInt(v.trim())
    } catch {
      return null
    }
  }
  return null
}

function timestampFromUnixSeconds(v: bigint): string {
  return new Date(Number(v) * 1000).toISOString()
}

function checkpointCursorFromChain(blockNumber: bigint | null, logIndex: number | null): string | null {
  if (blockNumber == null || logIndex == null) return null
  return `${blockNumber.toString()}:${logIndex}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(label: string, fn: () => Promise<T>, retries = MAX_SYNC_RETRIES): Promise<T> {
  let attempt = 0
  let lastError: unknown = null
  while (attempt < retries) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      attempt += 1
      if (attempt >= retries) break
      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000)
      logger.warn('[creator-metrics-sync] retrying failed step', { label, attempt, backoffMs })
      await sleep(backoffMs)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label}_failed`)
}

async function getSdk(apiKey: string): Promise<any> {
  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(apiKey)
  return sdk
}

function getBasePublicClient() {
  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  return createPublicClient({
    chain: BASE_CHAIN_NAME,
    transport: http(rpcUrl),
  })
}

function getArchivePublicClient(): ReturnType<typeof getBasePublicClient> | null {
  const archiveUrl = (process.env.CREATOR_METRICS_ARCHIVE_RPC_URL ?? '').trim()
  if (!archiveUrl) return null
  const primaryUrl = (process.env.BASE_RPC_URL ?? '').trim()
  if (archiveUrl === primaryUrl) return null
  return createPublicClient({
    chain: BASE_CHAIN_NAME,
    transport: http(archiveUrl),
  })
}

function extractList(response: any): any {
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
}

async function fetchPage(sdk: any, list: ExploreList, count: number, after?: string | null): Promise<any> {
  const options = after ? { count, after } : { count }
  if (list === 'TOP_VOLUME_CREATORS_24H') return await sdk.getExploreTopVolumeCreators24h(options)
  if (list === 'MOST_VALUABLE_CREATORS') return await sdk.getMostValuableCreatorCoins(options)
  return await sdk.getCreatorCoins(options)
}

function parseCount(v: unknown): number | null {
  const n = toFiniteNumber(v)
  if (n == null || n < 0) return null
  return Math.floor(n)
}

async function fetchCountCandidate(sdk: any, list: ExploreList, pageSize: number): Promise<number | null> {
  const resp = await fetchPage(sdk, list, pageSize)
  const node = extractList(resp)
  const count = parseCount(node?.count)
  if (count == null) return null
  const hasNextPage = Boolean(node?.pageInfo?.hasNextPage)
  if (hasNextPage && count <= pageSize) return null
  return count
}

async function ensureCreatorCoinsDisplayColumns(db: Db): Promise<void> {
  await db.sql`ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS unique_holders INTEGER;`
  await db.sql`ALTER TABLE creator_coins ADD COLUMN IF NOT EXISTS market_cap_delta_24h NUMERIC(38, 12);`
}

async function ensureCreatorMetricsStateColumns(db: Db): Promise<void> {
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_block BIGINT;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_log_index INTEGER;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS last_hot_refresh_at TIMESTAMPTZ;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_creators_total BIGINT;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_market_cap_usd NUMERIC(38, 12);`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_volume_24h_usd NUMERIC(38, 12);`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_fees_24h_usd NUMERIC(38, 12);`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS cached_totals_at TIMESTAMPTZ;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_checkpoints_json TEXT;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_backfill_complete BOOLEAN NOT NULL DEFAULT false;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS explore_last_sync_at TIMESTAMPTZ;`
}

async function ensureCreatorMetricsConstraints(db: Db): Promise<void> {
  await db.sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'creator_metrics_state_id_check'
      ) THEN
        ALTER TABLE creator_metrics_state
          ADD CONSTRAINT creator_metrics_state_id_check CHECK (id = 1);
      END IF;
    END $$;
  `
  await db.sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'creator_metrics_state_sync_status_check'
      ) THEN
        ALTER TABLE creator_metrics_state
          ADD CONSTRAINT creator_metrics_state_sync_status_check
          CHECK (sync_status IN ('idle', 'running', 'error'));
      END IF;
    END $$;
  `
}

export async function ensureCreatorMetricsSchema(db: Db): Promise<void> {
  if (creatorMetricsSchemaEnsured) return
  if (creatorMetricsSchemaEnsurePromise) return creatorMetricsSchemaEnsurePromise

  creatorMetricsSchemaEnsurePromise = (async () => {
    const preflight = await db.sql`
      SELECT
        to_regclass('public.creator_coins') IS NOT NULL AS has_creator_coins,
        to_regclass('public.creators') IS NOT NULL AS has_creators,
        to_regclass('public.creator_metrics_state') IS NOT NULL AS has_state,
        to_regclass('public.creator_metrics_daily_snapshots') IS NOT NULL AS has_daily;
    `
    const status = preflight.rows?.[0] ?? {}
    const tablesExist =
      Boolean(status.has_creator_coins) &&
      Boolean(status.has_creators) &&
      Boolean(status.has_state) &&
      Boolean(status.has_daily)

    if (!tablesExist) {
    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_coins (
        coin_address TEXT PRIMARY KEY,
        creator_address TEXT NOT NULL,
        created_at TIMESTAMPTZ,
        chain_id INTEGER NOT NULL DEFAULT 8453,
        market_cap_usd NUMERIC(38, 12),
        volume_24h_usd NUMERIC(38, 12),
        fees_24h_usd NUMERIC(38, 12),
        fee_model TEXT NOT NULL DEFAULT 'v4',
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS creator_coins_creator_idx ON creator_coins (creator_address);`
    await db.sql`CREATE INDEX IF NOT EXISTS creator_coins_created_at_idx ON creator_coins (created_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS creator_coins_chain_idx ON creator_coins (chain_id);`

    await db.sql`
      CREATE TABLE IF NOT EXISTS creators (
        creator_address TEXT PRIMARY KEY,
        first_seen_at TIMESTAMPTZ,
        coin_count INTEGER NOT NULL DEFAULT 0,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS creators_last_seen_idx ON creators (last_seen_at DESC);`

    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_metrics_state (
        id SMALLINT PRIMARY KEY,
        checkpoint_cursor TEXT,
        checkpoint_block BIGINT,
        checkpoint_log_index INTEGER,
        checkpoint_updated_at TIMESTAMPTZ,
        backfill_complete BOOLEAN NOT NULL DEFAULT false,
        sync_status TEXT NOT NULL DEFAULT 'idle',
        sync_error TEXT,
        sync_error_count INTEGER NOT NULL DEFAULT 0,
        last_sync_started_at TIMESTAMPTZ,
        last_sync_finished_at TIMESTAMPTZ,
        last_full_sync_at TIMESTAMPTZ,
        last_run_id TEXT,
        sampled_creators INTEGER NOT NULL DEFAULT 0,
        drift_estimate_total INTEGER,
        drift_pct NUMERIC(12, 6),
        last_drift_checked_at TIMESTAMPTZ,
        last_hot_refresh_at TIMESTAMPTZ,
        cached_creators_total BIGINT,
        cached_market_cap_usd NUMERIC(38, 12),
        cached_volume_24h_usd NUMERIC(38, 12),
        cached_fees_24h_usd NUMERIC(38, 12),
        cached_totals_at TIMESTAMPTZ
      );
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_metrics_daily_snapshots (
        day DATE PRIMARY KEY,
        creators_total BIGINT,
        creator_coins_market_cap_usd NUMERIC(38, 12),
        creator_coins_volume_24h_usd NUMERIC(38, 12),
        creator_coins_fees_24h_usd NUMERIC(38, 12),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS creator_metrics_daily_snapshots_day_idx ON creator_metrics_daily_snapshots (day DESC);`
    }

    // Existing deployments may have base tables from SQL migrations but miss later columns.
    await ensureCreatorMetricsStateColumns(db)
    await ensureCreatorCoinsDisplayColumns(db)
    await ensureCreatorMetricsConstraints(db)
    await db.sql`INSERT INTO creator_metrics_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`
    creatorMetricsSchemaEnsured = true
  })()
    .catch((error) => {
      creatorMetricsSchemaEnsured = false
      throw error
    })
    .finally(() => {
      creatorMetricsSchemaEnsurePromise = null
    })

  return creatorMetricsSchemaEnsurePromise
}

async function loadState(db: Db): Promise<StateRow & { lastSyncStartedAt: string | null }> {
  const result = await db.sql`
    SELECT checkpoint_cursor, checkpoint_block, checkpoint_log_index, backfill_complete, sync_status, last_sync_started_at
    FROM creator_metrics_state
    WHERE id = 1
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? {}
  const syncStatusRaw = String(row.sync_status ?? 'idle')
  const syncStatus: SyncStatus = syncStatusRaw === 'running' || syncStatusRaw === 'error' ? syncStatusRaw : 'idle'
  const lastSyncStartedAt =
    typeof row.last_sync_started_at === 'string' && row.last_sync_started_at.length > 0
      ? new Date(row.last_sync_started_at).toISOString()
      : null
  return {
    checkpointCursor: typeof row.checkpoint_cursor === 'string' && row.checkpoint_cursor.length > 0 ? row.checkpoint_cursor : null,
    checkpointBlock: parseOptionalBigInt(row.checkpoint_block),
    checkpointLogIndex: parseCount(row.checkpoint_log_index),
    backfillComplete: Boolean(row.backfill_complete),
    syncStatus,
    lastSyncStartedAt,
  }
}

async function maybeRecoverStaleRunningLock(db: Db, thresholdMs: number): Promise<boolean> {
  const state = await loadState(db)
  if (state.syncStatus !== 'running') return false
  if (!isStaleRunningLock(state.lastSyncStartedAt, Date.now(), thresholdMs)) return false

  await db.sql`
    UPDATE creator_metrics_state
    SET
      sync_status = 'idle',
      sync_error = 'recovered_stale_running_lock',
      last_sync_finished_at = NOW()
    WHERE id = 1;
  `
  logger.warn('[creator-metrics-sync] recovered stale running lock', {
    lastSyncStartedAt: state.lastSyncStartedAt,
    thresholdMs,
  })
  return true
}

async function upsertHotFinancialSnapshot(db: Db, snapshot: ReturnType<typeof parseExploreCoinFinancialSnapshot>): Promise<void> {
  if (!snapshot) return
  await db.sql`
    INSERT INTO creator_coins (
      coin_address,
      creator_address,
      created_at,
      chain_id,
      market_cap_usd,
      volume_24h_usd,
      fees_24h_usd,
      unique_holders,
      market_cap_delta_24h,
      fee_model,
      last_seen_at
    ) VALUES (
      ${snapshot.coinAddress},
      ${snapshot.creatorAddress},
      ${snapshot.createdAt},
      ${BASE_CHAIN_ID},
      ${snapshot.marketCapUsd},
      ${snapshot.volume24hUsd},
      ${snapshot.fees24hUsd},
      ${snapshot.uniqueHolders},
      ${snapshot.marketCapDelta24h},
      ${snapshot.feeModel},
      NOW()
    )
    ON CONFLICT (coin_address) DO UPDATE SET
      creator_address = EXCLUDED.creator_address,
      created_at = COALESCE(creator_coins.created_at, EXCLUDED.created_at),
      chain_id = EXCLUDED.chain_id,
      market_cap_usd = EXCLUDED.market_cap_usd,
      volume_24h_usd = EXCLUDED.volume_24h_usd,
      fees_24h_usd = EXCLUDED.fees_24h_usd,
      unique_holders = COALESCE(EXCLUDED.unique_holders, creator_coins.unique_holders),
      market_cap_delta_24h = COALESCE(EXCLUDED.market_cap_delta_24h, creator_coins.market_cap_delta_24h),
      fee_model = EXCLUDED.fee_model,
      last_seen_at = NOW();
  `

  await db.sql`
    INSERT INTO creators (creator_address, first_seen_at, coin_count, last_seen_at)
    VALUES (${snapshot.creatorAddress}, ${snapshot.createdAt}, 0, NOW())
    ON CONFLICT (creator_address) DO UPDATE SET
      first_seen_at = COALESCE(
        LEAST(creators.first_seen_at, EXCLUDED.first_seen_at),
        creators.first_seen_at,
        EXCLUDED.first_seen_at
      ),
      last_seen_at = GREATEST(creators.last_seen_at, EXCLUDED.last_seen_at);
  `
}

async function refreshHotFinancialsFromExploreLists(
  sdk: any,
  db: Db,
  options: { pageSize: number; maxPagesPerList: number; lists: readonly ExploreList[] },
): Promise<{ coinsRefreshed: number; pagesFetched: number }> {
  let coinsRefreshed = 0
  let pagesFetched = 0

  for (const list of options.lists) {
    let after: string | null = null
    for (let page = 0; page < options.maxPagesPerList; page += 1) {
      const response = await withRetry(`hot_refresh_${list}_page_${page}`, () =>
        fetchPage(sdk, list, options.pageSize, after),
      )
      const { edges, pageInfo } = extractExploreListEdges(response)
      pagesFetched += 1
      if (edges.length === 0) break

      for (const edge of edges) {
        const snapshot = parseExploreCoinFinancialSnapshot(edge?.node)
        if (!snapshot) continue
        await withRetry('upsert_hot_financial_snapshot', () => upsertHotFinancialSnapshot(db, snapshot))
        coinsRefreshed += 1
      }

      if (!pageInfo.hasNextPage) break
      after = pageInfo.endCursor
      if (!after) break
    }
  }

  return { coinsRefreshed, pagesFetched }
}

async function upsertExploreSnapshotBatch(db: Db, snapshots: readonly ExploreCoinFinancialSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return
  const batchSize = parsePositiveInt(
    process.env.CREATOR_METRICS_COIN_UPSERT_BATCH_SIZE,
    DEFAULT_COIN_UPSERT_BATCH_SIZE,
  )
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const slice = snapshots.slice(i, i + batchSize)
    const coinAddresses = slice.map((row) => row.coinAddress)
    const creatorAddresses = slice.map((row) => row.creatorAddress)
    const createdAts = slice.map((row) => row.createdAt)
    const marketCapUsd = slice.map((row) => row.marketCapUsd)
    const volume24hUsd = slice.map((row) => row.volume24hUsd)
    const fees24hUsd = slice.map((row) => row.fees24hUsd)
    const feeModels = slice.map((row) => row.feeModel)
    await withRetry('upsert_explore_snapshot_batch', async () => {
      await db.sql`
        INSERT INTO creator_coins (
          coin_address,
          creator_address,
          created_at,
          chain_id,
          market_cap_usd,
          volume_24h_usd,
          fees_24h_usd,
          fee_model,
          last_seen_at
        )
        SELECT
          coin_address,
          creator_address,
          created_at::timestamptz,
          ${BASE_CHAIN_ID},
          market_cap_usd,
          volume_24h_usd,
          fees_24h_usd,
          fee_model,
          NOW()
        FROM UNNEST(
          ${coinAddresses}::text[],
          ${creatorAddresses}::text[],
          ${createdAts}::text[],
          ${marketCapUsd}::numeric[],
          ${volume24hUsd}::numeric[],
          ${fees24hUsd}::numeric[],
          ${feeModels}::text[]
        ) AS t(
          coin_address,
          creator_address,
          created_at,
          market_cap_usd,
          volume_24h_usd,
          fees_24h_usd,
          fee_model
        )
        ON CONFLICT (coin_address) DO UPDATE SET
          creator_address = EXCLUDED.creator_address,
          created_at = COALESCE(creator_coins.created_at, EXCLUDED.created_at),
          chain_id = EXCLUDED.chain_id,
          market_cap_usd = EXCLUDED.market_cap_usd,
          volume_24h_usd = EXCLUDED.volume_24h_usd,
          fees_24h_usd = EXCLUDED.fees_24h_usd,
          fee_model = EXCLUDED.fee_model,
          last_seen_at = NOW();
      `
    })
  }
}

export type CreatorMetricsExploreBackfillResult = {
  ok: boolean
  runId: string
  coinsUpserted: number
  pagesFetched: number
  exploreBackfillComplete: boolean
  checkpoints: ExploreBackfillCheckpoints
  ethosProjectionRefreshedRows?: number
  error?: string
}

type ExploreBackfillOptions = {
  forceFull?: boolean
  maxPagesPerList?: number
  pageSize?: number
  lists?: readonly ExploreList[]
  /** When true (default), refresh creator_ethos_projection after explore upserts. */
  refreshEthos?: boolean
}

const DEFAULT_EXPLORE_ETHOS_PROJECTION_LIMIT = 50_000

function exploreEthosRefreshEnabled(options: ExploreBackfillOptions): boolean {
  if (options.refreshEthos === false) return false
  if (options.refreshEthos === true) return true
  return process.env.CREATOR_METRICS_EXPLORE_ETHOS_REFRESH_ENABLED !== '0'
}

async function refreshCreatorEthosProjectionAfterExploreBackfill(
  db: Db,
  log: ReturnType<typeof logger.child>,
): Promise<{ refreshedRows: number; appliedLimit: number; available: boolean }> {
  const { refreshCreatorEthosProjection } = await import('./creatorEthosProjection.js')
  const limit = parsePositiveInt(
    process.env.CREATOR_METRICS_EXPLORE_ETHOS_PROJECTION_LIMIT,
    DEFAULT_EXPLORE_ETHOS_PROJECTION_LIMIT,
  )
  const result = await refreshCreatorEthosProjection({ db, limit })
  log.info('[creator-metrics-explore-backfill] ethos projection refreshed', result)
  return result
}

export async function runCreatorEthosProjectionRefresh(options: {
  limit?: number
} = {}): Promise<{ ok: boolean; refreshedRows: number; appliedLimit: number; available: boolean; error?: string }> {
  const db = (await getDbForCron()) ?? (await getDb())
  if (!db) {
    return { ok: false, refreshedRows: 0, appliedLimit: 0, available: false, error: 'database_not_configured' }
  }
  await ensureCreatorMetricsSchema(db)
  try {
    const { refreshCreatorEthosProjection } = await import('./creatorEthosProjection.js')
    const limit =
      options.limit ??
      parsePositiveInt(
        process.env.CREATOR_METRICS_EXPLORE_ETHOS_PROJECTION_LIMIT,
        DEFAULT_EXPLORE_ETHOS_PROJECTION_LIMIT,
      )
    const result = await refreshCreatorEthosProjection({ db, limit })
    return { ok: result.available, ...result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'creator_ethos_projection_refresh_failed'
    return { ok: false, refreshedRows: 0, appliedLimit: 0, available: false, error: errorMessage }
  }
}

async function loadExploreBackfillState(db: Db): Promise<{
  checkpoints: ExploreBackfillCheckpoints
  exploreBackfillComplete: boolean
  syncStatus: SyncStatus
}> {
  const result = await db.sql`
    SELECT explore_checkpoints_json, explore_backfill_complete, sync_status
    FROM creator_metrics_state
    WHERE id = 1
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? {}
  const syncStatusRaw = String(row.sync_status ?? 'idle')
  const syncStatus: SyncStatus = syncStatusRaw === 'running' || syncStatusRaw === 'error' ? syncStatusRaw : 'idle'
  return {
    checkpoints: parseExploreBackfillCheckpoints(row.explore_checkpoints_json),
    exploreBackfillComplete: Boolean(row.explore_backfill_complete),
    syncStatus,
  }
}

export async function runCreatorMetricsExploreBackfill(
  options: ExploreBackfillOptions = {},
): Promise<CreatorMetricsExploreBackfillResult> {
  const runId = `creator-metrics-explore-${randomUUID()}`
  const log = logger.child({ syncRunId: runId })
  const db = (await getDbForCron()) ?? (await getDb())
  if (!db) {
    return {
      ok: false,
      runId,
      coinsUpserted: 0,
      pagesFetched: 0,
      exploreBackfillComplete: false,
      checkpoints: createDefaultExploreBackfillCheckpoints(),
      error: 'database_not_configured',
    }
  }

  await ensureCreatorMetricsSchema(db)
  const exploreState = await loadExploreBackfillState(db)
  if (exploreState.syncStatus === 'running') {
    return {
      ok: true,
      runId,
      coinsUpserted: 0,
      pagesFetched: 0,
      exploreBackfillComplete: exploreState.exploreBackfillComplete,
      checkpoints: exploreState.checkpoints,
      error: 'onchain_backfill_running',
    }
  }

  const apiKey = requireServerKey() || process.env.VITE_ZORA_PUBLIC_API_KEY || null
  if (!apiKey) {
    return {
      ok: false,
      runId,
      coinsUpserted: 0,
      pagesFetched: 0,
      exploreBackfillComplete: false,
      checkpoints: exploreState.checkpoints,
      error: 'zora_api_key_missing',
    }
  }

  const pageSize = Math.min(
    parsePositiveInt(process.env.CREATOR_METRICS_SYNC_PAGE_SIZE, options.pageSize ?? DEFAULT_PAGE_SIZE),
    50,
  )
  const maxPagesPerList = parsePositiveInt(
    process.env.CREATOR_METRICS_EXPLORE_BACKFILL_MAX_PAGES_PER_LIST,
    options.maxPagesPerList ?? DEFAULT_EXPLORE_BACKFILL_MAX_PAGES_PER_LIST,
  )
  const requestIntervalMs = parsePositiveInt(
    process.env.CREATOR_METRICS_EXPLORE_REQUEST_INTERVAL_MS,
    DEFAULT_EXPLORE_REQUEST_INTERVAL_MS,
  )
  const lists = options.lists ?? DEFAULT_HOT_REFRESH_LISTS
  const forceFull = Boolean(options.forceFull)
  let checkpoints = forceFull ? createDefaultExploreBackfillCheckpoints() : exploreState.checkpoints

  if (!forceFull && exploreState.exploreBackfillComplete) {
    let ethosProjectionRefreshedRows = 0
    if (exploreEthosRefreshEnabled(options)) {
      try {
        const ethos = await refreshCreatorEthosProjectionAfterExploreBackfill(db, log)
        ethosProjectionRefreshedRows = ethos.refreshedRows
      } catch (ethosError) {
        log.warn('[creator-metrics-explore-backfill] ethos projection refresh failed', {
          error: ethosError instanceof Error ? ethosError.message : String(ethosError),
        })
      }
    }
    return {
      ok: true,
      runId,
      coinsUpserted: 0,
      pagesFetched: 0,
      exploreBackfillComplete: true,
      checkpoints,
      ethosProjectionRefreshedRows,
    }
  }

  if (forceFull) {
    await db.sql`
      UPDATE creator_metrics_state
      SET
        explore_checkpoints_json = NULL,
        explore_backfill_complete = false
      WHERE id = 1;
    `
  }

  let coinsUpserted = 0
  let pagesFetched = 0

  try {
    const sdk = await getSdk(apiKey)
    log.info('[creator-metrics-explore-backfill] starting', {
      maxPagesPerList,
      pageSize,
      lists,
      forceFull,
    })

    for (const list of lists) {
      const checkpoint = checkpoints[list]
      if (checkpoint.complete) continue

      let after = checkpoint.after
      for (let page = 0; page < maxPagesPerList; page += 1) {
        const response = await withRetry(`explore_backfill_${list}_page_${page}`, () =>
          fetchPage(sdk, list, pageSize, after),
        )
        const { edges, pageInfo } = extractExploreListEdges(response)
        pagesFetched += 1

        const snapshots: ExploreCoinFinancialSnapshot[] = []
        for (const edge of edges) {
          const snapshot = parseExploreCoinFinancialSnapshot(edge?.node)
          if (snapshot) snapshots.push(snapshot)
        }
        if (snapshots.length > 0) {
          await upsertExploreSnapshotBatch(db, snapshots)
          coinsUpserted += snapshots.length
        }

        if (!pageInfo.hasNextPage || edges.length === 0) {
          checkpoints = {
            ...checkpoints,
            [list]: { after: null, complete: true },
          }
          break
        }

        after = pageInfo.endCursor
        if (!after) {
          checkpoints = {
            ...checkpoints,
            [list]: { after: null, complete: true },
          }
          break
        }

        checkpoints = {
          ...checkpoints,
          [list]: { after, complete: false },
        }

        await db.sql`
          UPDATE creator_metrics_state
          SET
            explore_checkpoints_json = ${serializeExploreBackfillCheckpoints(checkpoints)},
            explore_last_sync_at = NOW()
          WHERE id = 1;
        `

        if (requestIntervalMs > 0) await sleep(requestIntervalMs)
      }
    }

    await recomputeCreatorCounts(db)
    const exploreBackfillComplete = isExploreBackfillComplete(checkpoints)
    await recomputeAndCacheCreatorMetricsTotals(db)
    await db.sql`
      UPDATE creator_metrics_state
      SET
        explore_checkpoints_json = ${serializeExploreBackfillCheckpoints(checkpoints)},
        explore_backfill_complete = ${exploreBackfillComplete},
        explore_last_sync_at = NOW()
      WHERE id = 1;
    `

    let ethosProjectionRefreshedRows = 0
    if (exploreEthosRefreshEnabled(options)) {
      try {
        const ethos = await refreshCreatorEthosProjectionAfterExploreBackfill(db, log)
        ethosProjectionRefreshedRows = ethos.refreshedRows
      } catch (ethosError) {
        log.warn('[creator-metrics-explore-backfill] ethos projection refresh failed', {
          error: ethosError instanceof Error ? ethosError.message : String(ethosError),
        })
      }
    }

    log.info('[creator-metrics-explore-backfill] completed', {
      coinsUpserted,
      pagesFetched,
      exploreBackfillComplete,
      ethosProjectionRefreshedRows,
    })

    return {
      ok: true,
      runId,
      coinsUpserted,
      pagesFetched,
      exploreBackfillComplete,
      checkpoints,
      ethosProjectionRefreshedRows,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'creator_metrics_explore_backfill_failed'
    try {
      await recomputeCreatorCounts(db)
      await recomputeAndCacheCreatorMetricsTotals(db)
      await db.sql`
        UPDATE creator_metrics_state
        SET
          explore_checkpoints_json = ${serializeExploreBackfillCheckpoints(checkpoints)},
          explore_last_sync_at = NOW()
        WHERE id = 1;
      `
    } catch (repairError) {
      log.warn('[creator-metrics-explore-backfill] post-failure repair failed', {
        error: repairError instanceof Error ? repairError.message : String(repairError),
      })
    }
    log.error('[creator-metrics-explore-backfill] failed', { error: errorMessage })
    return {
      ok: false,
      runId,
      coinsUpserted,
      pagesFetched,
      exploreBackfillComplete: isExploreBackfillComplete(checkpoints),
      checkpoints,
      error: errorMessage,
    }
  }
}

export async function recomputeAndCacheCreatorMetricsTotals(db: Db): Promise<void> {
  await db.sql`
    UPDATE creator_metrics_state
    SET
      cached_creators_total = (SELECT COUNT(*)::BIGINT FROM creators),
      cached_market_cap_usd = (
        SELECT COALESCE(SUM(market_cap_usd), 0)::NUMERIC
        FROM creator_coins
        WHERE chain_id = ${BASE_CHAIN_ID}
      ),
      cached_volume_24h_usd = (
        SELECT COALESCE(SUM(volume_24h_usd), 0)::NUMERIC
        FROM creator_coins
        WHERE chain_id = ${BASE_CHAIN_ID}
      ),
      cached_fees_24h_usd = (
        SELECT COALESCE(SUM(fees_24h_usd), 0)::NUMERIC
        FROM creator_coins
        WHERE chain_id = ${BASE_CHAIN_ID}
      ),
      cached_totals_at = NOW()
    WHERE id = 1;
  `
}

export function cachedTotalsMaxAgeMs(): number {
  return parsePositiveInt(process.env.CREATOR_METRICS_CACHED_TOTALS_MAX_AGE_MS, DEFAULT_CACHED_TOTALS_MAX_AGE_MS)
}

export async function runCreatorMetricsHotSync(): Promise<CreatorMetricsHotSyncResult> {
  const runId = `creator-metrics-hot-${randomUUID()}`
  const log = logger.child({ syncRunId: runId })
  const db = (await getDbForCron()) ?? (await getDb())
  if (!db) {
    return {
      ok: false,
      runId,
      coinsRefreshed: 0,
      pagesFetched: 0,
      error: 'database_not_configured',
    }
  }

  await ensureCreatorMetricsSchema(db)
  const hotRefreshEnabled = process.env.CREATOR_METRICS_HOT_REFRESH_ENABLED !== '0'
  if (!hotRefreshEnabled) {
    return { ok: true, runId, coinsRefreshed: 0, pagesFetched: 0, skipped: true }
  }

  const minIntervalMs = parsePositiveInt(
    process.env.CREATOR_METRICS_HOT_SYNC_MIN_INTERVAL_MS,
    DEFAULT_HOT_SYNC_MIN_INTERVAL_MS,
  )
  const throttleResult = await db.sql`
    SELECT last_hot_refresh_at
    FROM creator_metrics_state
    WHERE id = 1
    LIMIT 1;
  `
  const lastHotRefreshAt = parseOptionalTimestamp(throttleResult.rows?.[0]?.last_hot_refresh_at)
  if (lastHotRefreshAt != null && Date.now() - lastHotRefreshAt < minIntervalMs) {
    return { ok: true, runId, coinsRefreshed: 0, pagesFetched: 0, skipped: true }
  }

  const apiKey = requireServerKey() || process.env.VITE_ZORA_PUBLIC_API_KEY || null
  if (!apiKey) {
    return {
      ok: false,
      runId,
      coinsRefreshed: 0,
      pagesFetched: 0,
      error: 'zora_api_key_missing',
    }
  }

  const pageSize = Math.min(parsePositiveInt(process.env.CREATOR_METRICS_SYNC_PAGE_SIZE, DEFAULT_PAGE_SIZE), 50)
  const hotRefreshPagesPerList = parsePositiveInt(
    process.env.CREATOR_METRICS_HOT_REFRESH_PAGES_PER_LIST,
    DEFAULT_HOT_REFRESH_PAGES_PER_LIST,
  )

  try {
    const sdk = await getSdk(apiKey)
    const hotRefresh = await refreshHotFinancialsFromExploreLists(sdk, db, {
      pageSize,
      maxPagesPerList: hotRefreshPagesPerList,
      lists: DEFAULT_HOT_REFRESH_LISTS,
    })
    await recomputeAndCacheCreatorMetricsTotals(db)
    await db.sql`
      UPDATE creator_metrics_state
      SET last_hot_refresh_at = NOW()
      WHERE id = 1;
    `
    log.info('[creator-metrics-hot-sync] completed', hotRefresh)
    return {
      ok: true,
      runId,
      coinsRefreshed: hotRefresh.coinsRefreshed,
      pagesFetched: hotRefresh.pagesFetched,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'creator_metrics_hot_sync_failed'
    log.error('[creator-metrics-hot-sync] failed', { error: errorMessage })
    return {
      ok: false,
      runId,
      coinsRefreshed: 0,
      pagesFetched: 0,
      error: errorMessage,
    }
  }
}

type ChainScanCoinRow = {
  coinAddress: string
  creatorAddress: string
  createdAtBlock: bigint
  feeModel: 'legacy' | 'v4'
  blockNumber: bigint
  logIndex: number
}

function enrichDuringBackfillEnabled(): boolean {
  const raw = (process.env.CREATOR_METRICS_ENRICH_DURING_BACKFILL ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

async function prefetchBlockTimestamps(
  client: ReturnType<typeof getBasePublicClient>,
  blockNumbers: readonly bigint[],
  cache: Map<string, string>,
): Promise<void> {
  const concurrency = parsePositiveInt(
    process.env.CREATOR_METRICS_BLOCK_FETCH_CONCURRENCY,
    DEFAULT_BLOCK_FETCH_CONCURRENCY,
  )
  const missing = [...new Set(blockNumbers.map((blockNumber) => blockNumber.toString()))].filter(
    (key) => !cache.has(key),
  )
  for (let i = 0; i < missing.length; i += concurrency) {
    const slice = missing.slice(i, i + concurrency)
    await Promise.all(
      slice.map(async (key) => {
        const blockNumber = BigInt(key)
        const block = await withRetry('fetch_coin_created_block', () => client.getBlock({ blockNumber }))
        cache.set(key, timestampFromUnixSeconds(block.timestamp))
      }),
    )
  }
}

async function upsertCreatorCoinBatch(db: Db, rows: ChainScanCoinRow[], cache: Map<string, string>): Promise<void> {
  if (rows.length === 0) return
  const batchSize = parsePositiveInt(
    process.env.CREATOR_METRICS_COIN_UPSERT_BATCH_SIZE,
    DEFAULT_COIN_UPSERT_BATCH_SIZE,
  )
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize)
    const coinAddresses = slice.map((row) => row.coinAddress)
    const creatorAddresses = slice.map((row) => row.creatorAddress)
    const createdAts = slice.map((row) => cache.get(row.createdAtBlock.toString()) ?? null)
    const feeModels = slice.map((row) => row.feeModel)
    await withRetry('upsert_creator_coin_batch', async () => {
      await db.sql`
        INSERT INTO creator_coins (
          coin_address,
          creator_address,
          created_at,
          chain_id,
          market_cap_usd,
          volume_24h_usd,
          fees_24h_usd,
          fee_model,
          last_seen_at
        )
        SELECT
          coin_address,
          creator_address,
          created_at::timestamptz,
          ${BASE_CHAIN_ID},
          NULL::numeric,
          NULL::numeric,
          NULL::numeric,
          fee_model,
          NOW()
        FROM UNNEST(
          ${coinAddresses}::text[],
          ${creatorAddresses}::text[],
          ${createdAts}::text[],
          ${feeModels}::text[]
        ) AS t(coin_address, creator_address, created_at, fee_model)
        ON CONFLICT (coin_address) DO UPDATE SET
          creator_address = EXCLUDED.creator_address,
          created_at = COALESCE(creator_coins.created_at, EXCLUDED.created_at),
          chain_id = EXCLUDED.chain_id,
          market_cap_usd = COALESCE(creator_coins.market_cap_usd, EXCLUDED.market_cap_usd),
          volume_24h_usd = COALESCE(creator_coins.volume_24h_usd, EXCLUDED.volume_24h_usd),
          fees_24h_usd = COALESCE(creator_coins.fees_24h_usd, EXCLUDED.fees_24h_usd),
          fee_model = EXCLUDED.fee_model,
          last_seen_at = NOW();
      `
    })
  }
}

function isPrunedHistoryError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '').toLowerCase()
  return msg.includes('pruned history') || msg.includes('history unavailable')
}

function isLogRangeTooLargeError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '').toLowerCase()
  return msg.includes('10,000') || msg.includes('10000') || msg.includes('too many')
}

async function fetchFactoryCoinCreatedLogsWithSplit(
  client: ReturnType<typeof getBasePublicClient>,
  fromBlock: bigint,
  toBlock: bigint,
  minSpanBlocks = 1000,
): Promise<Awaited<ReturnType<ReturnType<typeof getBasePublicClient>['getLogs']>>> {
  try {
    return await client.getLogs({
      address: ZORA_FACTORY_ADDRESS,
      event: ZORA_FACTORY_COIN_CREATED_EVENT,
      fromBlock,
      toBlock,
    })
  } catch (error) {
    if (fromBlock >= toBlock) throw error
    const span = Number(toBlock - fromBlock + 1n)
    if (span <= minSpanBlocks) throw error
    if (!isPrunedHistoryError(error) && !isLogRangeTooLargeError(error)) throw error
    const mid = fromBlock + (toBlock - fromBlock) / 2n
    const [left, right] = await Promise.all([
      fetchFactoryCoinCreatedLogsWithSplit(client, fromBlock, mid, minSpanBlocks),
      fetchFactoryCoinCreatedLogsWithSplit(client, mid + 1n, toBlock, minSpanBlocks),
    ])
    return [...left, ...right]
  }
}

async function resolveFactoryCoinCreatedLogs(
  primaryClient: ReturnType<typeof getBasePublicClient>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<{
  logs: Awaited<ReturnType<ReturnType<typeof getBasePublicClient>['getLogs']>>
  skippedPrunedGap: boolean
}> {
  try {
    const logs = await fetchFactoryCoinCreatedLogsWithSplit(primaryClient, fromBlock, toBlock)
    return { logs, skippedPrunedGap: false }
  } catch (primaryError) {
    if (!isPrunedHistoryError(primaryError)) throw primaryError
    const archiveClient = getArchivePublicClient()
    if (archiveClient) {
      try {
        const logs = await fetchFactoryCoinCreatedLogsWithSplit(archiveClient, fromBlock, toBlock)
        return { logs, skippedPrunedGap: false }
      } catch (archiveError) {
        if (!isPrunedHistoryError(archiveError)) throw archiveError
      }
    }
    return { logs: [], skippedPrunedGap: true }
  }
}

export async function recomputeCreatorCounts(db: Db): Promise<void> {
  // Repair rows indexed via hot refresh before a matching creators upsert landed.
  await db.sql`
    INSERT INTO creators (creator_address, first_seen_at, coin_count, last_seen_at)
    SELECT
      cc.creator_address,
      MIN(cc.created_at) AS first_seen_at,
      COUNT(*)::INTEGER AS coin_count,
      MAX(cc.last_seen_at) AS last_seen_at
    FROM creator_coins AS cc
    WHERE NOT EXISTS (
      SELECT 1 FROM creators AS c WHERE c.creator_address = cc.creator_address
    )
    GROUP BY cc.creator_address
    ON CONFLICT (creator_address) DO NOTHING;
  `
  await db.sql`
    WITH counts AS (
      SELECT creator_address, COUNT(*)::INTEGER AS coin_count
      FROM creator_coins
      GROUP BY creator_address
    )
    UPDATE creators AS c
    SET coin_count = counts.coin_count
    FROM counts
    WHERE c.creator_address = counts.creator_address
      AND c.coin_count IS DISTINCT FROM counts.coin_count;
  `
  await db.sql`
    DELETE FROM creators AS c
    WHERE NOT EXISTS (
      SELECT 1 FROM creator_coins AS cc WHERE cc.creator_address = c.creator_address
    );
  `
}

async function measureDrift(db: Db, sdk: any, pageSize: number): Promise<{ estimate: number | null; driftPct: number | null }> {
  const [n1, n2, n3] = await Promise.all([
    withRetry('count_new_creators', () => fetchCountCandidate(sdk, 'NEW_CREATORS', pageSize)),
    withRetry('count_most_valuable', () => fetchCountCandidate(sdk, 'MOST_VALUABLE_CREATORS', pageSize)),
    withRetry('count_top_volume', () => fetchCountCandidate(sdk, 'TOP_VOLUME_CREATORS_24H', pageSize)),
  ])
  const values = [n1, n2, n3].filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const estimate = values.length > 0 ? Math.max(...values) : null

  const canonicalRes = await db.sql`SELECT COUNT(*)::BIGINT AS total FROM creators;`
  const canonicalTotal = parseCount(canonicalRes.rows?.[0]?.total) ?? 0
  const driftPct = estimate && estimate > 0 ? Math.abs(canonicalTotal - estimate) / estimate * 100 : null
  return { estimate, driftPct }
}

type EnrichCandidate = {
  coinAddress: string
  feeModel: 'legacy' | 'v4'
}

async function fetchCoinSnapshot(sdk: any, coinAddress: string): Promise<{
  creatorAddress: string | null
  createdAt: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  uniqueHolders: number | null
  marketCapDelta24h: number | null
  feeModel: 'legacy' | 'v4'
}> {
  const response = await sdk.getCoin({ address: coinAddress, chain: BASE_CHAIN_ID })
  const coin = response?.data?.zora20Token ?? null
  if (!coin) {
    return {
      creatorAddress: null,
      createdAt: null,
      marketCapUsd: null,
      volume24hUsd: null,
      uniqueHolders: null,
      marketCapDelta24h: null,
      feeModel: 'v4',
    }
  }

  const coinLike: CoinCandidate = {
    creatorAddress: coin?.creatorAddress,
    payoutRecipientAddress: coin?.payoutRecipientAddress,
    createdAt: coin?.createdAt,
    marketCap: coin?.marketCap,
    volume24h: coin?.volume24h,
    marketCapDelta24h: coin?.marketCapDelta24h,
    uniqueHolders: coin?.uniqueHolders,
    market: (coin as any)?.market ?? null,
  }
  return {
    creatorAddress: normalizeAddress(coinLike.creatorAddress) ?? normalizeAddress(coinLike.payoutRecipientAddress),
    createdAt: parseTimestamp(coinLike.createdAt),
    marketCapUsd: toFiniteNumber(coinLike.marketCap),
    volume24hUsd: toFiniteNumber(coinLike.volume24h),
    uniqueHolders: toIntegerOrNull(coinLike.uniqueHolders),
    marketCapDelta24h: toFiniteNumber(coinLike.marketCapDelta24h),
    feeModel: detectFeeModel(coinLike),
  }
}

type RunOptions = {
  forceFull?: boolean
  maxPages?: number
  pageSize?: number
  /** When false, skips Zora explore hot refresh (used when a dedicated hot cron runs). */
  includeHotRefresh?: boolean
}

export type CreatorMetricsHotSyncResult = {
  ok: boolean
  runId: string
  coinsRefreshed: number
  pagesFetched: number
  skipped?: boolean
  error?: string
}

const DEFAULT_HOT_SYNC_MIN_INTERVAL_MS = 4 * 60 * 1000
const DEFAULT_CACHED_TOTALS_MAX_AGE_MS = 15 * 60 * 1000

export async function runCreatorMetricsSync(options: RunOptions = {}): Promise<CreatorMetricsSyncResult> {
  const runId = `creator-metrics-sync-${randomUUID()}`
  const log = logger.child({ syncRunId: runId })
  const db = (await getDbForCron()) ?? (await getDb())
  if (!db) {
    return {
      ok: false,
      runId,
      mode: 'backfill',
      pagesProcessed: 0,
      sampledCreators: 0,
      coinsUpserted: 0,
      nextCursor: null,
      backfillComplete: false,
      syncStatus: 'error',
      driftEstimateTotal: null,
      driftPct: null,
      deadLetters: 0,
      error: 'database_not_configured',
    }
  }

  await ensureCreatorMetricsSchema(db)
  const staleLockMs = parsePositiveInt(
    process.env.CREATOR_METRICS_STALE_RUNNING_LOCK_MS,
    DEFAULT_STALE_RUNNING_LOCK_MS,
  )
  await maybeRecoverStaleRunningLock(db, staleLockMs)
  let current = await loadState(db)

  if (current.syncStatus === 'running') {
    return {
      ok: true,
      runId,
      mode: current.backfillComplete ? 'incremental' : 'backfill',
      pagesProcessed: 0,
      sampledCreators: 0,
      coinsUpserted: 0,
      nextCursor: current.checkpointCursor,
      backfillComplete: current.backfillComplete,
      syncStatus: 'running',
      driftEstimateTotal: null,
      driftPct: null,
      deadLetters: 0,
    }
  }

  const forceFull = Boolean(options.forceFull)
  const pageSize = Math.min(parsePositiveInt(process.env.CREATOR_METRICS_SYNC_PAGE_SIZE, options.pageSize ?? DEFAULT_PAGE_SIZE), 50)
  const maxPages = parsePositiveInt(process.env.CREATOR_METRICS_SYNC_MAX_PAGES, options.maxPages ?? DEFAULT_MAX_PAGES_PER_RUN)
  const chainScanBlockSpan = Math.min(
    parsePositiveInt(process.env.CREATOR_METRICS_CHAIN_SCAN_BLOCK_SPAN, DEFAULT_CHAIN_SCAN_BLOCK_SPAN),
    100_000,
  )
  const maxChainScanChunks = parsePositiveInt(
    process.env.CREATOR_METRICS_MAX_CHAIN_SCAN_CHUNKS,
    DEFAULT_MAX_CHAIN_SCAN_CHUNKS,
  )
  const enrichBatchSize = parsePositiveInt(process.env.CREATOR_METRICS_ENRICH_BATCH_SIZE, DEFAULT_ENRICH_BATCH_SIZE)
  const hotRefreshPagesPerList = parsePositiveInt(
    process.env.CREATOR_METRICS_HOT_REFRESH_PAGES_PER_LIST,
    DEFAULT_HOT_REFRESH_PAGES_PER_LIST,
  )
  const hotRefreshEnabled = process.env.CREATOR_METRICS_HOT_REFRESH_ENABLED !== '0'
  const includeHotRefresh =
    options.includeHotRefresh ??
    process.env.CREATOR_METRICS_HOT_REFRESH_IN_FULL_SYNC !== '0'
  const mode: SyncMode = forceFull || !current.backfillComplete ? 'backfill' : 'incremental'
  const apiKey = requireServerKey() || process.env.VITE_ZORA_PUBLIC_API_KEY || null

  await db.sql`
    UPDATE creator_metrics_state
    SET
      sync_status = 'running',
      sync_error = NULL,
      last_sync_started_at = NOW(),
      last_run_id = ${runId}
    WHERE id = 1;
  `

  if (forceFull) {
    await db.sql`
      UPDATE creator_metrics_state
      SET
        checkpoint_cursor = NULL,
        checkpoint_block = NULL,
        checkpoint_log_index = NULL,
        checkpoint_updated_at = NOW(),
        backfill_complete = false
      WHERE id = 1;
    `
  }

  let pagesProcessed = 0
  let sampledCreators = 0
  let coinsUpserted = 0
  const deadLetters: Array<{ reason: string; coinAddress?: string | null }> = []
  let checkpointBlock: bigint = current.checkpointBlock ?? ZORA_FACTORY_DEPLOY_BLOCK
  if (checkpointBlock < ZORA_FACTORY_DEPLOY_BLOCK || forceFull) checkpointBlock = ZORA_FACTORY_DEPLOY_BLOCK
  let checkpointLogIndex = forceFull ? 0 : (current.checkpointLogIndex ?? 0)
  let backfillComplete = current.backfillComplete
  let driftEstimateTotal: number | null = null
  let driftPct: number | null = null
  let coverageWarning: string | null = null

  try {
    const client = getBasePublicClient()
    const latestBlock = await withRetry('chain_latest_block', () => client.getBlockNumber())
    let sdk: any = null
    if (apiKey) {
      sdk = await getSdk(apiKey)
    } else {
      coverageWarning = 'zora_api_key_missing_enrichment_disabled'
      log.warn('[creator-metrics-sync] running without zora api key; enrichment disabled')
    }

    if (sdk && hotRefreshEnabled && includeHotRefresh) {
      const hotRefresh = await refreshHotFinancialsFromExploreLists(sdk, db, {
        pageSize,
        maxPagesPerList: hotRefreshPagesPerList,
        lists: DEFAULT_HOT_REFRESH_LISTS,
      })
      coinsUpserted += hotRefresh.coinsRefreshed
      pagesProcessed += hotRefresh.pagesFetched
      log.info('[creator-metrics-sync] hot financial refresh completed', hotRefresh)
    }

    const blockTimestampCache = new Map<string, string>()
    let fromBlock = checkpointBlock
    let reachedChainTip = fromBlock > latestBlock

    log.info('[creator-metrics-sync] starting run', {
      mode,
      checkpointBlock: checkpointBlock.toString(),
      checkpointLogIndex,
      latestBlock: latestBlock.toString(),
      chainScanBlockSpan,
      maxChainScanChunks,
      pageSize,
      maxPages,
      forceFull,
      enrichBatchSize,
    })

    for (let chunk = 0; chunk < maxChainScanChunks; chunk++) {
      if (fromBlock > latestBlock) {
        reachedChainTip = true
        break
      }
      const toBlock = fromBlock + BigInt(chainScanBlockSpan - 1) > latestBlock
        ? latestBlock
        : fromBlock + BigInt(chainScanBlockSpan - 1)

      const { logs, skippedPrunedGap } = await withRetry('fetch_factory_coin_created_logs', () =>
        resolveFactoryCoinCreatedLogs(client, fromBlock, toBlock),
      )
      if (skippedPrunedGap) {
        const skipNote = `pruned_history_skipped:${fromBlock.toString()}-${toBlock.toString()}`
        coverageWarning = coverageWarning ? `${coverageWarning};${skipNote}` : skipNote
        log.warn('[creator-metrics-sync] skipping pruned log window', { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() })
      }

      let lastCheckpointBlock = toBlock
      let lastCheckpointLogIndex = 0
      const pendingRows: ChainScanCoinRow[] = []

      for (const entry of logs) {
        const blockNumber = entry.blockNumber ?? null
        const rawLogIndex = Number(entry.logIndex ?? 0)
        if (blockNumber == null) continue
        if (blockNumber === checkpointBlock && rawLogIndex <= checkpointLogIndex) continue

        const args = (entry as any)?.args ?? {}
        const coinAddress = normalizeAddress(args.coin)
        const payoutRecipient = normalizeAddress(args.payoutRecipient)
        const caller = normalizeAddress(args.caller)
        const creatorAddress = payoutRecipient ?? caller
        if (!coinAddress || !creatorAddress) {
          deadLetters.push({ reason: 'missing_factory_event_address', coinAddress: coinAddress ?? null })
          continue
        }

        const version = typeof args.version === 'string' ? args.version.toLowerCase() : ''
        const feeModel: 'legacy' | 'v4' = version.includes('legacy') || version.includes('v3') ? 'legacy' : 'v4'
        pendingRows.push({
          coinAddress,
          creatorAddress,
          createdAtBlock: blockNumber,
          feeModel,
          blockNumber,
          logIndex: rawLogIndex,
        })
      }

      if (pendingRows.length > 0) {
        await prefetchBlockTimestamps(
          client,
          pendingRows.map((row) => row.createdAtBlock),
          blockTimestampCache,
        )
        await upsertCreatorCoinBatch(db, pendingRows, blockTimestampCache)
        coinsUpserted += pendingRows.length
        sampledCreators += pendingRows.length
        const lastRow = pendingRows[pendingRows.length - 1]!
        lastCheckpointBlock = lastRow.blockNumber
        lastCheckpointLogIndex = lastRow.logIndex
      }

      checkpointBlock = lastCheckpointBlock
      checkpointLogIndex = lastCheckpointLogIndex
      pagesProcessed += 1
      const checkpointCursorForState = checkpointCursorFromChain(checkpointBlock, checkpointLogIndex)
      await db.sql`
        UPDATE creator_metrics_state
        SET
          checkpoint_cursor = ${checkpointCursorForState},
          checkpoint_block = ${checkpointBlock.toString()},
          checkpoint_log_index = ${checkpointLogIndex},
          checkpoint_updated_at = NOW(),
          sampled_creators = ${sampledCreators}
        WHERE id = 1;
      `
      fromBlock = toBlock + 1n
    }

    reachedChainTip = fromBlock > latestBlock

    const shouldEnrichCoins =
      sdk && (mode !== 'backfill' || reachedChainTip || enrichDuringBackfillEnabled())
    if (shouldEnrichCoins) {
      const enrichCandidatesResult = await db.sql`
        SELECT coin_address, fee_model
        FROM creator_coins
        WHERE chain_id = ${BASE_CHAIN_ID}
          AND (market_cap_usd IS NULL OR volume_24h_usd IS NULL OR fees_24h_usd IS NULL)
        ORDER BY created_at DESC NULLS LAST
        LIMIT ${enrichBatchSize};
      `
      const enrichCandidates: EnrichCandidate[] = (enrichCandidatesResult.rows ?? [])
        .map((row) => {
          const feeModel: EnrichCandidate['feeModel'] = row.fee_model === 'legacy' ? 'legacy' : 'v4'
          return {
            coinAddress: normalizeAddress(row.coin_address) ?? '',
            feeModel,
          }
        })
        .filter((row) => row.coinAddress.length > 0)

      for (const candidate of enrichCandidates) {
        try {
          const snap = await withRetry('enrich_creator_coin', () => fetchCoinSnapshot(sdk, candidate.coinAddress))
          const feeModel = snap.feeModel ?? candidate.feeModel
          const fees24hUsd = snap.volume24hUsd != null ? snap.volume24hUsd * feeRateFromModel(feeModel) : null
          await withRetry('apply_coin_enrichment', async () => {
            await db.sql`
              UPDATE creator_coins
              SET
                creator_address = COALESCE(${snap.creatorAddress}, creator_address),
                created_at = COALESCE(created_at, ${snap.createdAt}),
                market_cap_usd = COALESCE(${snap.marketCapUsd}, market_cap_usd),
                volume_24h_usd = COALESCE(${snap.volume24hUsd}, volume_24h_usd),
                fees_24h_usd = COALESCE(${fees24hUsd}, fees_24h_usd),
                unique_holders = COALESCE(${snap.uniqueHolders}, unique_holders),
                market_cap_delta_24h = COALESCE(${snap.marketCapDelta24h}, market_cap_delta_24h),
                fee_model = COALESCE(${feeModel}, fee_model),
                last_seen_at = NOW()
              WHERE coin_address = ${candidate.coinAddress};
            `
          })
        } catch {
          deadLetters.push({ reason: 'coin_enrichment_failed', coinAddress: candidate.coinAddress })
        }
      }
    }

    await withRetry('recompute_creator_counts', () => recomputeCreatorCounts(db))

    if (mode === 'backfill') backfillComplete = reachedChainTip
    if (mode === 'incremental' && !reachedChainTip) backfillComplete = false

    const missingMetricsResult = await db.sql`
      SELECT COUNT(*)::BIGINT AS missing
      FROM creator_coins
      WHERE chain_id = ${BASE_CHAIN_ID}
        AND (market_cap_usd IS NULL OR volume_24h_usd IS NULL OR fees_24h_usd IS NULL);
    `
    const missingMetricsCount = parseCount(missingMetricsResult.rows?.[0]?.missing) ?? 0
    if (missingMetricsCount > 0) {
      backfillComplete = false
      coverageWarning = coverageWarning ?? `metrics_enrichment_pending:missing_coin_metrics=${missingMetricsCount}`
    }

    const historyDepthDays = parsePositiveInt(process.env.CREATOR_METRICS_MIN_HISTORY_DAYS, 90)
    const coverageResult = await db.sql`
      SELECT MIN(created_at) AS min_created_at, MAX(created_at) AS max_created_at
      FROM creator_coins
      WHERE created_at IS NOT NULL;
    `
    const minCreatedMs = parseOptionalTimestamp(coverageResult.rows?.[0]?.min_created_at)
    const maxCreatedMs = parseOptionalTimestamp(coverageResult.rows?.[0]?.max_created_at)
    const historyThresholdMs = Date.now() - historyDepthDays * 24 * 60 * 60 * 1000
    const hasHistoricalDepth = minCreatedMs != null && minCreatedMs <= historyThresholdMs
    if (!hasHistoricalDepth) {
      backfillComplete = false
      const minCreatedIso = minCreatedMs != null ? new Date(minCreatedMs).toISOString() : 'null'
      const maxCreatedIso = maxCreatedMs != null ? new Date(maxCreatedMs).toISOString() : 'null'
      coverageWarning = `source_window_limited:min_created_at=${minCreatedIso},max_created_at=${maxCreatedIso},required_history_days=${historyDepthDays}`
      log.warn('[creator-metrics-sync] insufficient historical depth for exact mode', {
        minCreatedIso,
        maxCreatedIso,
        historyDepthDays,
      })
    }

    if (!reachedChainTip) {
      coverageWarning =
        coverageWarning ??
        `onchain_backfill_in_progress:checkpoint_block=${checkpointBlock.toString()},latest_block=${latestBlock.toString()}`
    }

    if (sdk) {
      const drift = await withRetry('measure_drift', () => measureDrift(db, sdk, pageSize))
      driftEstimateTotal = drift.estimate
      driftPct = drift.driftPct
    }

    const deadLetterSummary =
      deadLetters.length > 0
        ? `row_errors:${JSON.stringify(deadLetters.slice(0, 10))}${deadLetters.length > 10 ? `...(+${deadLetters.length - 10} more)` : ''}`
        : null
    const syncNote = coverageWarning ?? deadLetterSummary ?? null

    await db.sql`
      UPDATE creator_metrics_state
      SET
        sync_status = 'idle',
        sync_error = ${syncNote},
        checkpoint_cursor = ${checkpointCursorFromChain(checkpointBlock, checkpointLogIndex)},
        checkpoint_block = ${checkpointBlock.toString()},
        checkpoint_log_index = ${checkpointLogIndex},
        last_sync_finished_at = NOW(),
        sampled_creators = ${sampledCreators},
        backfill_complete = ${backfillComplete},
        last_full_sync_at = CASE
          WHEN ${backfillComplete} THEN NOW()
          ELSE last_full_sync_at
        END,
        drift_estimate_total = ${driftEstimateTotal},
        drift_pct = ${driftPct},
        last_drift_checked_at = NOW()
      WHERE id = 1;
    `
    await recomputeAndCacheCreatorMetricsTotals(db)

    log.info('[creator-metrics-sync] run completed', {
      mode,
      pagesProcessed,
      sampledCreators,
      coinsUpserted,
      nextCursor: checkpointCursorFromChain(checkpointBlock, checkpointLogIndex),
      backfillComplete,
      deadLetters: deadLetters.length,
      driftEstimateTotal,
      driftPct,
    })

    return {
      ok: true,
      runId,
      mode,
      pagesProcessed,
      sampledCreators,
      coinsUpserted,
      nextCursor: checkpointCursorFromChain(checkpointBlock, checkpointLogIndex),
      backfillComplete,
      syncStatus: 'idle',
      driftEstimateTotal,
      driftPct,
      deadLetters: deadLetters.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'creator_metrics_sync_failed'
    try {
      await withRetry('recompute_creator_counts_on_failure', () => recomputeCreatorCounts(db))
      await recomputeAndCacheCreatorMetricsTotals(db)
    } catch (repairError) {
      log.warn('[creator-metrics-sync] post-failure creator repair failed', {
        error: repairError instanceof Error ? repairError.message : String(repairError),
      })
    }
    await db.sql`
      UPDATE creator_metrics_state
      SET
        sync_status = 'error',
        sync_error = ${errorMessage},
        sync_error_count = sync_error_count + 1,
        last_sync_finished_at = NOW(),
        sampled_creators = ${sampledCreators}
      WHERE id = 1;
    `
    log.error('[creator-metrics-sync] run failed', { error: errorMessage, mode, pagesProcessed, sampledCreators })

    return {
      ok: false,
      runId,
      mode,
      pagesProcessed,
      sampledCreators,
      coinsUpserted,
      nextCursor: checkpointCursorFromChain(checkpointBlock, checkpointLogIndex),
      backfillComplete,
      syncStatus: 'error',
      driftEstimateTotal: null,
      driftPct: null,
      deadLetters: deadLetters.length,
      error: errorMessage,
    }
  }
}
