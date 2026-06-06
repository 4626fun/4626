/**
 * Dedupe ledger for the AlfaClub Vigilante.
 *
 * Writes to `alfaclub_publications` (schema in [schema.ts](./schema.ts)),
 * keyed by `sha256(creator || windowStart || kind)` so the orchestrator
 * never double-posts the same creator in the same scoring window.
 *
 * Graceful degradation: if Supabase is unavailable every helper returns
 * a no-op result. The caller should treat "unknown" as "do not publish".
 */

import { createHash } from 'node:crypto'
import type { Address } from 'viem'

import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicationKind =
  | 'lens'
  | 'erc8004-submitted'
  | 'erc8004-queued'
  | 'erc8004-failed'

export type PublicationRecord = {
  publicationKey: string
  kind: PublicationKind
  creatorAddress: Address
  tokenId: bigint | null
  scorecardCid: string | null
  scorecardUri: string | null
  scorecardHash: string | null
  lensPostId: string | null
  erc8004TxHash: string | null
  erc8004Calldata: string | null
  score: number | null
  rank: number | null
  createdAt: string
  submissionAttempts: number
  lastSubmissionError: string | null
  lastSubmissionAt: string | null
}

export type NewPublicationInput = Omit<
  PublicationRecord,
  'createdAt' | 'submissionAttempts' | 'lastSubmissionError' | 'lastSubmissionAt'
> & {
  submissionAttempts?: number
  lastSubmissionError?: string | null
  lastSubmissionAt?: string | null
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Stable publication key. Same `(creator, windowStart, kind)` → same key,
 * so re-running the cron within the same window is idempotent.
 */
export function makePublicationKey(params: {
  creatorAddress: string
  windowStart: string // ISO-8601 UTC, e.g. '2026-04-20T12:00:00Z'
  kind: PublicationKind
}): string {
  const input = [
    params.creatorAddress.toLowerCase(),
    params.windowStart,
    params.kind,
  ].join('|')
  return `0x${createHash('sha256').update(input).digest('hex')}`
}

/**
 * Bucket a timestamp to the start of the cooldown window so every run
 * inside the same window resolves to the same key.
 *
 * Default window is 24 hours; override via ALFACLUB_VIGILANTE_POST_COOLDOWN_HOURS.
 */
export function bucketWindowStart(
  now: Date,
  cooldownHours: number,
): string {
  const ms = cooldownHours * 60 * 60 * 1_000
  if (!Number.isFinite(ms) || ms <= 0) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  }
  const bucket = Math.floor(now.getTime() / ms) * ms
  return new Date(bucket).toISOString()
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function hasPublication(publicationKey: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    const result = await db.sql`
      SELECT COUNT(*)::text AS n
      FROM alfaclub_publications
      WHERE publication_key = ${publicationKey};
    `
    const rows = (result.rows ?? []) as Array<{ n: string }>
    const row = rows[0]
    if (!row?.n) return false
    return Number.parseInt(row.n, 10) > 0
  } catch {
    return false
  }
}

type PublicationRow = {
  publication_key: string
  kind: string
  creator_address: string
  token_id: string | null
  scorecard_cid: string | null
  scorecard_uri: string | null
  scorecard_hash: string | null
  lens_post_id: string | null
  erc8004_tx_hash: string | null
  erc8004_calldata: string | null
  score: string | null
  rank: number | null
  created_at: string
  submission_attempts?: number | null
  last_submission_error?: string | null
  last_submission_at?: string | null
}

function rowToPublication(r: PublicationRow): PublicationRecord {
  return {
    publicationKey: r.publication_key,
    kind: r.kind as PublicationKind,
    creatorAddress: r.creator_address.toLowerCase() as Address,
    tokenId: r.token_id ? BigInt(r.token_id) : null,
    scorecardCid: r.scorecard_cid,
    scorecardUri: r.scorecard_uri,
    scorecardHash: r.scorecard_hash,
    lensPostId: r.lens_post_id,
    erc8004TxHash: r.erc8004_tx_hash,
    erc8004Calldata: r.erc8004_calldata,
    score: r.score !== null ? Number.parseFloat(r.score) : null,
    rank: r.rank,
    createdAt: r.created_at,
    submissionAttempts:
      typeof r.submission_attempts === 'number' && Number.isFinite(r.submission_attempts)
        ? r.submission_attempts
        : 0,
    lastSubmissionError: r.last_submission_error ?? null,
    lastSubmissionAt: r.last_submission_at ?? null,
  }
}

export async function recentPublicationsForCreator(
  creatorAddress: string,
  kind: PublicationKind,
  limit = 10,
): Promise<PublicationRecord[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      SELECT publication_key, kind, creator_address,
             token_id::text AS token_id,
             scorecard_cid, scorecard_uri, scorecard_hash,
             lens_post_id, erc8004_tx_hash, erc8004_calldata,
             score::text AS score, rank, created_at::text AS created_at,
             submission_attempts, last_submission_error,
             last_submission_at::text AS last_submission_at
      FROM alfaclub_publications
      WHERE creator_address = ${creatorAddress.toLowerCase()} AND kind = ${kind}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `
    const rows = (result.rows ?? []) as PublicationRow[]
    return rows.map(rowToPublication)
  } catch {
    return []
  }
}

export async function listRecentPublications(
  kind: PublicationKind | null,
  limit = 50,
): Promise<PublicationRecord[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = kind
      ? await db.sql`
          SELECT publication_key, kind, creator_address,
                 token_id::text AS token_id,
                 scorecard_cid, scorecard_uri, scorecard_hash,
                 lens_post_id, erc8004_tx_hash, erc8004_calldata,
                 score::text AS score, rank, created_at::text AS created_at,
                 submission_attempts, last_submission_error,
                 last_submission_at::text AS last_submission_at
          FROM alfaclub_publications
          WHERE kind = ${kind}
          ORDER BY created_at DESC
          LIMIT ${limit};
        `
      : await db.sql`
          SELECT publication_key, kind, creator_address,
                 token_id::text AS token_id,
                 scorecard_cid, scorecard_uri, scorecard_hash,
                 lens_post_id, erc8004_tx_hash, erc8004_calldata,
                 score::text AS score, rank, created_at::text AS created_at,
                 submission_attempts, last_submission_error,
                 last_submission_at::text AS last_submission_at
          FROM alfaclub_publications
          ORDER BY created_at DESC
          LIMIT ${limit};
        `
    const rows = (result.rows ?? []) as PublicationRow[]
    return rows.map(rowToPublication)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a publication row. If the publication_key already exists, the
 * insert is skipped (primary-key conflict) and this function returns false.
 */
export async function recordPublication(input: NewPublicationInput): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    await ensureAlfaClubVigilanteSchema()
    await db.sql`
      INSERT INTO alfaclub_publications (
        publication_key, kind, creator_address, token_id,
        scorecard_cid, scorecard_uri, scorecard_hash,
        lens_post_id, erc8004_tx_hash, erc8004_calldata,
        score, rank
      ) VALUES (
        ${input.publicationKey},
        ${input.kind},
        ${input.creatorAddress.toLowerCase()},
        ${input.tokenId ? input.tokenId.toString() : null},
        ${input.scorecardCid},
        ${input.scorecardUri},
        ${input.scorecardHash},
        ${input.lensPostId},
        ${input.erc8004TxHash},
        ${input.erc8004Calldata},
        ${input.score ?? null},
        ${input.rank ?? null}
      )
      ON CONFLICT (publication_key) DO NOTHING;
    `
    return true
  } catch {
    return false
  }
}

/** Attach an onchain tx hash to a previously-queued ERC-8004 row. */
export async function attachErc8004TxHash(
  publicationKey: string,
  txHash: string,
): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    await db.sql`
      UPDATE alfaclub_publications
      SET erc8004_tx_hash = ${txHash},
          kind = 'erc8004-submitted',
          last_submission_at = NOW()
      WHERE publication_key = ${publicationKey};
    `
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Drain-queue helpers (long-lived submission loop on Railway; AlfaClub
// control path now runs on Vercel cron, so this is a legacy/opt-in path)
// ---------------------------------------------------------------------------

/**
 * List ERC-8004 rows queued for autonomous submission. FIFO, excludes rows
 * that have already been submitted, abandoned, or that failed a selector
 * validation permanently. Callers should re-derive the target registry
 * address themselves and validate the stored calldata before submitting.
 */
export async function listQueuedFeedback(limit: number): Promise<PublicationRecord[]> {
  const db = await getDb()
  if (!db) return []
  const bounded = Math.max(0, Math.min(100, Math.floor(limit)))
  if (bounded === 0) return []
  try {
    const result = await db.sql`
      SELECT publication_key, kind, creator_address,
             token_id::text AS token_id,
             scorecard_cid, scorecard_uri, scorecard_hash,
             lens_post_id, erc8004_tx_hash, erc8004_calldata,
             score::text AS score, rank, created_at::text AS created_at,
             submission_attempts, last_submission_error,
             last_submission_at::text AS last_submission_at
      FROM alfaclub_publications
      WHERE kind = 'erc8004-queued'
        AND erc8004_tx_hash IS NULL
        AND erc8004_calldata IS NOT NULL
      ORDER BY created_at ASC
      LIMIT ${bounded};
    `
    const rows = (result.rows ?? []) as PublicationRow[]
    return rows.map(rowToPublication)
  } catch {
    return []
  }
}

/**
 * Record a failed submission attempt without advancing the row past
 * `erc8004-queued`. The drain loop uses `submission_attempts` to decide
 * when to abandon.
 */
export async function markSubmissionAttemptFailed(
  publicationKey: string,
  err: string,
): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  const truncated = err.length > 1_000 ? `${err.slice(0, 1_000)}…(truncated)` : err
  try {
    await db.sql`
      UPDATE alfaclub_publications
      SET submission_attempts = COALESCE(submission_attempts, 0) + 1,
          last_submission_error = ${truncated},
          last_submission_at = NOW()
      WHERE publication_key = ${publicationKey};
    `
    return true
  } catch {
    return false
  }
}

/**
 * Permanently abandon a queued row. Flips `kind` to `'erc8004-failed'` so
 * subsequent drain ticks skip it.
 */
export async function abandonQueuedFeedback(
  publicationKey: string,
  finalError: string,
): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  const truncated =
    finalError.length > 1_000 ? `${finalError.slice(0, 1_000)}…(truncated)` : finalError
  try {
    await db.sql`
      UPDATE alfaclub_publications
      SET kind = 'erc8004-failed',
          last_submission_error = ${truncated},
          last_submission_at = NOW()
      WHERE publication_key = ${publicationKey};
    `
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Metrics snapshot (writes)
// ---------------------------------------------------------------------------

export type MetricsSnapshotRow = {
  snapshotTs: string
  creatorAddress: Address
  tokenId: bigint
  totalSupply: bigint
  stakedSupply: bigint
  pnl30dUsd: number | null
  hlAccountValueUsd: number | null
  score: number
  rank: number
}

export async function insertMetricsSnapshot(rows: readonly MetricsSnapshotRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const db = await getDb()
  if (!db) return 0
  let inserted = 0
  for (const r of rows) {
    try {
      // Scoring snapshots are canonical product data (not telemetry).
      // Never sample this table; dropping rows can freeze latest snapshot resolution.
      await db.sql`
        INSERT INTO alfaclub_metrics_snapshot (
          snapshot_ts, creator_address, token_id,
          total_supply, staked_supply,
          pnl_30d_usd, hl_account_value,
          score, rank
        ) VALUES (
          ${r.snapshotTs},
          ${r.creatorAddress.toLowerCase()},
          ${r.tokenId.toString()},
          ${r.totalSupply.toString()},
          ${r.stakedSupply.toString()},
          ${r.pnl30dUsd},
          ${r.hlAccountValueUsd},
          ${r.score},
          ${r.rank}
        )
        ON CONFLICT (snapshot_ts, creator_address) DO NOTHING;
      `
      inserted += 1
    } catch {
      // Best-effort.
    }
  }
  return inserted
}

export async function getLatestSnapshotTs(): Promise<string | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`
      SELECT MAX(snapshot_ts)::text AS snapshot_ts FROM alfaclub_metrics_snapshot;
    `
    const rows = (result.rows ?? []) as Array<{ snapshot_ts: string | null }>
    const row = rows[0]
    return row?.snapshot_ts ?? null
  } catch {
    return null
  }
}

export async function getSnapshotAt(snapshotTs: string): Promise<MetricsSnapshotRow[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const result = await db.sql`
      SELECT snapshot_ts::text AS snapshot_ts,
             creator_address,
             token_id::text AS token_id,
             total_supply::text AS total_supply,
             staked_supply::text AS staked_supply,
             pnl_30d_usd::text AS pnl_30d_usd,
             hl_account_value::text AS hl_account_value,
             score::text AS score,
             rank
      FROM alfaclub_metrics_snapshot
      WHERE snapshot_ts = ${snapshotTs}
      ORDER BY rank ASC;
    `
    const rows = (result.rows ?? []) as Array<{
      snapshot_ts: string
      creator_address: string
      token_id: string
      total_supply: string
      staked_supply: string
      pnl_30d_usd: string | null
      hl_account_value: string | null
      score: string
      rank: number
    }>
    return rows.map((r) => ({
      snapshotTs: r.snapshot_ts,
      creatorAddress: r.creator_address.toLowerCase() as Address,
      tokenId: BigInt(r.token_id),
      totalSupply: BigInt(r.total_supply),
      stakedSupply: BigInt(r.staked_supply),
      pnl30dUsd: r.pnl_30d_usd !== null ? Number.parseFloat(r.pnl_30d_usd) : null,
      hlAccountValueUsd: r.hl_account_value !== null ? Number.parseFloat(r.hl_account_value) : null,
      score: Number.parseFloat(r.score),
      rank: r.rank,
    }))
  } catch {
    return []
  }
}
