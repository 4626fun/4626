import { randomUUID } from 'node:crypto'

import { getDb } from '../../_lib/db/postgres.js'
import { ensureAgentRuntimeAuditLedgerSchema } from '../../_lib/db/schemaBootstrap.js'
import { logger } from '../../_lib/infra/logger.js'

type AgentTask = {
  id: number
  taskType: string
  payload: Record<string, unknown>
  attempts: number
}

type TaskWorker = {
  stop: () => void
}

const TASK_RETRY_BASE_MS = Math.max(250, Number(process.env.ELIZA_TASK_RETRY_BASE_MS ?? '2000') || 2_000)
const TASK_RETRY_MAX_MS = Math.max(TASK_RETRY_BASE_MS, Number(process.env.ELIZA_TASK_RETRY_MAX_MS ?? '60000') || 60_000)
const TASK_STALE_LEASE_MS = Math.max(1_000, Number(process.env.ELIZA_TASK_LEASE_STALE_MS ?? '300000') || 300_000)

let queueSchemaEnsured = false

async function ensureQueueSchema(): Promise<void> {
  if (queueSchemaEnsured) return
  const db = await getDb()
  if (!db) return
  await ensureAgentRuntimeAuditLedgerSchema(db as any)
  queueSchemaEnsured = true
}

export async function enqueueAgentBackgroundTask(input: {
  taskType: string
  payload: Record<string, unknown>
  priority?: number
  runAfterMs?: number
  maxAttempts?: number
}): Promise<void> {
  await ensureQueueSchema()
  const db = await getDb()
  if (!db) return
  const priority = Number.isFinite(input.priority) ? Number(input.priority) : 0
  const runAfterMs = Number.isFinite(input.runAfterMs) ? Number(input.runAfterMs) : 0
  const maxAttempts = Number.isFinite(input.maxAttempts) ? Math.max(1, Number(input.maxAttempts)) : 3
  await db.sql`
    INSERT INTO agent_background_tasks (
      task_type, status, priority, payload_json, max_attempts, run_after
    ) VALUES (
      ${input.taskType},
      'pending',
      ${priority},
      ${JSON.stringify(input.payload)}::jsonb,
      ${maxAttempts},
      NOW() + (${Math.floor(runAfterMs)} * INTERVAL '1 millisecond')
    );
  `
}

async function leaseNextTask(workerId: string): Promise<AgentTask | null> {
  const db = await getDb()
  if (!db) return null
  const leased = await db.sql`
    UPDATE agent_background_tasks
       SET status = 'processing',
           leased_at = NOW(),
           leased_by = ${workerId},
           attempts = attempts + 1,
           updated_at = NOW()
     WHERE id = (
       SELECT id
         FROM agent_background_tasks
        WHERE status = 'pending'
          AND run_after <= NOW()
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id, task_type, payload_json, attempts;
  `
  const row = (leased.rows ?? [])[0] as any
  if (!row) return null
  return {
    id: Number(row.id),
    taskType: String(row.task_type),
    payload: (row.payload_json ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts ?? 1),
  }
}

async function markTaskDone(params: {
  id: number
  workerId: string
}): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.sql`
    UPDATE agent_background_tasks
       SET status = 'done',
           leased_at = NULL,
           leased_by = NULL,
           updated_at = NOW(),
           last_error = NULL
     WHERE id = ${params.id}
       AND status = 'processing'
       AND leased_by = ${params.workerId};
  `
}

async function markTaskFailed(params: {
  id: number
  workerId: string
  error: string
  retryDelayMs?: number
}): Promise<void> {
  const db = await getDb()
  if (!db) return
  const retryDelayMs = Number.isFinite(params.retryDelayMs) ? Number(params.retryDelayMs) : 5_000
  await db.sql`
    UPDATE agent_background_tasks
       SET status = CASE
         WHEN attempts >= max_attempts THEN 'failed'
         ELSE 'pending'
       END,
           run_after = CASE
             WHEN attempts >= max_attempts THEN run_after
             ELSE NOW() + (${Math.floor(retryDelayMs)} * INTERVAL '1 millisecond')
           END,
           leased_at = NULL,
           leased_by = NULL,
           updated_at = NOW(),
           last_error = ${params.error}
     WHERE id = ${params.id}
       AND status = 'processing'
       AND leased_by = ${params.workerId};
  `
}

async function reclaimStaleLeases(params: {
  workerId: string
  staleLeaseMs: number
}): Promise<number> {
  const db = await getDb()
  if (!db) return 0
  const staleLeaseMs = Math.max(1_000, Math.floor(params.staleLeaseMs))
  const updated = await db.sql`
    UPDATE agent_background_tasks
       SET status = 'pending',
           leased_at = NULL,
           leased_by = NULL,
           run_after = NOW(),
           updated_at = NOW(),
           last_error = COALESCE(last_error, 'stale_lease_reclaimed')
     WHERE status = 'processing'
       AND leased_at IS NOT NULL
       AND leased_at < NOW() - (${staleLeaseMs} * INTERVAL '1 millisecond');
  `
  const rowCount = Number((updated as any)?.rowCount ?? 0)
  return Number.isFinite(rowCount) ? rowCount : 0
}

export type AgentBackgroundQueueStats = {
  pending: number
  processing: number
  done: number
  failed: number
  staleProcessing: number
}

function zeroQueueStats(): AgentBackgroundQueueStats {
  return {
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
    staleProcessing: 0,
  }
}

export async function getAgentBackgroundQueueStats(params?: {
  staleLeaseMs?: number
}): Promise<AgentBackgroundQueueStats> {
  await ensureQueueSchema()
  const db = await getDb()
  if (!db) return zeroQueueStats()
  const staleLeaseMs = Math.max(1_000, Math.floor(params?.staleLeaseMs ?? TASK_STALE_LEASE_MS))
  const staleSeconds = staleLeaseMs / 1000
  const queryText = `
    SELECT status, COUNT(*)::text AS count
    FROM agent_background_tasks
    GROUP BY status
    UNION ALL
    SELECT 'stale_processing' AS status, COUNT(*)::text AS count
    FROM agent_background_tasks
    WHERE status = 'processing'
      AND leased_at IS NOT NULL
      AND leased_at < NOW() - INTERVAL '${staleSeconds} seconds'
  `

  let rows: any[] = []
  if (typeof (db as any).query === 'function') {
    const result = await (db as any).query(queryText)
    rows = (result?.rows ?? []) as any[]
  } else {
    const stmt = [queryText] as unknown as TemplateStringsArray
    ;(stmt as any).raw = [queryText]
    const result = await (db as any).sql(stmt)
    rows = (result?.rows ?? []) as any[]
  }

  const stats = zeroQueueStats()
  for (const row of rows) {
    const status = String((row as any)?.status ?? '').toLowerCase()
    const count = Number((row as any)?.count ?? 0)
    if (!Number.isFinite(count)) continue
    if (status === 'pending') stats.pending = count
    else if (status === 'processing') stats.processing = count
    else if (status === 'done') stats.done = count
    else if (status === 'failed') stats.failed = count
    else if (status === 'stale_processing') stats.staleProcessing = count
  }
  return stats
}

export function startAgentBackgroundTaskWorker(params: {
  workerName: string
  pollMs?: number
  maxTasksPerTick?: number
  handleTask: (task: AgentTask) => Promise<void>
}): TaskWorker {
  const workerId = `${params.workerName}-${randomUUID()}`
  const pollMs = Number.isFinite(params.pollMs) ? Math.max(500, Number(params.pollMs)) : 3_000
  const maxTasksPerTick = Number.isFinite(params.maxTasksPerTick)
    ? Math.max(1, Number(params.maxTasksPerTick))
    : 5
  const staleLeaseMs = Math.max(1_000, Number(process.env.ELIZA_TASK_LEASE_STALE_MS ?? TASK_STALE_LEASE_MS) || TASK_STALE_LEASE_MS)
  let stopped = false
  let tickRunning = false
  const backoffForAttempt = (attempt: number): number => {
    const safeAttempt = Math.max(1, attempt)
    return Math.min(TASK_RETRY_MAX_MS, TASK_RETRY_BASE_MS * Math.pow(2, safeAttempt - 1))
  }

  const tick = async () => {
    if (stopped || tickRunning) return
    tickRunning = true
    try {
      await ensureQueueSchema()
      const reclaimed = await reclaimStaleLeases({
        workerId,
        staleLeaseMs,
      })
      if (reclaimed > 0) {
        logger.warn('[eliza/queue] reclaimed stale processing leases', {
          workerId,
          reclaimed,
          staleLeaseMs,
        })
      }
      for (let i = 0; i < maxTasksPerTick; i += 1) {
        const task = await leaseNextTask(workerId)
        if (!task) break
        try {
          await params.handleTask(task)
          await markTaskDone({
            id: task.id,
            workerId,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await markTaskFailed({
            id: task.id,
            workerId,
            error: message,
            retryDelayMs: backoffForAttempt(task.attempts),
          })
        }
      }
    } catch (error) {
      logger.warn('[eliza/queue] worker tick failed (non-blocking)', {
        workerId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      tickRunning = false
    }
  }

  const interval = setInterval(() => {
    void tick()
  }, pollMs)
  void tick()

  return {
    stop: () => {
      stopped = true
      clearInterval(interval)
    },
  }
}

