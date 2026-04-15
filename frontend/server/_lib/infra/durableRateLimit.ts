import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from './rateLimit.js'
import { getDb, isDbConfigured } from '../db/postgres.js'

type Db = { query?: (text: string, params?: any[]) => Promise<{ rows: any[] }>; sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false
let schemaEnsurePromise: Promise<void> | null = null

async function ensureSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  if (schemaEnsurePromise) return schemaEnsurePromise

  schemaEnsurePromise = (async () => {
    const preflight = await db.sql`
      SELECT to_regclass('public.agent_rate_limits') IS NOT NULL AS table_exists;
    `
    if (Boolean(preflight.rows?.[0]?.table_exists)) {
      schemaEnsured = true
      return
    }

    await db.sql`
      CREATE TABLE IF NOT EXISTS agent_rate_limits (
        key TEXT NOT NULL,
        window_id BIGINT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (key, window_id)
      );
    `
    schemaEnsured = true
  })()
    .catch(() => {
      schemaEnsured = false
    })
    .finally(() => {
      schemaEnsurePromise = null
    })

  return schemaEnsurePromise
}

function windowId(nowMs: number, windowMs: number): bigint {
  const w = Math.max(1, Math.floor(windowMs))
  return BigInt(Math.floor(nowMs / w))
}

function windowResetAtMs(id: bigint, windowMs: number): number {
  const w = Math.max(1, Math.floor(windowMs))
  // reset at the *end* of this window (start of next)
  return Number((id + 1n) * BigInt(w))
}

export type DurableRateLimitResult = RateLimitResult & { source: 'db' | 'memory' }

/**
 * Durable rate limit using Postgres when configured.
 * Falls back to in-memory limiter if DB is unavailable.
 */
export async function checkDurableRateLimit(key: string, config: RateLimitConfig): Promise<DurableRateLimitResult> {
  const now = Date.now()

  if (!isDbConfigured()) {
    return { ...checkRateLimit(key, config), source: 'memory' }
  }

  const db = await getDb()
  if (!db) {
    return { ...checkRateLimit(key, config), source: 'memory' }
  }

  await ensureSchema(db as any)

  const wid = windowId(now, config.windowMs)
  const resetAt = windowResetAtMs(wid, config.windowMs)

  try {
    let count: number | null = null
    if (typeof (db as any).query === 'function') {
      const q = await (db as any).query(
        `INSERT INTO agent_rate_limits (key, window_id, count)
         VALUES ($1, $2, 1)
         ON CONFLICT (key, window_id)
         DO UPDATE SET count = agent_rate_limits.count + 1
         RETURNING count;`,
        [key, String(wid)],
      )
      const row = Array.isArray(q?.rows) ? q.rows[0] : null
      count = row?.count != null ? Number(row.count) : null
    } else {
      const q = await (db as any).sql`
        INSERT INTO agent_rate_limits (key, window_id, count)
        VALUES (${key}, ${String(wid)}, 1)
        ON CONFLICT (key, window_id)
        DO UPDATE SET count = agent_rate_limits.count + 1
        RETURNING count;
      `
      const row = Array.isArray(q?.rows) ? q.rows[0] : null
      count = row?.count != null ? Number(row.count) : null
    }

    if (!Number.isFinite(count as any)) {
      // Unexpected shape; fall back to memory limiter.
      return { ...checkRateLimit(key, config), source: 'memory' }
    }

    const allowed = (count as number) <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - (count as number))
    return { allowed, remaining, resetAt, source: 'db' }
  } catch {
    return { ...checkRateLimit(key, config), source: 'memory' }
  }
}

