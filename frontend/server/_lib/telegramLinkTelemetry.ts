import { logger } from './infra/logger.js'
import { getDb, getDbInitError, isDbConfigured } from './db/postgres.js'

type TelegramLinkTelemetryInput = {
  event: string
  source?: string | null
  flowId?: string | null
  phase?: string | null
  status?: string | null
  telegramUserId?: string | null
  privyUserId?: string | null
  chatId?: string | null
  payload?: Record<string, unknown> | null
}

let schemaEnsured = false
let schemaEnsurePromise: Promise<void> | null = null
let dbPersistBackoffUntilMs = 0
let lastBackoffReason: string | null = null

const TELEMETRY_DB_SATURATION_BACKOFF_MS = 60_000
const TELEMETRY_DB_UNAVAILABLE_BACKOFF_MS = 15_000

function envBool(value: string | undefined): boolean | undefined {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return undefined
}

function shouldPersistTelegramLinkTelemetry(): boolean {
  const override = envBool(process.env.TELEGRAM_LINK_TELEMETRY_DB_PERSIST)
  if (override !== undefined) return override
  return !(process.env.VERCEL || process.env.VERCEL_ENV)
}

function asTrimmed(value: unknown, maxLength = 256): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function messageIncludesDbSaturation(value: unknown): boolean {
  const lc = String(value ?? '').toLowerCase()
  if (!lc) return false
  return (
    lc.includes('max client connections reached') ||
    lc.includes('maxclientsinsessionmode') ||
    (lc.includes('max clients reached') && lc.includes('session mode'))
  )
}

function inDbPersistBackoff(now = Date.now()): boolean {
  return dbPersistBackoffUntilMs > now
}

function setDbPersistBackoff(params: { reason: string; durationMs: number }): void {
  const nextUntil = Date.now() + Math.max(1_000, params.durationMs)
  if (nextUntil <= dbPersistBackoffUntilMs && params.reason === lastBackoffReason) return
  dbPersistBackoffUntilMs = nextUntil
  lastBackoffReason = params.reason
  logger.warn('[telegram/link-telemetry] db persistence paused', {
    reason: params.reason,
    resumeInMs: params.durationMs,
  })
}

function clearDbPersistBackoff(): void {
  dbPersistBackoffUntilMs = 0
  lastBackoffReason = null
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return null
  if (depth >= 4) return '[truncated]'
  if (typeof value === 'string') return value.slice(0, 512)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1))
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record).slice(0, 40)) {
      out[key.slice(0, 128)] = sanitizeValue(entry, depth + 1)
    }
    return out
  }
  return String(value).slice(0, 512)
}

function sanitizePayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  return sanitizeValue(payload) as Record<string, unknown>
}

async function ensureSchema(db: Awaited<ReturnType<typeof getDb>> | null) {
  if (schemaEnsured) return
  if (!db) return
  if (schemaEnsurePromise) return schemaEnsurePromise

  schemaEnsurePromise = (async () => {
    // Fast path for warm production schema: avoid repeating DDL on cold starts.
    const preflight = await db.sql`
      SELECT
        to_regclass('public.telegram_link_telemetry_events') IS NOT NULL AS table_exists,
        EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'telegram_link_telemetry_events'
            AND policyname = 'telegram_link_telemetry_events_deny_all'
        ) AS has_deny_policy;
    `
    const status = preflight.rows?.[0] ?? {}
    if (Boolean(status.table_exists) && Boolean(status.has_deny_policy)) {
      schemaEnsured = true
      return
    }

    await db.sql`
      CREATE TABLE IF NOT EXISTS telegram_link_telemetry_events (
        id BIGSERIAL PRIMARY KEY,
        event TEXT NOT NULL,
        source TEXT NULL,
        flow_id TEXT NULL,
        phase TEXT NULL,
        status TEXT NULL,
        telegram_user_id TEXT NULL,
        privy_user_id TEXT NULL,
        chat_id TEXT NULL,
        payload JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    try {
      await db.sql`ALTER TABLE telegram_link_telemetry_events ENABLE ROW LEVEL SECURITY;`
    } catch {
      // Ignore if RLS toggles are unavailable in this runtime.
    }
    try {
      await db.sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'telegram_link_telemetry_events'
              AND policyname = 'telegram_link_telemetry_events_deny_all'
          ) THEN
            CREATE POLICY telegram_link_telemetry_events_deny_all
              ON telegram_link_telemetry_events
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
    await db.sql`
      CREATE INDEX IF NOT EXISTS telegram_link_telemetry_events_created_idx
        ON telegram_link_telemetry_events (created_at DESC);
    `

    schemaEnsured = true
  })()
    .catch((error) => {
      schemaEnsured = false
      throw error
    })
    .finally(() => {
      schemaEnsurePromise = null
    })

  return schemaEnsurePromise
}

export async function trackTelegramLinkEvent(input: TelegramLinkTelemetryInput): Promise<void> {
  const event = asTrimmed(input.event, 128)
  if (!event) return

  const row = {
    event,
    source: asTrimmed(input.source, 64),
    flowId: asTrimmed(input.flowId, 128),
    phase: asTrimmed(input.phase, 64),
    status: asTrimmed(input.status, 64),
    telegramUserId: asTrimmed(input.telegramUserId, 128),
    privyUserId: asTrimmed(input.privyUserId, 128),
    chatId: asTrimmed(input.chatId, 128),
    payload: sanitizePayload(input.payload),
  }

  logger.info('[telegram/link-telemetry] event', row)

  if (!shouldPersistTelegramLinkTelemetry()) return
  if (!isDbConfigured()) return
  if (inDbPersistBackoff()) return

  const initError = getDbInitError()
  if (messageIncludesDbSaturation(initError)) {
    setDbPersistBackoff({
      reason: 'postgres_session_mode_saturated',
      durationMs: TELEMETRY_DB_SATURATION_BACKOFF_MS,
    })
    return
  }

  try {
    const db = await getDb()
    if (!db) {
      const latestInitError = getDbInitError()
      if (messageIncludesDbSaturation(latestInitError)) {
        setDbPersistBackoff({
          reason: 'postgres_session_mode_saturated',
          durationMs: TELEMETRY_DB_SATURATION_BACKOFF_MS,
        })
      } else {
        setDbPersistBackoff({
          reason: 'postgres_unavailable',
          durationMs: TELEMETRY_DB_UNAVAILABLE_BACKOFF_MS,
        })
      }
      return
    }
    await ensureSchema(db)
    await db.sql`
      INSERT INTO telegram_link_telemetry_events (
        event,
        source,
        flow_id,
        phase,
        status,
        telegram_user_id,
        privy_user_id,
        chat_id,
        payload
      )
      VALUES (
        ${row.event},
        ${row.source},
        ${row.flowId},
        ${row.phase},
        ${row.status},
        ${row.telegramUserId},
        ${row.privyUserId},
        ${row.chatId},
        ${row.payload ? JSON.stringify(row.payload) : null}
      );
    `
    clearDbPersistBackoff()
  } catch (error) {
    if (messageIncludesDbSaturation(error instanceof Error ? error.message : String(error))) {
      setDbPersistBackoff({
        reason: 'postgres_session_mode_saturated',
        durationMs: TELEMETRY_DB_SATURATION_BACKOFF_MS,
      })
    }
    logger.warn('[telegram/link-telemetry] persist failed', {
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
