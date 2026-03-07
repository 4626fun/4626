import { randomUUID } from 'node:crypto'

import { getDb } from './postgres.js'
import { ensureImageGenerationSchema, updateImageGenerationProject } from './imageProjects.js'

export type ImageGenerationJobKind = 'generate' | 'refine'
export type ImageGenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ImageGenerationJob = {
  id: string
  projectId: string
  kind: ImageGenerationJobKind
  status: ImageGenerationJobStatus
  refineInstruction: string | null
  attempts: number
  maxAttempts: number
  latestError: string | null
  result: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

function rowToJob(row: any): ImageGenerationJob {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: String(row.kind) === 'refine' ? 'refine' : 'generate',
    status: String(row.status) as ImageGenerationJobStatus,
    refineInstruction: row.refine_instruction == null ? null : String(row.refine_instruction),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    latestError: row.latest_error == null ? null : String(row.latest_error),
    result: row.result_json && typeof row.result_json === 'object'
      ? (row.result_json as Record<string, unknown>)
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at == null ? null : new Date(row.completed_at).toISOString(),
  }
}

async function ensureSchema() {
  await ensureImageGenerationSchema()
}

export async function enqueueImageGenerationJob(input: {
  projectId: string
  kind: ImageGenerationJobKind
  refineInstruction?: string | null
}): Promise<ImageGenerationJob> {
  await ensureSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const jobId = `imgjob_${randomUUID()}`
  const result = await db.sql`
    INSERT INTO image_generation_jobs (
      id, project_id, kind, status, refine_instruction
    ) VALUES (
      ${jobId},
      ${input.projectId},
      ${input.kind},
      'pending',
      ${input.refineInstruction ?? null}
    )
    RETURNING *;
  `

  await updateImageGenerationProject({
    projectId: input.projectId,
    status: 'queued',
    latestError: null,
  })

  return rowToJob((result.rows ?? [])[0] ?? {})
}

export async function getImageGenerationJob(jobId: string): Promise<ImageGenerationJob | null> {
  await ensureSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const result = await db.sql`
    SELECT *
      FROM image_generation_jobs
     WHERE id = ${jobId}
     LIMIT 1;
  `

  const row = (result.rows ?? [])[0]
  return row ? rowToJob(row) : null
}

export async function leaseImageGenerationJob(jobId: string, workerId: string): Promise<ImageGenerationJob | null> {
  await ensureSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const result = await db.sql`
    UPDATE image_generation_jobs
       SET status = 'processing',
           leased_at = NOW(),
           leased_by = ${workerId},
           attempts = attempts + 1,
           updated_at = NOW()
     WHERE id = ${jobId}
       AND status = 'pending'
     RETURNING *;
  `

  const row = (result.rows ?? [])[0]
  return row ? rowToJob(row) : null
}

export async function updateImageGenerationJob(input: {
  jobId: string
  status?: ImageGenerationJobStatus
  latestError?: string | null
  result?: Record<string, unknown> | null
  completed?: boolean
}): Promise<void> {
  await ensureSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  await db.sql`
    UPDATE image_generation_jobs
       SET status = COALESCE(${input.status ?? null}, status),
           latest_error = ${input.latestError ?? null},
           result_json = ${input.result ? JSON.stringify(input.result) : null}::jsonb,
           updated_at = NOW(),
           completed_at = CASE WHEN ${Boolean(input.completed)} THEN NOW() ELSE completed_at END
     WHERE id = ${input.jobId};
  `
}
