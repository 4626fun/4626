import { randomUUID } from 'node:crypto'

import { uploadImageStorageObject } from './imageStorage.js'
import { getDb } from './postgres.js'

export type ImageGenerationProjectStatus =
  | 'draft'
  | 'queued'
  | 'generating'
  | 'evaluating'
  | 'completed'
  | 'failed'

export type ImageGenerationAssetRole = 'frame' | 'subject' | 'output'

export type ImageGenerationProject = {
  id: string
  status: ImageGenerationProjectStatus
  instruction: string
  stylePreset: string | null
  brandContext: string[]
  lastResponseId: string | null
  latestError: string | null
  vaultAddress: string | null
  createdAt: string
  updatedAt: string
}

export type ImageGenerationAsset = {
  id: string
  projectId: string
  role: ImageGenerationAssetRole
  filename: string | null
  mimeType: string
  blobPathname: string
  blobUrl: string
  byteSize: number
  createdAt: string
}

export type ImageGenerationAttempt = {
  id: string
  projectId: string
  jobId: string | null
  attemptNumber: number
  kind: 'generate' | 'refine'
  prompt: string
  revisedPrompt: string | null
  responseId: string | null
  evaluation: Record<string, unknown> | null
  score: number | null
  passed: boolean | null
  outputAssetId: string | null
  createdAt: string
}

export type ImageGenerationProjectSnapshot = {
  id: string
  status: ImageGenerationProjectStatus
  instruction: string
  stylePreset: string | null
  brandContext: string[]
  lastResponseId: string | null
  latestError: string | null
  vaultAddress: string | null
  createdAt: string
  updatedAt: string
  assets: ImageGenerationAsset[]
  attempts: ImageGenerationAttempt[]
  latestJob: Record<string, unknown> | null
}

let schemaEnsured = false

export async function ensureImageGenerationSchema() {
  if (schemaEnsured) return
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  await db.sql`
    CREATE TABLE IF NOT EXISTS image_generation_projects (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'draft',
      instruction TEXT NOT NULL DEFAULT '',
      style_preset TEXT,
      brand_context_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_response_id TEXT,
      latest_error TEXT,
      vault_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await db.sql`
    ALTER TABLE image_generation_projects
      ADD COLUMN IF NOT EXISTS vault_address TEXT;
  `

  await db.sql`
    CREATE INDEX IF NOT EXISTS image_generation_projects_vault_address_idx
      ON image_generation_projects (vault_address)
      WHERE vault_address IS NOT NULL;
  `

  await db.sql`
    CREATE TABLE IF NOT EXISTS image_generation_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      filename TEXT,
      mime_type TEXT NOT NULL,
      blob_pathname TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      byte_size INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await db.sql`
    CREATE TABLE IF NOT EXISTS image_generation_attempts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
      job_id TEXT,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      kind TEXT NOT NULL DEFAULT 'generate',
      prompt TEXT NOT NULL,
      revised_prompt TEXT,
      response_id TEXT,
      evaluation_json JSONB,
      score INTEGER,
      passed BOOLEAN,
      output_asset_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await db.sql`
    CREATE TABLE IF NOT EXISTS image_generation_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES image_generation_projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'generate',
      status TEXT NOT NULL DEFAULT 'pending',
      refine_instruction TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      leased_at TIMESTAMPTZ,
      leased_by TEXT,
      latest_error TEXT,
      result_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `

  await db.sql`
    CREATE INDEX IF NOT EXISTS image_generation_assets_project_role_idx
      ON image_generation_assets (project_id, role, created_at DESC);
  `

  await db.sql`
    CREATE INDEX IF NOT EXISTS image_generation_attempts_project_created_idx
      ON image_generation_attempts (project_id, created_at DESC);
  `

  await db.sql`
    CREATE INDEX IF NOT EXISTS image_generation_jobs_project_created_idx
      ON image_generation_jobs (project_id, created_at DESC);
  `

  await db.sql`
    CREATE INDEX IF NOT EXISTS image_generation_jobs_status_run_after_idx
      ON image_generation_jobs (status, run_after ASC, created_at ASC);
  `

  schemaEnsured = true
}

function parseBrandContext(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function safeFilename(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toLowerCase()
  const cleaned = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return cleaned || 'asset'
}

function rowToProject(row: any): ImageGenerationProject {
  return {
    id: String(row.id),
    status: String(row.status) as ImageGenerationProjectStatus,
    instruction: String(row.instruction ?? ''),
    stylePreset: row.style_preset == null ? null : String(row.style_preset),
    brandContext: parseBrandContext(row.brand_context_json),
    lastResponseId: row.last_response_id == null ? null : String(row.last_response_id),
    latestError: row.latest_error == null ? null : String(row.latest_error),
    vaultAddress: row.vault_address == null ? null : String(row.vault_address),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function rowToAsset(row: any): ImageGenerationAsset {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    role: String(row.role) as ImageGenerationAssetRole,
    filename: row.filename == null ? null : String(row.filename),
    mimeType: String(row.mime_type),
    blobPathname: String(row.blob_pathname),
    blobUrl: String(row.blob_url),
    byteSize: Number(row.byte_size ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function rowToAttempt(row: any): ImageGenerationAttempt {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    jobId: row.job_id == null ? null : String(row.job_id),
    attemptNumber: Number(row.attempt_number ?? 1),
    kind: String(row.kind) === 'refine' ? 'refine' : 'generate',
    prompt: String(row.prompt ?? ''),
    revisedPrompt: row.revised_prompt == null ? null : String(row.revised_prompt),
    responseId: row.response_id == null ? null : String(row.response_id),
    evaluation: row.evaluation_json && typeof row.evaluation_json === 'object'
      ? (row.evaluation_json as Record<string, unknown>)
      : null,
    score: row.score == null ? null : Number(row.score),
    passed: row.passed == null ? null : Boolean(row.passed),
    outputAssetId: row.output_asset_id == null ? null : String(row.output_asset_id),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createImageGenerationProject(input: {
  instruction?: string
  stylePreset?: string | null
  brandContext?: string[]
}): Promise<ImageGenerationProject> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const projectId = `imgproj_${randomUUID()}`
  const instruction = String(input.instruction ?? '').trim()
  const stylePreset = input.stylePreset ? String(input.stylePreset).trim() : null
  const brandContext = parseBrandContext(input.brandContext)

  const result = await db.sql`
    INSERT INTO image_generation_projects (
      id, status, instruction, style_preset, brand_context_json
    ) VALUES (
      ${projectId},
      'draft',
      ${instruction},
      ${stylePreset},
      ${JSON.stringify(brandContext)}::jsonb
    )
    RETURNING *;
  `

  return rowToProject((result.rows ?? [])[0] ?? {})
}

export async function attachImageGenerationAsset(input: {
  projectId: string
  role: 'frame' | 'subject'
  filename?: string | null
  contentType: string
  bytes: Uint8Array
}): Promise<ImageGenerationAsset> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const assetId = `imgasset_${randomUUID()}`
  const filename = input.filename ? String(input.filename) : null
  const blobPathname = `imagegen/projects/${input.projectId}/${input.role}/${assetId}-${safeFilename(filename)}`
  const upload = await uploadImageStorageObject({
    pathname: blobPathname,
    bytes: input.bytes,
    contentType: input.contentType,
    cacheControlMaxAgeSeconds: 60 * 60 * 24 * 365,
  })

  await db.sql`
    DELETE FROM image_generation_assets
    WHERE project_id = ${input.projectId}
      AND role = ${input.role};
  `

  const result = await db.sql`
    INSERT INTO image_generation_assets (
      id, project_id, role, filename, mime_type, blob_pathname, blob_url, byte_size
    ) VALUES (
      ${assetId},
      ${input.projectId},
      ${input.role},
      ${filename},
      ${input.contentType},
      ${blobPathname},
      ${upload.url},
      ${input.bytes.byteLength}
    )
    RETURNING *;
  `

  return rowToAsset((result.rows ?? [])[0] ?? {})
}

export async function createOutputImageGenerationAsset(input: {
  projectId: string
  filename?: string | null
  contentType: string
  bytes: Uint8Array
}): Promise<ImageGenerationAsset> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const assetId = `imgasset_${randomUUID()}`
  const filename = input.filename ? String(input.filename) : 'output.png'
  const blobPathname = `imagegen/projects/${input.projectId}/output/${assetId}-${safeFilename(filename)}`
  const upload = await uploadImageStorageObject({
    pathname: blobPathname,
    bytes: input.bytes,
    contentType: input.contentType,
    cacheControlMaxAgeSeconds: 60 * 60 * 24 * 365,
  })

  const result = await db.sql`
    INSERT INTO image_generation_assets (
      id, project_id, role, filename, mime_type, blob_pathname, blob_url, byte_size
    ) VALUES (
      ${assetId},
      ${input.projectId},
      'output',
      ${filename},
      ${input.contentType},
      ${blobPathname},
      ${upload.url},
      ${input.bytes.byteLength}
    )
    RETURNING *;
  `

  return rowToAsset((result.rows ?? [])[0] ?? {})
}

export async function updateImageGenerationProject(input: {
  projectId: string
  status?: ImageGenerationProjectStatus
  lastResponseId?: string | null
  latestError?: string | null
}): Promise<void> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  await db.sql`
    UPDATE image_generation_projects
       SET status = COALESCE(${input.status ?? null}, status),
           last_response_id = COALESCE(${input.lastResponseId ?? null}, last_response_id),
           latest_error = ${input.latestError ?? null},
           updated_at = NOW()
     WHERE id = ${input.projectId};
  `
}

export async function recordImageGenerationAttempt(input: {
  projectId: string
  jobId?: string | null
  attemptNumber: number
  kind: 'generate' | 'refine'
  prompt: string
  revisedPrompt?: string | null
  responseId?: string | null
  evaluation?: Record<string, unknown> | null
  score?: number | null
  passed?: boolean | null
  outputAssetId?: string | null
}): Promise<ImageGenerationAttempt> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const attemptId = `imgattempt_${randomUUID()}`
  const result = await db.sql`
    INSERT INTO image_generation_attempts (
      id, project_id, job_id, attempt_number, kind, prompt, revised_prompt, response_id,
      evaluation_json, score, passed, output_asset_id
    ) VALUES (
      ${attemptId},
      ${input.projectId},
      ${input.jobId ?? null},
      ${input.attemptNumber},
      ${input.kind},
      ${input.prompt},
      ${input.revisedPrompt ?? null},
      ${input.responseId ?? null},
      ${input.evaluation ? JSON.stringify(input.evaluation) : null}::jsonb,
      ${input.score ?? null},
      ${input.passed ?? null},
      ${input.outputAssetId ?? null}
    )
    RETURNING *;
  `

  return rowToAttempt((result.rows ?? [])[0] ?? {})
}

export async function getImageGenerationProject(projectId: string): Promise<ImageGenerationProjectSnapshot | null> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const projectResult = await db.sql`
    SELECT *
      FROM image_generation_projects
     WHERE id = ${projectId}
     LIMIT 1;
  `
  const projectRow = (projectResult.rows ?? [])[0]
  if (!projectRow) return null

  const assetResult = await db.sql`
    SELECT *
      FROM image_generation_assets
     WHERE project_id = ${projectId}
     ORDER BY created_at DESC;
  `

  const attemptResult = await db.sql`
    SELECT *
      FROM image_generation_attempts
     WHERE project_id = ${projectId}
     ORDER BY created_at DESC;
  `

  const latestJobResult = await db.sql`
    SELECT *
      FROM image_generation_jobs
     WHERE project_id = ${projectId}
     ORDER BY created_at DESC
     LIMIT 1;
  `

  return {
    ...rowToProject(projectRow),
    assets: (assetResult.rows ?? []).map(rowToAsset),
    attempts: (attemptResult.rows ?? []).map(rowToAttempt),
    latestJob: ((latestJobResult.rows ?? [])[0] as Record<string, unknown> | undefined) ?? null,
  }
}

export async function getImageGenerationAssetsForProject(projectId: string): Promise<ImageGenerationAsset[]> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  const result = await db.sql`
    SELECT *
      FROM image_generation_assets
     WHERE project_id = ${projectId}
     ORDER BY created_at DESC;
  `

  return (result.rows ?? []).map(rowToAsset)
}

export async function setImageProjectVaultAddress(projectId: string, vaultAddress: string): Promise<void> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) throw new Error('Image generation database unavailable')

  await db.sql`
    UPDATE image_generation_projects
       SET vault_address = ${vaultAddress.toLowerCase()},
           updated_at = NOW()
     WHERE id = ${projectId}
       AND status = 'completed';
  `
}

export async function getCompletedImageProjectForVault(vaultAddress: string): Promise<{
  projectId: string
  outputBlobUrl: string
} | null> {
  await ensureImageGenerationSchema()
  const db = await getDb()
  if (!db) return null

  const result = await db.sql`
    SELECT p.id AS project_id, a.blob_url AS output_blob_url
      FROM image_generation_projects p
      JOIN image_generation_assets a ON a.project_id = p.id AND a.role = 'output'
     WHERE p.vault_address = ${vaultAddress.toLowerCase()}
       AND p.status = 'completed'
     ORDER BY p.updated_at DESC, a.created_at DESC
     LIMIT 1;
  `

  const row = (result.rows ?? [])[0]
  if (!row) return null

  return {
    projectId: String(row.project_id),
    outputBlobUrl: String(row.output_blob_url),
  }
}
