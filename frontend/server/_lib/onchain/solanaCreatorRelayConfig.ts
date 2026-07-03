import { ensureSolanaCreatorRelayConfigSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaCreatorRelayReadinessStatus = 'pending' | 'verified' | 'failed'

export type SolanaCreatorRelayConfigRow = {
  id: number
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  relayEnabled: boolean
  readinessStatus: SolanaCreatorRelayReadinessStatus
  readinessChecksJson: unknown
  b2VerifiedAt: string | null
  relayEnabledAt: string | null
  lastError: string | null
  sourceSessionId: string | null
  updatedAt: string
}

function mapRow(row: any): SolanaCreatorRelayConfigRow {
  return {
    id: Number(row.id),
    creatorToken: String(row.creator_token ?? ''),
    shareOft: String(row.share_oft ?? ''),
    shareMeshMint: String(row.share_mesh_mint ?? ''),
    relayEnabled: Boolean(row.relay_enabled),
    readinessStatus: String(row.readiness_status ?? 'pending') as SolanaCreatorRelayReadinessStatus,
    readinessChecksJson: row.readiness_checks_json ?? null,
    b2VerifiedAt: row.b2_verified_at ? new Date(row.b2_verified_at).toISOString() : null,
    relayEnabledAt: row.relay_enabled_at ? new Date(row.relay_enabled_at).toISOString() : null,
    lastError: row.last_error ? String(row.last_error) : null,
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

export async function readSolanaCreatorRelayConfigByShareMeshMint(params: {
  db: Db
  shareMeshMint: string
}): Promise<SolanaCreatorRelayConfigRow | null> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const shareMeshMint = String(params.shareMeshMint ?? '').trim()
  if (!shareMeshMint) return null
  const result = await params.db.sql`
    SELECT *
    FROM solana_creator_relay_config
    WHERE share_mesh_mint = ${shareMeshMint}
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function readSolanaCreatorRelayConfigByCreatorToken(params: {
  db: Db
  creatorToken: string
}): Promise<SolanaCreatorRelayConfigRow | null> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const creatorToken = String(params.creatorToken ?? '').trim().toLowerCase()
  if (!creatorToken) return null
  const result = await params.db.sql`
    SELECT *
    FROM solana_creator_relay_config
    WHERE creator_token = ${creatorToken}
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function listRelayEnabledShareMeshMints(params: { db: Db }): Promise<string[]> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const result = await params.db.sql`
    SELECT share_mesh_mint
    FROM solana_creator_relay_config
    WHERE relay_enabled = TRUE
    ORDER BY share_mesh_mint ASC;
  `
  return (result.rows ?? [])
    .map((row) => String(row.share_mesh_mint ?? '').trim())
    .filter((mint) => mint.length > 0)
}

export async function upsertSolanaCreatorRelayReadiness(params: {
  db: Db
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  readinessStatus: SolanaCreatorRelayReadinessStatus
  readinessChecksJson: unknown
  lastError?: string | null
  sourceSessionId?: string | null
}): Promise<SolanaCreatorRelayConfigRow> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const creatorToken = params.creatorToken.trim().toLowerCase()
  const shareOft = params.shareOft.trim().toLowerCase()
  const shareMeshMint = params.shareMeshMint.trim()
  const b2VerifiedAt = params.readinessStatus === 'verified' ? new Date().toISOString() : null
  const result = await params.db.sql`
    INSERT INTO solana_creator_relay_config (
      creator_token,
      share_oft,
      share_mesh_mint,
      relay_enabled,
      readiness_status,
      readiness_checks_json,
      b2_verified_at,
      last_error,
      source_session_id,
      updated_at
    ) VALUES (
      ${creatorToken},
      ${shareOft},
      ${shareMeshMint},
      FALSE,
      ${params.readinessStatus},
      ${JSON.stringify(params.readinessChecksJson ?? null)}::jsonb,
      ${b2VerifiedAt},
      ${params.lastError ?? null},
      ${params.sourceSessionId ?? null},
      NOW()
    )
    ON CONFLICT (share_mesh_mint)
    DO UPDATE SET
      creator_token = EXCLUDED.creator_token,
      share_oft = EXCLUDED.share_oft,
      readiness_status = EXCLUDED.readiness_status,
      readiness_checks_json = EXCLUDED.readiness_checks_json,
      b2_verified_at = COALESCE(EXCLUDED.b2_verified_at, solana_creator_relay_config.b2_verified_at),
      last_error = EXCLUDED.last_error,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_creator_relay_config.source_session_id),
      updated_at = NOW()
    RETURNING *;
  `
  return mapRow((result.rows ?? [])[0])
}

export async function markSolanaCreatorRelayEnabled(params: {
  db: Db
  shareMeshMint: string
}): Promise<SolanaCreatorRelayConfigRow | null> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const shareMeshMint = params.shareMeshMint.trim()
  if (!shareMeshMint) return null
  const result = await params.db.sql`
    UPDATE solana_creator_relay_config
    SET
      relay_enabled = TRUE,
      relay_enabled_at = NOW(),
      updated_at = NOW()
    WHERE share_mesh_mint = ${shareMeshMint}
      AND readiness_status = 'verified'
    RETURNING *;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}
