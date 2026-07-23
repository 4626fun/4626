/** POST /api/keeper/solana/authorize-b2-canary — exact, one-shot, default-off authorization. */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, getDbForCron, handleOptions, isDbConfigured, readBoundedJsonObjectBody, requireKeeprApiKey, setCors, setNoStore } from '@4626/server-core'

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env.SOLANA_B2_CANARY_AUTHORIZATION_ENABLED ?? '').trim().toLowerCase())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res); setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  if (!requireKeeprApiKey(req, res)) return
  if (!enabled()) return res.status(503).json({ success: false, error: 'b2_canary_authorization_disabled' } satisfies ApiEnvelope<never>)
  if (!isDbConfigured()) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  const body = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  const sourceEventId = typeof body?.sourceEventId === 'string' ? body.sourceEventId.trim() : ''
  const shareMeshMint = typeof body?.shareMeshMint === 'string' ? body.shareMeshMint.trim() : ''
  const approvalRef = typeof body?.approvalRef === 'string' ? body.approvalRef.trim() : ''
  const rawTtlMinutes = body?.ttlMinutes
  const ttlMinutes = rawTtlMinutes === undefined
    ? 30
    : typeof rawTtlMinutes === 'number' && Number.isInteger(rawTtlMinutes)
    ? rawTtlMinutes
    : 0
  if (!sourceEventId || !shareMeshMint || approvalRef.length < 8 || approvalRef.length > 200 || ttlMinutes < 1 || ttlMinutes > 60) {
    return res.status(400).json({ success: false, error: 'invalid_b2_canary_authorization' } satisfies ApiEnvelope<never>)
  }
  const db = await getDbForCron()
  if (!db) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  const result = await (db as any).sql`
    INSERT INTO solana_b2_canary_authorizations (source_event_id, share_mesh_mint, approval_ref, expires_at)
    SELECT inbox.source_event_id, inbox.creator_mint, ${approvalRef}, NOW() + (${ttlMinutes} * INTERVAL '1 minute')
    FROM solana_lottery_entry_inbox inbox
    JOIN solana_creator_relay_config relay ON relay.share_mesh_mint = inbox.creator_mint
    WHERE inbox.source_event_id = ${sourceEventId}
      AND inbox.creator_mint = ${shareMeshMint}
      AND inbox.instruction_kind = 'buy_path'
      AND inbox.status = 'pending'
      AND relay.readiness_status = 'verified'
      AND relay.relay_enabled = FALSE
    ON CONFLICT (source_event_id) DO UPDATE SET
      share_mesh_mint = EXCLUDED.share_mesh_mint,
      approval_ref = EXCLUDED.approval_ref,
      status = 'authorized',
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    WHERE solana_b2_canary_authorizations.status IN ('revoked', 'expired')
       OR (
         solana_b2_canary_authorizations.status = 'authorized'
         AND solana_b2_canary_authorizations.expires_at <= NOW()
       )
    RETURNING id, source_event_id, share_mesh_mint, approval_ref, expires_at
  `
  const row = result.rows?.[0]
  if (!row) return res.status(409).json({ success: false, error: 'b2_canary_authorization_not_created' } satisfies ApiEnvelope<never>)
  return res.status(201).json({ success: true, data: row } satisfies ApiEnvelope<typeof row>)
}
