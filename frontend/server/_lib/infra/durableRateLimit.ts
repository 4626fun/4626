import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from './rateLimit.js'
import { getDb, isDbConfigured } from '../db/postgres.js'

type Db = { query?: (text: string, params?: any[]) => Promise<{ rows: any[] }>; sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false
let schemaEnsurePromise: Promise<void> | null = null

// M-32 (4626-341): The `agent_rate_limits` table is now defined by
// supabase/migrations/*_kpr_runtime_and_agent_rate_limits_schema.sql.
// This helper previously issued CREATE TABLE IF NOT EXISTS DDL at
// application boot. We keep the preflight check to decide whether to
// use the durable path, but we no longer issue DDL from application
// code — if the table is missing, the caller falls back to its
// in-memory limiter (or fail-closed, per `DurableRateLimitOptions`).
let loggedMissingSchemaWarning = false

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
    if (!loggedMissingSchemaWarning) {
      loggedMissingSchemaWarning = true
      console.warn(
        '[durableRateLimit] agent_rate_limits table missing. Apply '
          + 'supabase/migrations/*_kpr_runtime_and_agent_rate_limits_schema.sql; '
          + 'until then the durable limiter will fall back per DurableRateLimitOptions.',
      )
    }
    schemaEnsured = false
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

export type DurableRateLimitResult = RateLimitResult & { source: 'db' | 'memory' | 'fail-closed' }

export type DurableRateLimitOptions = {
  /**
   * When true, do NOT fall back to the in-memory limiter if Postgres is
   * unavailable or the query fails — instead deny the request. This is
   * mandatory for security-sensitive gates (auth, deploy-create, agent
   * writes) where a memory fallback is trivially bypassed across serverless
   * instances (H-07 / 4626-299).
   */
  failClosed?: boolean
}

function failClosedResult(config: RateLimitConfig, now: number): DurableRateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + config.windowMs,
    source: 'fail-closed',
  }
}

/**
 * Durable rate limit using Postgres when configured.
 * Falls back to in-memory limiter if DB is unavailable, unless the caller
 * passes `failClosed: true` — in which case we deny the request.
 */
export async function checkDurableRateLimit(
  key: string,
  config: RateLimitConfig,
  options: DurableRateLimitOptions = {},
): Promise<DurableRateLimitResult> {
  const now = Date.now()

  if (!isDbConfigured()) {
    if (options.failClosed) return failClosedResult(config, now)
    return { ...checkRateLimit(key, config), source: 'memory' }
  }

  const db = await getDb()
  if (!db) {
    if (options.failClosed) return failClosedResult(config, now)
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
      // Unexpected shape; fall back to memory limiter (or fail-closed).
      if (options.failClosed) return failClosedResult(config, now)
      return { ...checkRateLimit(key, config), source: 'memory' }
    }

    const allowed = (count as number) <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - (count as number))
    return { allowed, remaining, resetAt, source: 'db' }
  } catch {
    if (options.failClosed) return failClosedResult(config, now)
    return { ...checkRateLimit(key, config), source: 'memory' }
  }
}

