import { PublicKey } from '@solana/web3.js'

import {
  ensureSolanaMeteoraPoolStatusSchema,
  ensureSolanaShareMeshMappingsSchema,
} from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

const METEORA_CUSTOMIZABLE_POOL_BASE = new PublicKey('MFGQxwAmB91SwuYX36okv2Qmdc9aMuHTwWGUrp4AtB1')

/**
 * Derive the customizable permissionless DLMM pair exactly as Meteora's SDK
 * does: ILM base + lexicographically sorted mint keys under the DLMM program.
 * This lets the persistence boundary reject an unrelated pool address even
 * when an upstream process returns HTTP 200.
 */
export function deriveMeteoraCustomizablePoolAddress(params: {
  tokenMintX: string
  tokenMintY: string
  programId: string
}): string {
  const tokenX = new PublicKey(params.tokenMintX)
  const tokenY = new PublicKey(params.tokenMintY)
  const program = new PublicKey(params.programId)
  if (tokenX.equals(tokenY)) throw new Error('meteora_pool_mints_must_be_distinct')
  const [minMint, maxMint] = tokenX.toBuffer().compare(tokenY.toBuffer()) < 0
    ? [tokenX, tokenY]
    : [tokenY, tokenX]
  return PublicKey.findProgramAddressSync(
    [METEORA_CUSTOMIZABLE_POOL_BASE.toBuffer(), minMint.toBuffer(), maxMint.toBuffer()],
    program,
  )[0].toBase58()
}

export type SolanaMeteoraPoolStatusRow = {
  id: number
  creatorToken: string
  shareOft: string | null
  shareMeshMint: string
  quoteMint: string
  poolAddress: string | null
  status: 'pending' | 'creating' | 'created' | 'failed' | 'skipped'
  provisionAttemptCount: number
  lastSignature: string | null
  lastError: string | null
  sourceSessionId: string | null
  updatedAt: string
}

function mapRow(row: any): SolanaMeteoraPoolStatusRow {
  return {
    id: Number(row.id),
    creatorToken: String(row.creator_token ?? ''),
    shareOft: row.share_oft ? String(row.share_oft) : null,
    shareMeshMint: String(row.share_mesh_mint ?? ''),
    quoteMint: String(row.quote_mint ?? ''),
    poolAddress: row.pool_address ? String(row.pool_address) : null,
    status: String(row.status ?? 'pending') as SolanaMeteoraPoolStatusRow['status'],
    provisionAttemptCount: Number(row.provision_attempt_count ?? 0),
    lastSignature: row.last_signature ? String(row.last_signature) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

export async function readSolanaMeteoraPoolStatusByShareMeshMint(params: {
  db: Db
  shareMeshMint: string
  quoteMint?: string | null
}): Promise<SolanaMeteoraPoolStatusRow | null> {
  await ensureSolanaMeteoraPoolStatusSchema(params.db)
  const shareMeshMint = String(params.shareMeshMint ?? '').trim()
  if (!shareMeshMint) return null
  const quoteMint = String(params.quoteMint ?? '').trim()
  const result = quoteMint
    ? await params.db.sql`
        SELECT *
        FROM solana_meteora_pool_status
        WHERE share_mesh_mint = ${shareMeshMint}
          AND quote_mint = ${quoteMint}
        ORDER BY updated_at DESC
        LIMIT 1;
      `
    : await params.db.sql`
        SELECT *
        FROM solana_meteora_pool_status
        WHERE share_mesh_mint = ${shareMeshMint}
        ORDER BY updated_at DESC
        LIMIT 1;
      `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

/** Persist finalized pool readback drift only from the opt-in evidence path. */
export async function reconcileSolanaMeteoraPoolStatus(params: {
  db: Db
  shareMeshMint: string
  status: 'created' | 'failed'
  lastError?: string | null
}): Promise<SolanaMeteoraPoolStatusRow | null> {
  await ensureSolanaMeteoraPoolStatusSchema(params.db)
  const shareMeshMint = String(params.shareMeshMint ?? '').trim()
  if (!shareMeshMint) return null
  const result = await params.db.sql`
    UPDATE solana_meteora_pool_status
    SET
      status = ${params.status},
      last_error = ${params.lastError ?? null},
      updated_at = NOW()
    WHERE share_mesh_mint = ${shareMeshMint}
    RETURNING *;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function readSolanaShareMeshMappingBySessionId(params: {
  db: Db
  sessionId: string
}): Promise<{
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  status: string
  lastError: string | null
} | null> {
  await ensureSolanaShareMeshMappingsSchema(params.db)
  const sessionId = String(params.sessionId ?? '').trim()
  if (!sessionId) return null
  const result = await params.db.sql`
    SELECT creator_token, share_oft, share_mesh_mint, status, last_error
    FROM solana_share_mesh_mappings
    WHERE source_session_id = ${sessionId}
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  if (!row) return null
  return {
    creatorToken: String(row.creator_token ?? ''),
    shareOft: String(row.share_oft ?? ''),
    shareMeshMint: String(row.share_mesh_mint ?? ''),
    status: String(row.status ?? 'pending'),
    lastError: row.last_error ? String(row.last_error) : null,
  }
}
