/**
 * Supabase caching / indexing layer for Wallet Intelligence.
 *
 * Tables:
 *   wallet_intelligence_cache  – full graph snapshots (TTL-based)
 *   entity_labels_cache        – per-address entity labels (TTL-based)
 *   feedback_index             – queryable index of ERC-8004 feedback entries
 *
 * All tables are auto-created on first access (idempotent DDL).
 * If Supabase/Postgres is not configured, every function degrades gracefully
 * by returning null / empty results.
 */

import { getDb, isDbConfigured } from './postgres.js'

declare const process: { env: Record<string, string | undefined> }

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

// ---------------------------------------------------------------------------
// Schema bootstrap (idempotent)
// ---------------------------------------------------------------------------

let schemaEnsured = false

export async function ensureWalletIntelligenceSchema(): Promise<void> {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return
  schemaEnsured = true

  // ── wallet_intelligence_cache ──
  await db.sql`
    CREATE TABLE IF NOT EXISTS wallet_intelligence_cache (
      address       TEXT NOT NULL,
      chain_ids     TEXT NOT NULL DEFAULT '8453,1',
      hops          INT  NOT NULL DEFAULT 3,
      graph         JSONB NOT NULL,
      grove_uri     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
      PRIMARY KEY (address, chain_ids, hops)
    );
  `
  try {
    await db.sql`ALTER TABLE wallet_intelligence_cache ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS cannot be enabled in this runtime.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'wallet_intelligence_cache'
            AND policyname = 'wallet_intelligence_cache_deny_all'
        ) THEN
          CREATE POLICY wallet_intelligence_cache_deny_all
            ON wallet_intelligence_cache
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore if policy creation is unavailable in this runtime.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS wic_expires_idx ON wallet_intelligence_cache (expires_at);`
  await db.sql`CREATE INDEX IF NOT EXISTS wic_address_idx ON wallet_intelligence_cache (address);`

  // ── entity_labels_cache ──
  await db.sql`
    CREATE TABLE IF NOT EXISTS entity_labels_cache (
      address       TEXT NOT NULL,
      chain_id      INT  NOT NULL DEFAULT 8453,
      labels        JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_known      BOOLEAN NOT NULL DEFAULT FALSE,
      source        TEXT NOT NULL DEFAULT 'unknown',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
      PRIMARY KEY (address, chain_id)
    );
  `
  try {
    await db.sql`ALTER TABLE entity_labels_cache ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS cannot be enabled in this runtime.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'entity_labels_cache'
            AND policyname = 'entity_labels_cache_deny_all'
        ) THEN
          CREATE POLICY entity_labels_cache_deny_all
            ON entity_labels_cache
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore if policy creation is unavailable in this runtime.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS elc_expires_idx ON entity_labels_cache (expires_at);`

  // ── feedback_index ──
  await db.sql`
    CREATE TABLE IF NOT EXISTS feedback_index (
      id              BIGSERIAL PRIMARY KEY,
      agent_id        INT NOT NULL,
      client_address  TEXT NOT NULL,
      feedback_index  INT NOT NULL,
      value           INT NOT NULL,
      value_decimals  INT NOT NULL DEFAULT 0,
      tag1            TEXT NOT NULL DEFAULT '',
      tag2            TEXT NOT NULL DEFAULT '',
      endpoint        TEXT,
      feedback_uri    TEXT,
      feedback_hash   TEXT,
      grove_uri       TEXT,
      is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
      reasoning       TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (agent_id, client_address, feedback_index)
    );
  `
  try {
    await db.sql`ALTER TABLE feedback_index ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS cannot be enabled in this runtime.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'feedback_index'
            AND policyname = 'feedback_index_deny_all'
        ) THEN
          CREATE POLICY feedback_index_deny_all
            ON feedback_index
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
  } catch {
    // Ignore if policy creation is unavailable in this runtime.
  }
  await db.sql`CREATE INDEX IF NOT EXISTS fi_agent_idx ON feedback_index (agent_id, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS fi_client_idx ON feedback_index (client_address, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS fi_tags_idx ON feedback_index (tag1, tag2);`
  await db.sql`CREATE INDEX IF NOT EXISTS fi_revoked_idx ON feedback_index (is_revoked);`
}

// ---------------------------------------------------------------------------
// Wallet Intelligence Cache
// ---------------------------------------------------------------------------

const WI_CACHE_TTL_HOURS = 1

export type CachedWalletIntelligence = {
  address: string
  graph: unknown
  groveUri: string | null
  createdAt: string
  expiresAt: string
}

/**
 * Read a cached wallet intelligence graph.
 * Returns null if not cached or expired.
 */
export async function getCachedWalletIntelligence(
  address: string,
  hops: number = 3,
  chainIds: number[] = [8453, 1],
): Promise<CachedWalletIntelligence | null> {
  if (!isDbConfigured()) return null
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return null

  const chainKey = chainIds.sort().join(',')
  const result = await db.sql`
    SELECT graph, grove_uri, created_at, expires_at
    FROM wallet_intelligence_cache
    WHERE address = ${address.toLowerCase()}
      AND chain_ids = ${chainKey}
      AND hops = ${hops}
      AND expires_at > NOW()
    LIMIT 1;
  `

  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    address: address.toLowerCase(),
    graph: row.graph,
    groveUri: row.grove_uri,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

/**
 * Write a wallet intelligence graph to cache.
 */
export async function cacheWalletIntelligence(
  address: string,
  graph: unknown,
  groveUri: string | null,
  hops: number = 3,
  chainIds: number[] = [8453, 1],
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return

  const chainKey = chainIds.sort().join(',')
  const graphJson = JSON.stringify(graph)

  try {
    // Upsert: replace if exists.
    if (db.query) {
      await db.query(
        `INSERT INTO wallet_intelligence_cache (address, chain_ids, hops, graph, grove_uri, created_at, expires_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), NOW() + INTERVAL '${WI_CACHE_TTL_HOURS} hours')
         ON CONFLICT (address, chain_ids, hops)
         DO UPDATE SET graph = $4::jsonb, grove_uri = $5, created_at = NOW(), expires_at = NOW() + INTERVAL '${WI_CACHE_TTL_HOURS} hours';`,
        [address.toLowerCase(), chainKey, hops, graphJson, groveUri],
      )
    }
  } catch (err) {
    console.error('[walletIntelligenceCache] Failed to write cache:', err)
  }
}

// ---------------------------------------------------------------------------
// Entity Labels Cache
// ---------------------------------------------------------------------------

import type { WalletLabelResult } from './walletLabels.js'

const LABEL_CACHE_TTL_HOURS = 24

/**
 * Read cached entity labels for an address.
 */
export async function getCachedEntityLabels(
  address: string,
  chainId: number = 8453,
): Promise<WalletLabelResult | null> {
  if (!isDbConfigured()) return null
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return null

  const result = await db.sql`
    SELECT labels, is_known
    FROM entity_labels_cache
    WHERE address = ${address.toLowerCase()}
      AND chain_id = ${chainId}
      AND expires_at > NOW()
    LIMIT 1;
  `

  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    address: address.toLowerCase(),
    labels: row.labels,
    isKnownEntity: row.is_known,
  }
}

/**
 * Write entity labels to cache.
 */
export async function cacheEntityLabels(
  result: WalletLabelResult,
  chainId: number = 8453,
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return

  const labelsJson = JSON.stringify(result.labels)
  const source = result.labels[0]?.source ?? 'unknown'

  try {
    if (db.query) {
      await db.query(
        `INSERT INTO entity_labels_cache (address, chain_id, labels, is_known, source, created_at, expires_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, NOW(), NOW() + INTERVAL '${LABEL_CACHE_TTL_HOURS} hours')
         ON CONFLICT (address, chain_id)
         DO UPDATE SET labels = $3::jsonb, is_known = $4, source = $5, created_at = NOW(), expires_at = NOW() + INTERVAL '${LABEL_CACHE_TTL_HOURS} hours';`,
        [result.address.toLowerCase(), chainId, labelsJson, result.isKnownEntity, source],
      )
    }
  } catch (err) {
    console.error('[entityLabelsCache] Failed to write cache:', err)
  }
}

// ---------------------------------------------------------------------------
// Feedback Index
// ---------------------------------------------------------------------------

export type FeedbackIndexEntry = {
  id: number
  agentId: number
  clientAddress: string
  feedbackIndex: number
  value: number
  valueDecimals: number
  tag1: string
  tag2: string
  endpoint: string | null
  feedbackUri: string | null
  feedbackHash: string | null
  groveUri: string | null
  isRevoked: boolean
  reasoning: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Index a feedback entry in Supabase for queryability.
 */
export async function indexFeedback(entry: {
  agentId: number
  clientAddress: string
  feedbackIndex: number
  value: number
  valueDecimals?: number
  tag1?: string
  tag2?: string
  endpoint?: string
  feedbackUri?: string
  feedbackHash?: string
  groveUri?: string
  reasoning?: string
}): Promise<void> {
  if (!isDbConfigured()) return
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return

  const clientAddress = String(entry.clientAddress ?? '').trim().toLowerCase()
  if (!isAddressLike(clientAddress)) return
  if (!Number.isInteger(entry.feedbackIndex) || entry.feedbackIndex <= 0) return

  try {
    if (db.query) {
      await db.query(
        `INSERT INTO feedback_index
           (agent_id, client_address, feedback_index, value, value_decimals, tag1, tag2, endpoint, feedback_uri, feedback_hash, grove_uri, reasoning, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT (agent_id, client_address, feedback_index)
         DO UPDATE SET
           value = $4, value_decimals = $5, tag1 = $6, tag2 = $7,
           endpoint = $8, feedback_uri = $9, feedback_hash = $10,
           grove_uri = $11, reasoning = $12, updated_at = NOW();`,
        [
          entry.agentId,
          clientAddress,
          entry.feedbackIndex,
          entry.value,
          entry.valueDecimals ?? 0,
          entry.tag1 ?? '',
          entry.tag2 ?? '',
          entry.endpoint ?? null,
          entry.feedbackUri ?? null,
          entry.feedbackHash ?? null,
          entry.groveUri ?? null,
          entry.reasoning ?? null,
        ],
      )
    }
  } catch (err) {
    console.error('[feedbackIndex] Failed to index feedback:', err)
  }
}

/**
 * Mark a feedback entry as revoked.
 */
export async function revokeFeedbackIndex(
  agentId: number,
  clientAddress: string,
  feedbackIndex: number,
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return

  try {
    await db.sql`
      UPDATE feedback_index
      SET is_revoked = TRUE, updated_at = NOW()
      WHERE agent_id = ${agentId}
        AND client_address = ${clientAddress.toLowerCase()}
        AND feedback_index = ${feedbackIndex};
    `
  } catch (err) {
    console.error('[feedbackIndex] Failed to revoke:', err)
  }
}

/**
 * Query feedback entries with filtering, sorting, and pagination.
 */
export async function queryFeedbackIndex(params: {
  agentId?: number
  clientAddress?: string
  tag1?: string
  tag2?: string
  includeRevoked?: boolean
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'value'
  order?: 'asc' | 'desc'
}): Promise<{ entries: FeedbackIndexEntry[]; total: number }> {
  if (!isDbConfigured()) return { entries: [], total: 0 }
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db || !db.query) return { entries: [], total: 0 }

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIdx = 0

  if (params.agentId !== undefined) {
    paramIdx++
    conditions.push(`agent_id = $${paramIdx}`)
    values.push(params.agentId)
  }

  if (params.clientAddress) {
    paramIdx++
    conditions.push(`client_address = $${paramIdx}`)
    values.push(params.clientAddress.toLowerCase())
  }

  if (params.tag1) {
    paramIdx++
    conditions.push(`tag1 = $${paramIdx}`)
    values.push(params.tag1)
  }

  if (params.tag2) {
    paramIdx++
    conditions.push(`tag2 = $${paramIdx}`)
    values.push(params.tag2)
  }

  if (!params.includeRevoked) {
    conditions.push('is_revoked = FALSE')
  }
  conditions.push(`client_address ~* '^0x[a-f0-9]{40}$'`)

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderCol = params.orderBy === 'value' ? 'value' : 'created_at'
  const orderDir = params.order === 'asc' ? 'ASC' : 'DESC'
  const limit = Math.min(params.limit ?? 50, 200)
  const offset = params.offset ?? 0

  try {
    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM feedback_index ${where};`, values)
    const total = countResult.rows[0]?.total ?? 0

    const dataResult = await db.query(
      `SELECT * FROM feedback_index ${where} ORDER BY ${orderCol} ${orderDir} LIMIT ${limit} OFFSET ${offset};`,
      values,
    )

    const entries: FeedbackIndexEntry[] = dataResult.rows.map((row: any) => ({
      id: row.id,
      agentId: row.agent_id,
      clientAddress: row.client_address,
      feedbackIndex: row.feedback_index,
      value: row.value,
      valueDecimals: row.value_decimals,
      tag1: row.tag1,
      tag2: row.tag2,
      endpoint: row.endpoint,
      feedbackUri: row.feedback_uri,
      feedbackHash: row.feedback_hash,
      groveUri: row.grove_uri,
      isRevoked: row.is_revoked,
      reasoning: row.reasoning,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return { entries, total }
  } catch (err) {
    console.error('[feedbackIndex] Query failed:', err)
    return { entries: [], total: 0 }
  }
}

// ---------------------------------------------------------------------------
// Cleanup (optional, call from a cron or admin endpoint)
// ---------------------------------------------------------------------------

/**
 * Purge expired cache entries. Safe to call frequently.
 */
export async function purgeExpiredCache(): Promise<{ walletIntelligence: number; entityLabels: number }> {
  if (!isDbConfigured()) return { walletIntelligence: 0, entityLabels: 0 }
  await ensureWalletIntelligenceSchema()
  const db = await getDb()
  if (!db) return { walletIntelligence: 0, entityLabels: 0 }

  try {
    const wi = await db.sql`DELETE FROM wallet_intelligence_cache WHERE expires_at < NOW();`
    const el = await db.sql`DELETE FROM entity_labels_cache WHERE expires_at < NOW();`
    return {
      walletIntelligence: (wi as any).rowCount ?? 0,
      entityLabels: (el as any).rowCount ?? 0,
    }
  } catch {
    return { walletIntelligence: 0, entityLabels: 0 }
  }
}
