import { getDb } from './db/postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type TrendOpStatus =
  | 'predicted'
  | 'deploying'
  | 'deployed'
  | 'funnel_pending'
  | 'funnel_completed'
  | 'failed'

export type TrendOpRow = {
  id: number
  ticker: string
  tickerHash: string
  predictedCoinAddress: string
  deployedCoinAddress: string | null
  txHash: string | null
  actorWallet: string | null
  groupId: string | null
  vaultAddress: string | null
  status: TrendOpStatus
  lastError: string | null
  funnelMetadata: Record<string, unknown>
  routeability: Record<string, unknown>
  funnelMetrics: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const TREND_STATUS_ORDER: Record<Exclude<TrendOpStatus, 'failed'>, number> = {
  predicted: 0,
  deploying: 1,
  deployed: 2,
  funnel_pending: 3,
  funnel_completed: 4,
}

let trendOpsSchemaEnsured = false

function isTrendStatus(value: unknown): value is TrendOpStatus {
  return (
    value === 'predicted' ||
    value === 'deploying' ||
    value === 'deployed' ||
    value === 'funnel_pending' ||
    value === 'funnel_completed' ||
    value === 'failed'
  )
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toIso(value: unknown): string {
  const d = value ? new Date(value as any) : new Date()
  if (!Number.isFinite(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

function normalizeStatus(value: unknown): TrendOpStatus {
  return isTrendStatus(value) ? value : 'predicted'
}

function mapTrendOpRow(row: any): TrendOpRow {
  return {
    id: Number(row?.id ?? 0),
    ticker: String(row?.ticker ?? ''),
    tickerHash: String(row?.ticker_hash ?? ''),
    predictedCoinAddress: String(row?.predicted_coin_address ?? ''),
    deployedCoinAddress: typeof row?.deployed_coin_address === 'string' ? row.deployed_coin_address : null,
    txHash: typeof row?.tx_hash === 'string' ? row.tx_hash : null,
    actorWallet: typeof row?.actor_wallet === 'string' ? row.actor_wallet : null,
    groupId: typeof row?.group_id === 'string' ? row.group_id : null,
    vaultAddress: typeof row?.vault_address === 'string' ? row.vault_address : null,
    status: normalizeStatus(row?.status),
    lastError: typeof row?.last_error === 'string' ? row.last_error : null,
    funnelMetadata: toRecord(row?.funnel_metadata),
    routeability: toRecord(row?.routeability),
    funnelMetrics: toRecord(row?.funnel_metrics),
    createdAt: toIso(row?.created_at),
    updatedAt: toIso(row?.updated_at),
  }
}

async function requireDb(): Promise<Db> {
  const db = (await getDb()) as Db | null
  if (!db) throw new Error('db_not_configured')
  return db
}

export function applyTrendStatusTransition(
  current: TrendOpStatus,
  next: TrendOpStatus,
): { status: TrendOpStatus; changed: boolean } {
  if (current === next) return { status: current, changed: false }

  // Failing is always allowed from any state.
  if (next === 'failed') return { status: 'failed', changed: true }

  // Failed states can be retried from earlier lifecycle checkpoints.
  if (current === 'failed') {
    return { status: next, changed: true }
  }

  const currentRank = TREND_STATUS_ORDER[current]
  const nextRank = TREND_STATUS_ORDER[next as Exclude<TrendOpStatus, 'failed'>]
  if (nextRank >= currentRank) return { status: next, changed: true }
  return { status: current, changed: false }
}

export async function ensureZoraTrendOpsSchema(db: Db): Promise<void> {
  if (trendOpsSchemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS zora_trend_ops (
        id BIGSERIAL PRIMARY KEY,
        ticker TEXT NOT NULL,
        ticker_hash TEXT NOT NULL UNIQUE,
        predicted_coin_address TEXT NOT NULL,
        deployed_coin_address TEXT NULL,
        tx_hash TEXT NULL,
        actor_wallet TEXT NULL,
        group_id TEXT NULL,
        vault_address TEXT NULL,
        status TEXT NOT NULL DEFAULT 'predicted',
        last_error TEXT NULL,
        funnel_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        routeability JSONB NOT NULL DEFAULT '{}'::jsonb,
        funnel_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (status IN ('predicted', 'deploying', 'deployed', 'funnel_pending', 'funnel_completed', 'failed'))
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_trend_ops_status_idx
      ON zora_trend_ops (status, updated_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_trend_ops_ticker_idx
      ON zora_trend_ops (ticker, created_at DESC);
    `
    trendOpsSchemaEnsured = true
  } catch (error) {
    trendOpsSchemaEnsured = false
    throw error
  }
}

export async function getTrendOpByTickerHash(tickerHash: string): Promise<TrendOpRow | null> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)
  const res = await db.sql`
    SELECT *
    FROM zora_trend_ops
    WHERE ticker_hash = ${String(tickerHash).toLowerCase()}
    LIMIT 1;
  `
  const row = res.rows?.[0]
  return row ? mapTrendOpRow(row) : null
}

export async function getTrendOpByTicker(ticker: string): Promise<TrendOpRow | null> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)
  const normalizedTicker = String(ticker ?? '').trim().toUpperCase()
  if (!normalizedTicker) return null
  const res = await db.sql`
    SELECT *
    FROM zora_trend_ops
    WHERE ticker = ${normalizedTicker}
    ORDER BY id DESC
    LIMIT 1;
  `
  const row = res.rows?.[0]
  return row ? mapTrendOpRow(row) : null
}

export async function upsertTrendPrediction(params: {
  ticker: string
  tickerHash: string
  predictedCoinAddress: string
  actorWallet?: string | null
  groupId?: string | null
  vaultAddress?: string | null
  funnelMetadata?: Record<string, unknown>
}): Promise<TrendOpRow> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)

  const ticker = String(params.ticker ?? '').trim().toUpperCase()
  const tickerHash = String(params.tickerHash ?? '').trim().toLowerCase()
  if (!ticker) throw new Error('ticker_required')
  if (!tickerHash) throw new Error('ticker_hash_required')

  const existing = await getTrendOpByTickerHash(tickerHash)
  const existingStatus: TrendOpStatus = existing?.status ?? 'predicted'
  const transition = applyTrendStatusTransition(existingStatus, 'predicted')

  const upserted = await db.sql`
    INSERT INTO zora_trend_ops (
      ticker,
      ticker_hash,
      predicted_coin_address,
      actor_wallet,
      group_id,
      vault_address,
      status,
      funnel_metadata,
      updated_at
    ) VALUES (
      ${ticker},
      ${tickerHash},
      ${String(params.predictedCoinAddress ?? '').toLowerCase()},
      ${params.actorWallet ? String(params.actorWallet).toLowerCase() : null},
      ${params.groupId ? String(params.groupId) : null},
      ${params.vaultAddress ? String(params.vaultAddress).toLowerCase() : null},
      ${transition.status},
      ${params.funnelMetadata ?? {}},
      NOW()
    )
    ON CONFLICT (ticker_hash) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      predicted_coin_address = EXCLUDED.predicted_coin_address,
      actor_wallet = COALESCE(EXCLUDED.actor_wallet, zora_trend_ops.actor_wallet),
      group_id = COALESCE(EXCLUDED.group_id, zora_trend_ops.group_id),
      vault_address = COALESCE(EXCLUDED.vault_address, zora_trend_ops.vault_address),
      status = ${transition.status},
      funnel_metadata = COALESCE(EXCLUDED.funnel_metadata, zora_trend_ops.funnel_metadata),
      updated_at = NOW()
    RETURNING *;
  `
  const row = upserted.rows?.[0]
  if (!row) throw new Error('trend_prediction_upsert_failed')
  return mapTrendOpRow(row)
}

export async function transitionTrendOp(params: {
  tickerHash: string
  nextStatus: TrendOpStatus
  txHash?: string | null
  deployedCoinAddress?: string | null
  actorWallet?: string | null
  lastError?: string | null
  routeability?: Record<string, unknown>
  funnelMetrics?: Record<string, unknown>
}): Promise<TrendOpRow | null> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)
  const tickerHash = String(params.tickerHash ?? '').trim().toLowerCase()
  if (!tickerHash) return null

  const existing = await getTrendOpByTickerHash(tickerHash)
  if (!existing) return null

  const transition = applyTrendStatusTransition(existing.status, params.nextStatus)
  const shouldClearError = transition.status !== 'failed'
  const result = await db.sql`
    UPDATE zora_trend_ops
    SET
      status = ${transition.status},
      tx_hash = COALESCE(${params.txHash ?? null}, tx_hash),
      deployed_coin_address = COALESCE(${params.deployedCoinAddress ? String(params.deployedCoinAddress).toLowerCase() : null}, deployed_coin_address),
      actor_wallet = COALESCE(${params.actorWallet ? String(params.actorWallet).toLowerCase() : null}, actor_wallet),
      last_error = ${shouldClearError ? null : params.lastError ?? existing.lastError},
      routeability = COALESCE(${params.routeability ?? null}, routeability),
      funnel_metrics = COALESCE(${params.funnelMetrics ?? null}, funnel_metrics),
      updated_at = NOW()
    WHERE ticker_hash = ${tickerHash}
    RETURNING *;
  `
  const row = result.rows?.[0]
  return row ? mapTrendOpRow(row) : null
}

export async function markTrendOpDeploying(params: {
  tickerHash: string
  txHash?: string | null
  actorWallet?: string | null
}): Promise<TrendOpRow | null> {
  return await transitionTrendOp({
    tickerHash: params.tickerHash,
    nextStatus: 'deploying',
    txHash: params.txHash ?? null,
    actorWallet: params.actorWallet ?? null,
  })
}

export async function markTrendOpDeployed(params: {
  tickerHash: string
  deployedCoinAddress?: string | null
  txHash?: string | null
  actorWallet?: string | null
}): Promise<TrendOpRow | null> {
  return await transitionTrendOp({
    tickerHash: params.tickerHash,
    nextStatus: 'deployed',
    deployedCoinAddress: params.deployedCoinAddress ?? null,
    txHash: params.txHash ?? null,
    actorWallet: params.actorWallet ?? null,
  })
}

export async function markTrendOpFailed(params: {
  tickerHash: string
  lastError: string
  txHash?: string | null
}): Promise<TrendOpRow | null> {
  return await transitionTrendOp({
    tickerHash: params.tickerHash,
    nextStatus: 'failed',
    txHash: params.txHash ?? null,
    lastError: String(params.lastError ?? '').slice(0, 500),
  })
}

export async function markTrendOpFunnelPending(params: {
  tickerHash: string
  routeability?: Record<string, unknown>
}): Promise<TrendOpRow | null> {
  return await transitionTrendOp({
    tickerHash: params.tickerHash,
    nextStatus: 'funnel_pending',
    routeability: params.routeability ?? {},
  })
}

export async function markTrendOpFunnelCompleted(params: {
  tickerHash: string
  funnelMetrics?: Record<string, unknown>
}): Promise<TrendOpRow | null> {
  return await transitionTrendOp({
    tickerHash: params.tickerHash,
    nextStatus: 'funnel_completed',
    funnelMetrics: params.funnelMetrics ?? {},
  })
}

export async function listRecentTrendOps(limit = 50): Promise<TrendOpRow[]> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 200))
  const res = await db.sql`
    SELECT *
    FROM zora_trend_ops
    ORDER BY updated_at DESC
    LIMIT ${n};
  `
  return (res.rows ?? []).map(mapTrendOpRow)
}

export async function getTrendOpsMetrics(hours = 24): Promise<{
  total: number
  byStatus: Record<string, number>
  updatedSince: string
}> {
  const db = await requireDb()
  await ensureZoraTrendOpsSchema(db)
  const boundedHours = Math.max(1, Math.min(Math.floor(Number(hours) || 24), 24 * 30))
  const aggregated = await db.sql`
    SELECT status, COUNT(*)::INT AS count
    FROM zora_trend_ops
    WHERE updated_at >= NOW() - (${boundedHours}::text || ' hours')::interval
    GROUP BY status;
  `
  const byStatus: Record<string, number> = {}
  let total = 0
  for (const row of aggregated.rows ?? []) {
    const status = String(row?.status ?? 'unknown')
    const count = Number(row?.count ?? 0) || 0
    byStatus[status] = count
    total += count
  }
  const updatedSince = new Date(Date.now() - boundedHours * 3600_000).toISOString()
  return { total, byStatus, updatedSince }
}

