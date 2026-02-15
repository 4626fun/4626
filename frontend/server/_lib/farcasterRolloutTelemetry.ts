import { getDb } from './postgres.js'

type EventInput = {
  category: 'provider_resolution' | 'frame_validation' | 'agent_publish'
  endpoint: string
  mode: string | null
  source: string | null
  statusCode: number | null
  metadata?: Record<string, unknown> | null
}

let schemaEnsured = false

async function ensureSchema() {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return
  await db.sql`
    CREATE TABLE IF NOT EXISTS farcaster_rollout_events (
      id BIGSERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      mode TEXT NULL,
      source TEXT NULL,
      status_code INTEGER NULL,
      metadata JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS farcaster_rollout_events_created_idx ON farcaster_rollout_events (created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS farcaster_rollout_events_category_idx ON farcaster_rollout_events (category, created_at DESC);`
  schemaEnsured = true
}

export async function trackFarcasterRolloutEvent(input: EventInput): Promise<void> {
  try {
    await ensureSchema()
    const db = await getDb()
    if (!db) return
    await db.sql`
      INSERT INTO farcaster_rollout_events (category, endpoint, mode, source, status_code, metadata)
      VALUES (
        ${input.category},
        ${input.endpoint},
        ${input.mode},
        ${input.source},
        ${input.statusCode},
        ${input.metadata ? JSON.stringify(input.metadata) : null}
      );
    `
  } catch {
    // Telemetry must not fail request paths.
  }
}

export async function readProviderSourceDashboard(params?: { hours?: number }): Promise<{
  windowHours: number
  total: number
  bySource: Array<{ source: string; count: number }>
  byMode: Array<{ mode: string; count: number }>
  protocolShare: number
  recommendation: string
}> {
  const windowHours = Math.max(1, Math.min(24 * 30, Number(params?.hours ?? 24 * 7) || 24 * 7))
  const db = await getDb()
  if (!db) {
    return {
      windowHours,
      total: 0,
      bySource: [],
      byMode: [],
      protocolShare: 0,
      recommendation: 'db_unavailable_keep_hybrid',
    }
  }

  await ensureSchema()
  const rows = await db.sql`
    SELECT
      COALESCE(source, 'none') AS source,
      COALESCE(mode, 'unknown') AS mode,
      COUNT(*)::bigint AS count
    FROM farcaster_rollout_events
    WHERE category = 'provider_resolution'
      AND created_at >= NOW() - (${windowHours}::text || ' hours')::interval
    GROUP BY COALESCE(source, 'none'), COALESCE(mode, 'unknown')
  `

  const bySourceMap = new Map<string, number>()
  const byModeMap = new Map<string, number>()
  let total = 0
  for (const row of rows.rows ?? []) {
    const source = String(row?.source ?? 'none')
    const mode = String(row?.mode ?? 'unknown')
    const count = Number(row?.count ?? 0)
    total += count
    bySourceMap.set(source, (bySourceMap.get(source) ?? 0) + count)
    byModeMap.set(mode, (byModeMap.get(mode) ?? 0) + count)
  }

  const protocolCount = bySourceMap.get('protocol') ?? 0
  const protocolShare = total > 0 ? protocolCount / total : 0
  const recommendation =
    total < 200
      ? 'insufficient_sample_keep_hybrid'
      : protocolShare >= 0.95
        ? 'eligible_move_selected_endpoints_to_protocol'
        : 'keep_hybrid_improve_protocol_coverage'

  return {
    windowHours,
    total,
    bySource: Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count })),
    byMode: Array.from(byModeMap.entries()).map(([mode, count]) => ({ mode, count })),
    protocolShare,
    recommendation,
  }
}
