import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureAgentRuntimeAuditLedgerSchema } from '../db/schemaBootstrap.js'
import { shouldSampleEvent } from '../infra/telemetrySampling.js'
import {
  type ControlAuditEvent,
  type ControlAuditEventType,
  type ControlActorType,
  createEventId,
  nowIso,
  toSafeLower,
  toTrimmed,
} from './types.js'

type DbLike = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }>
}

let auditSchemaEnsured = false
let auditSchemaPromise: Promise<void> | null = null

function clip(value: unknown, maxLen = 2_000): string | null {
  const text = toTrimmed(value)
  if (!text) return null
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen)
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

async function resolveDb(input?: DbLike | null): Promise<DbLike | null> {
  if (input?.sql) return input
  if (!isDbConfigured()) return null
  const db = await getDb()
  return db && typeof db.sql === 'function' ? (db as DbLike) : null
}

export async function ensureAgentControlAuditSchema(inputDb?: DbLike | null): Promise<void> {
  if (auditSchemaEnsured) return
  if (auditSchemaPromise) return auditSchemaPromise
  auditSchemaPromise = (async () => {
    const db = await resolveDb(inputDb)
    if (!db) return
    await ensureAgentRuntimeAuditLedgerSchema(db as any)
    auditSchemaEnsured = true
  })()
  try {
    await auditSchemaPromise
  } finally {
    auditSchemaPromise = null
  }
}

export type AppendControlAuditInput = {
  db?: DbLike | null
  event_type: ControlAuditEventType
  proposal_id: string
  capability_id: string
  actor_type: ControlActorType
  actor_id: string
  subsystem: string
  action: string
  status: 'allow' | 'deny' | 'success' | 'failed'
  correlation_id: string
  reason?: string | null
  error_code?: string | null
  error_message?: string | null
  metadata?: Record<string, unknown>
}

export async function appendControlAuditEvent(
  input: AppendControlAuditInput,
): Promise<ControlAuditEvent | null> {
  const db = await resolveDb(input.db)
  if (!db) return null
  await ensureAgentControlAuditSchema(db)

  const event: ControlAuditEvent = {
    event_id: createEventId(),
    event_type: input.event_type,
    proposal_id: toTrimmed(input.proposal_id),
    capability_id: toTrimmed(input.capability_id),
    actor_type: input.actor_type,
    actor_id: toTrimmed(input.actor_id),
    subsystem: toTrimmed(input.subsystem),
    action: toTrimmed(input.action),
    status: input.status,
    correlation_id: toTrimmed(input.correlation_id),
    reason: clip(input.reason),
    error_code: clip(input.error_code, 255),
    error_message: clip(input.error_message),
    metadata: toMetadata(input.metadata),
    created_at: nowIso(),
  }

  // Control-plane audit is high-signal but extremely high volume under load.
  // Sample by correlation or actor for reproducible traces when enabled.
  const sampleKey = event.correlation_id || `${event.actor_id || 'anon'}:${event.event_type}`
  if (!shouldSampleEvent('agent_control_audit_events', sampleKey)) {
    return event // still return the in-memory object for callers that chain
  }

  await db.sql`
    INSERT INTO agent_control_audit_events (
      event_id,
      event_type,
      proposal_id,
      capability_id,
      actor_type,
      actor_id,
      subsystem,
      action,
      status,
      correlation_id,
      reason,
      error_code,
      error_message,
      metadata_json,
      created_at
    ) VALUES (
      ${event.event_id},
      ${toSafeLower(event.event_type)},
      ${event.proposal_id},
      ${event.capability_id},
      ${toSafeLower(event.actor_type)},
      ${event.actor_id},
      ${toSafeLower(event.subsystem)},
      ${toSafeLower(event.action)},
      ${toSafeLower(event.status)},
      ${event.correlation_id},
      ${event.reason},
      ${event.error_code},
      ${event.error_message},
      ${event.metadata},
      ${event.created_at}
    );
  `

  return event
}
