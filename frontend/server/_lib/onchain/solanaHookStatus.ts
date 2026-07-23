import { ensureSolanaHookStatusSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaHookStatusRow = {
  id: number
  creatorToken: string
  shareOft: string | null
  hookMint: string | null
  creatorConfig: string | null
  pendingEntries: string | null
  winnerRecord: string | null
  status: 'pending' | 'creating' | 'created' | 'failed' | 'skipped'
  provisionAttemptCount: number
  lastError: string | null
  sourceSessionId: string | null
  updatedAt: string
}

function mapRow(row: any): SolanaHookStatusRow {
  return {
    id: Number(row.id),
    creatorToken: String(row.creator_token ?? ''),
    shareOft: row.share_oft ? String(row.share_oft) : null,
    hookMint: row.hook_mint ? String(row.hook_mint) : null,
    creatorConfig: row.creator_config ? String(row.creator_config) : null,
    pendingEntries: row.pending_entries ? String(row.pending_entries) : null,
    winnerRecord: row.winner_record ? String(row.winner_record) : null,
    status: String(row.status ?? 'pending') as SolanaHookStatusRow['status'],
    provisionAttemptCount: Number(row.provision_attempt_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

export async function readSolanaHookStatusByCreatorToken(params: {
  db: Db
  creatorToken: string
}): Promise<SolanaHookStatusRow | null> {
  await ensureSolanaHookStatusSchema(params.db)
  const creatorToken = String(params.creatorToken ?? '').trim().toLowerCase()
  if (!creatorToken) return null
  const result = await params.db.sql`
    SELECT *
    FROM solana_hook_status
    WHERE creator_token = ${creatorToken}
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

/**
 * Persist a finalized readback result without creating a new provisioning
 * record. This is intentionally called only from the opt-in readiness
 * evidence path; the default verifier remains read-only.
 */
export async function reconcileSolanaHookStatus(params: {
  db: Db
  creatorToken: string
  shareOft?: string | null
  hookMint?: string | null
  creatorConfig?: string | null
  pendingEntries?: string | null
  winnerRecord?: string | null
  status: 'created' | 'failed'
  lastError?: string | null
  sourceSessionId?: string | null
}): Promise<SolanaHookStatusRow | null> {
  await ensureSolanaHookStatusSchema(params.db)
  const creatorToken = String(params.creatorToken ?? '').trim().toLowerCase()
  if (!creatorToken) return null
  const result = await params.db.sql`
    INSERT INTO solana_hook_status (
      creator_token,
      share_oft,
      hook_mint,
      creator_config,
      pending_entries,
      winner_record,
      status,
      provision_attempt_count,
      last_error,
      source_session_id,
      updated_at
    ) VALUES (
      ${creatorToken},
      ${params.shareOft ?? null},
      ${params.hookMint ?? null},
      ${params.creatorConfig ?? null},
      ${params.pendingEntries ?? null},
      ${params.winnerRecord ?? null},
      ${params.status},
      0,
      ${params.lastError ?? null},
      ${params.sourceSessionId ?? null},
      NOW()
    )
    ON CONFLICT (creator_token)
    DO UPDATE SET
      share_oft = COALESCE(EXCLUDED.share_oft, solana_hook_status.share_oft),
      hook_mint = COALESCE(EXCLUDED.hook_mint, solana_hook_status.hook_mint),
      creator_config = COALESCE(EXCLUDED.creator_config, solana_hook_status.creator_config),
      pending_entries = COALESCE(EXCLUDED.pending_entries, solana_hook_status.pending_entries),
      winner_record = COALESCE(EXCLUDED.winner_record, solana_hook_status.winner_record),
      status = EXCLUDED.status,
      last_error = EXCLUDED.last_error,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_hook_status.source_session_id),
      updated_at = NOW()
    RETURNING *;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}
