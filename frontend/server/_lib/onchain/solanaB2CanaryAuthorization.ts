type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function canaryAuthorizationEnabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    String(process.env.SOLANA_B2_CANARY_AUTHORIZATION_ENABLED ?? '').trim().toLowerCase(),
  )
}

/** Atomically consume one exact, unexpired canary authorization. */
export async function consumeSolanaB2CanaryAuthorization(params: {
  db: Db
  sourceEventId: string
  shareMeshMint: string
}): Promise<boolean> {
  if (!canaryAuthorizationEnabled()) return false
  const sourceEventId = params.sourceEventId.trim()
  const shareMeshMint = params.shareMeshMint.trim()
  if (!sourceEventId || !shareMeshMint) return false
  const result = await params.db.sql`
    UPDATE solana_b2_canary_authorizations
    SET status = 'consumed', consumed_at = NOW(), updated_at = NOW()
    WHERE source_event_id = ${sourceEventId}
      AND share_mesh_mint = ${shareMeshMint}
      AND status = 'authorized'
      AND expires_at > NOW()
    RETURNING id
  `
  return result.rows.length === 1
}
