import { ensureSolanaShareMeshMappingsSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type SolanaShareMeshMappingStatus = 'pending' | 'applied' | 'failed'

export type SolanaShareMeshMapping = {
  id: number
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  sourceSessionId: string | null
  status: SolanaShareMeshMappingStatus
  applyAttemptCount: number
  lastError: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
}

function isHexAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
}

function normalizeEthAddress(value: unknown, field: string): string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!isHexAddress(s)) throw new Error(`invalid_${field}`)
  return s.toLowerCase()
}

function normalizeSolanaMint(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!isSolanaAddress(s)) throw new Error('invalid_share_mesh_mint')
  return s
}

function normalizeSessionId(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length > 0 ? s : null
}

function mapRow(row: any): SolanaShareMeshMapping {
  return {
    id: Number(row.id),
    creatorToken: String(row.creator_token ?? ''),
    shareOft: String(row.share_oft ?? ''),
    shareMeshMint: String(row.share_mesh_mint ?? ''),
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    status: String(row.status ?? 'pending') as SolanaShareMeshMappingStatus,
    applyAttemptCount: Number(row.apply_attempt_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
    createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

export async function upsertSolanaShareMeshMapping(params: {
  db: Db
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  sourceSessionId?: string | null
}): Promise<SolanaShareMeshMapping> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const creatorToken = normalizeEthAddress(params.creatorToken, 'creator_token')
  const shareOft = normalizeEthAddress(params.shareOft, 'share_oft')
  const shareMeshMint = normalizeSolanaMint(params.shareMeshMint)
  const sourceSessionId = normalizeSessionId(params.sourceSessionId)

  const result = await params.db.sql`
    INSERT INTO solana_share_mesh_mappings (
      creator_token,
      share_oft,
      share_mesh_mint,
      source_session_id,
      status,
      updated_at
    ) VALUES (
      ${creatorToken},
      ${shareOft},
      ${shareMeshMint},
      ${sourceSessionId},
      'pending',
      NOW()
    )
    ON CONFLICT (LOWER(share_oft))
    DO UPDATE SET
      creator_token = EXCLUDED.creator_token,
      share_mesh_mint = EXCLUDED.share_mesh_mint,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_share_mesh_mappings.source_session_id),
      status = 'pending',
      updated_at = NOW()
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('solana_share_mesh_mapping_upsert_failed')
  return mapRow(row)
}

export async function listPendingSolanaShareMeshMappings(params: {
  db: Db
  limit?: number
}): Promise<SolanaShareMeshMapping[]> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const limit = Math.max(1, Math.min(Number(params.limit ?? 25), 100))
  const result = await params.db.sql`
    SELECT *
    FROM solana_share_mesh_mappings
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapRow)
}

export async function listSolanaShareMeshMappingsForCreator(params: {
  db: Db
  creatorToken: string
  limit?: number
}): Promise<SolanaShareMeshMapping[]> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const creatorToken = normalizeEthAddress(params.creatorToken, 'creator_token')
  const limit = Math.max(1, Math.min(Number(params.limit ?? 10), 50))
  const result = await params.db.sql`
    SELECT *
    FROM solana_share_mesh_mappings
    WHERE LOWER(creator_token) = ${creatorToken}
    ORDER BY
      CASE status WHEN 'applied' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT ${limit};
  `
  return (result.rows ?? []).map(mapRow)
}

export async function markSolanaShareMeshMappingApplied(params: {
  db: Db
  shareOft: string
}): Promise<void> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const shareOft = normalizeEthAddress(params.shareOft, 'share_oft')
  await params.db.sql`
    UPDATE solana_share_mesh_mappings
    SET
      status = 'applied',
      applied_at = NOW(),
      last_error = NULL,
      apply_attempt_count = apply_attempt_count + 1,
      updated_at = NOW()
    WHERE LOWER(share_oft) = LOWER(${shareOft});
  `
}

export async function markSolanaShareMeshMappingFailed(params: {
  db: Db
  shareOft: string
  error: string
}): Promise<void> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const shareOft = normalizeEthAddress(params.shareOft, 'share_oft')
  const error = String(params.error ?? '').trim().slice(0, 2000) || 'solana_mapping_apply_failed'
  await params.db.sql`
    UPDATE solana_share_mesh_mappings
    SET
      status = 'failed',
      last_error = ${error},
      apply_attempt_count = apply_attempt_count + 1,
      updated_at = NOW()
    WHERE LOWER(share_oft) = LOWER(${shareOft});
  `
}
