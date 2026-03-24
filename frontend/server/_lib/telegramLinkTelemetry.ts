import { logger } from './logger.js'
import { getDb } from './postgres.js'

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

function asTrimmed(value: unknown, maxLength = 256): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
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

async function ensureSchema() {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return

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
  await db.sql`
    CREATE INDEX IF NOT EXISTS telegram_link_telemetry_events_event_idx
      ON telegram_link_telemetry_events (event, created_at DESC);
  `
  await db.sql`
    CREATE INDEX IF NOT EXISTS telegram_link_telemetry_events_flow_idx
      ON telegram_link_telemetry_events (flow_id, created_at DESC);
  `

  schemaEnsured = true
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

  try {
    await ensureSchema()
    const db = await getDb()
    if (!db) return
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
  } catch (error) {
    logger.warn('[telegram/link-telemetry] persist failed', {
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
