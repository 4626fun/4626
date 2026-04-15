import { getDb } from './db/postgres.js'

type EventInput = {
  event: string
  conversationId?: string | null
  conversationType?: string | null
  commandId?: string | null
  source?: string | null
  payload?: Record<string, unknown> | null
}

let schemaEnsured = false

async function ensureSchema() {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) return
  await db.sql`
    CREATE TABLE IF NOT EXISTS chat_command_center_events (
      id BIGSERIAL PRIMARY KEY,
      event TEXT NOT NULL,
      conversation_id TEXT NULL,
      conversation_type TEXT NULL,
      command_id TEXT NULL,
      source TEXT NULL,
      payload JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  try {
    await db.sql`ALTER TABLE chat_command_center_events ENABLE ROW LEVEL SECURITY;`
  } catch {
    // Ignore if RLS toggles are unavailable.
  }
  try {
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'chat_command_center_events'
            AND policyname = 'chat_command_center_events_deny_all'
        ) THEN
          CREATE POLICY chat_command_center_events_deny_all
            ON chat_command_center_events
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
    CREATE INDEX IF NOT EXISTS chat_command_center_events_created_idx
      ON chat_command_center_events (created_at DESC);
  `
  await db.sql`
    CREATE INDEX IF NOT EXISTS chat_command_center_events_event_idx
      ON chat_command_center_events (event, created_at DESC);
  `
  await db.sql`
    CREATE INDEX IF NOT EXISTS chat_command_center_events_command_idx
      ON chat_command_center_events (command_id, created_at DESC);
  `
  schemaEnsured = true
}

export async function trackChatCommandCenterEvent(input: EventInput): Promise<void> {
  try {
    await ensureSchema()
    const db = await getDb()
    if (!db) return
    await db.sql`
      INSERT INTO chat_command_center_events (
        event,
        conversation_id,
        conversation_type,
        command_id,
        source,
        payload
      )
      VALUES (
        ${input.event},
        ${input.conversationId ?? null},
        ${input.conversationType ?? null},
        ${input.commandId ?? null},
        ${input.source ?? null},
        ${input.payload ? JSON.stringify(input.payload) : null}
      );
    `
  } catch {
    // Telemetry must never block user flows.
  }
}
