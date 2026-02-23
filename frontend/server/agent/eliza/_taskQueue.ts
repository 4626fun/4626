import { randomUUID } from 'node:crypto'

import { getDb } from '../../_lib/postgres.js'
import { logger } from '../../_lib/logger.js'

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

const CREATE_QUEUE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_background_tasks (
    id BIGSERIAL PRIMARY KEY,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leased_at TIMESTAMPTZ,
    leased_by TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const CREATE_QUEUE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_background_tasks_pending_idx
    ON agent_background_tasks (status, priority DESC, run_after ASC, created_at ASC);
`

let queueSchemaEnsured = false

async function execRaw(db: any, text: string): Promise<void> {
  if (typeof db?.query === 'function') {
    await db.query(text)
    return
  }
  const stmt = [text] as unknown as TemplateStringsArray
  ;(stmt as any).raw = [text]
  await db.sql(stmt)
}

async function ensureQueueSchema(): Promise<void> {
  if (queueSchemaEnsured) return
  const db = await getDb()
  if (!db) return
  await execRaw(db as any, CREATE_QUEUE_TABLE_SQL)
  await execRaw(db as any, CREATE_QUEUE_INDEX_SQL)
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

async function markTaskDone(id: number): Promise<void> {
  const db = await getDb()
  if (!db) return
  await db.sql`
    UPDATE agent_background_tasks
       SET status = 'done',
           updated_at = NOW(),
           last_error = NULL
     WHERE id = ${id};
  `
}

async function markTaskFailed(params: {
  id: number
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
           updated_at = NOW(),
           last_error = ${params.error}
     WHERE id = ${params.id};
  `
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
      for (let i = 0; i < maxTasksPerTick; i += 1) {
        const task = await leaseNextTask(workerId)
        if (!task) break
        try {
          await params.handleTask(task)
          await markTaskDone(task.id)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await markTaskFailed({
            id: task.id,
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

