import { getDb } from '../db/postgres.js'
import { ensureTelemetryCreativeLogsSchema } from '../db/schemaBootstrap.js'
import { shouldSample } from '../infra/telemetrySampling.js'

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
  await ensureTelemetryCreativeLogsSchema(db as any)
  schemaEnsured = true
}

export async function trackChatCommandCenterEvent(input: EventInput): Promise<void> {
  try {
    await ensureSchema()
    const db = await getDb()
    if (!db) return

    // High-volume command center sampling
    const sampleKey = input.conversationId ?? input.commandId ?? input.event
    if (!shouldSample(sampleKey)) return

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
