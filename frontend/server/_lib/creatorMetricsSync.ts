import { randomUUID } from 'node:crypto'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { getDb } from './postgres.js'
import { logger } from './logger.js'
import { requireServerKey } from '../zora/_shared.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type ExploreList = 'NEW_CREATORS' | 'TOP_VOLUME_CREATORS_24H' | 'MOST_VALUABLE_CREATORS'
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
const LEGACY_FEE_RATE = 0.03
const V4_FEE_RATE = 0.01
const V4_CUTOFF_MS = Date.parse('2025-06-06T00:00:00Z')
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
const MAX_SYNC_RETRIES = 4
let creatorMetricsSchemaEnsured = false

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

function normalizeAddress(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null
  return s.toLowerCase()
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return null
  return n
}

function parseTimestamp(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const ms = Date.parse(v)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function timestampFromUnixSeconds(v: bigint): string {
  return new Date(Number(v) * 1000).toISOString()
}

function checkpointCursorFromChain(blockNumber: bigint | null, logIndex: number | null): string | null {
  if (blockNumber == null || logIndex == null) return null
  return `${blockNumber.toString()}:${logIndex}`
}

function detectFeeModel(coin: CoinCandidate): 'legacy' | 'v4' {
  const feeBps = toFiniteNumber(coin?.market?.feeBps)
  if (feeBps === 300) return 'legacy'
  if (feeBps === 100) return 'v4'

  const protocolVersion = typeof coin?.market?.protocolVersion === 'string' ? coin.market.protocolVersion.toLowerCase() : ''
  if (protocolVersion.includes('legacy') || protocolVersion.includes('v3')) return 'legacy'
  if (protocolVersion.includes('v4')) return 'v4'

  const createdAtMs = typeof coin?.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
  if (!Number.isFinite(createdAtMs)) return 'v4'
  return createdAtMs >= V4_CUTOFF_MS ? 'v4' : 'legacy'
}

function feeRateFromModel(feeModel: 'legacy' | 'v4'): number {
  return feeModel === 'legacy' ? LEGACY_FEE_RATE : V4_FEE_RATE
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

export async function ensureCreatorMetricsSchema(db: Db): Promise<void> {
  if (creatorMetricsSchemaEnsured) return
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
      last_drift_checked_at TIMESTAMPTZ
    );
  `
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_block BIGINT;`
  await db.sql`ALTER TABLE creator_metrics_state ADD COLUMN IF NOT EXISTS checkpoint_log_index INTEGER;`

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
  await db.sql`INSERT INTO creator_metrics_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`
  creatorMetricsSchemaEnsured = true
}

async function loadState(db: Db): Promise<StateRow> {
  const result = await db.sql`
    SELECT checkpoint_cursor, checkpoint_block, checkpoint_log_index, backfill_complete, sync_status
    FROM creator_metrics_state
    WHERE id = 1
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? {}
  const syncStatusRaw = String(row.sync_status ?? 'idle')
  const syncStatus: SyncStatus = syncStatusRaw === 'running' || syncStatusRaw === 'error' ? syncStatusRaw : 'idle'
  return {
    checkpointCursor: typeof row.checkpoint_cursor === 'string' && row.checkpoint_cursor.length > 0 ? row.checkpoint_cursor : null,
    checkpointBlock: parseOptionalBigInt(row.checkpoint_block),
    checkpointLogIndex: parseCount(row.checkpoint_log_index),
    backfillComplete: Boolean(row.backfill_complete),
    syncStatus,
  }
}

async function recomputeCreatorCounts(db: Db): Promise<void> {
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
      feeModel: 'v4',
    }
  }

  const coinLike: CoinCandidate = {
    creatorAddress: coin?.creatorAddress,
    payoutRecipientAddress: coin?.payoutRecipientAddress,
    createdAt: coin?.createdAt,
    marketCap: coin?.marketCap,
    volume24h: coin?.volume24h,
    market: (coin as any)?.market ?? null,
  }
  return {
    creatorAddress: normalizeAddress(coinLike.creatorAddress) ?? normalizeAddress(coinLike.payoutRecipientAddress),
    createdAt: parseTimestamp(coinLike.createdAt),
    marketCapUsd: toFiniteNumber(coinLike.marketCap),
    volume24hUsd: toFiniteNumber(coinLike.volume24h),
    feeModel: detectFeeModel(coinLike),
  }
}

type RunOptions = {
  forceFull?: boolean
  maxPages?: number
  pageSize?: number
}

export async function runCreatorMetricsSync(options: RunOptions = {}): Promise<CreatorMetricsSyncResult> {
  const runId = `creator-metrics-sync-${randomUUID()}`
  const log = logger.child({ syncRunId: runId })
  const db = await getDb()
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
  const current = await loadState(db)

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
    options.maxPages ?? DEFAULT_MAX_CHAIN_SCAN_CHUNKS,
  )
  const enrichBatchSize = parsePositiveInt(process.env.CREATOR_METRICS_ENRICH_BATCH_SIZE, DEFAULT_ENRICH_BATCH_SIZE)
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

      const logs = await withRetry('fetch_factory_coin_created_logs', () =>
        client.getLogs({
          address: ZORA_FACTORY_ADDRESS,
          event: ZORA_FACTORY_COIN_CREATED_EVENT,
          fromBlock,
          toBlock,
        }),
      )

      let lastCheckpointBlock = toBlock
      let lastCheckpointLogIndex = 0
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

        const blockCacheKey = blockNumber.toString()
        let createdAt = blockTimestampCache.get(blockCacheKey) ?? null
        if (!createdAt) {
          const block = await withRetry('fetch_coin_created_block', () => client.getBlock({ blockNumber }))
          createdAt = timestampFromUnixSeconds(block.timestamp)
          blockTimestampCache.set(blockCacheKey, createdAt)
        }
        const version = typeof args.version === 'string' ? args.version.toLowerCase() : ''
        const feeModel: 'legacy' | 'v4' = version.includes('legacy') || version.includes('v3') ? 'legacy' : 'v4'

        await withRetry('upsert_creator_coin', async () => {
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
            ) VALUES (
              ${coinAddress},
              ${creatorAddress},
              ${createdAt},
              ${BASE_CHAIN_ID},
              ${null},
              ${null},
              ${null},
              ${feeModel},
              NOW()
            )
            ON CONFLICT (coin_address) DO UPDATE SET
              creator_address = EXCLUDED.creator_address,
              created_at = COALESCE(EXCLUDED.created_at, creator_coins.created_at),
              chain_id = EXCLUDED.chain_id,
              market_cap_usd = COALESCE(creator_coins.market_cap_usd, EXCLUDED.market_cap_usd),
              volume_24h_usd = COALESCE(creator_coins.volume_24h_usd, EXCLUDED.volume_24h_usd),
              fees_24h_usd = COALESCE(creator_coins.fees_24h_usd, EXCLUDED.fees_24h_usd),
              fee_model = EXCLUDED.fee_model,
              last_seen_at = NOW();
          `
        })

        await withRetry('upsert_creator', async () => {
          await db.sql`
            INSERT INTO creators (creator_address, first_seen_at, coin_count, last_seen_at)
            VALUES (${creatorAddress}, ${createdAt}, 0, NOW())
            ON CONFLICT (creator_address) DO UPDATE SET
              first_seen_at = COALESCE(
                LEAST(creators.first_seen_at, EXCLUDED.first_seen_at),
                creators.first_seen_at,
                EXCLUDED.first_seen_at
              ),
              last_seen_at = GREATEST(creators.last_seen_at, EXCLUDED.last_seen_at);
          `
        })

        coinsUpserted += 1
        sampledCreators += 1
        lastCheckpointBlock = blockNumber
        lastCheckpointLogIndex = rawLogIndex
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

    if (sdk) {
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
