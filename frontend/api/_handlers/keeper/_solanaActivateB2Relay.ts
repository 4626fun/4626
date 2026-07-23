/**
 * POST /api/keeper/solana/activate-b2-relay
 *
 * Explicit, default-off production gate. It enables one persisted creator mint
 * only after all documented B2 evidence and a human approval reference are
 * supplied. It does not flip infrastructure environment flags.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  getDbForCron,
  handleOptions,
  isDbConfigured,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'

import {
  markSolanaCreatorRelayEnabled,
  type SolanaB2ActivationEvidence,
} from '../../../server/_lib/onchain/solanaCreatorRelayConfig.js'

function activationEnabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    String(process.env.SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED ?? '').trim().toLowerCase(),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  if (!requireKeeprApiKey(req, res)) return
  if (!activationEnabled()) {
    return res.status(503).json({ success: false, error: 'b2_production_activation_disabled' } satisfies ApiEnvelope<never>)
  }
  if (!isDbConfigured()) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  const db = await getDbForCron()
  if (!db) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 12_000 })
  const shareMeshMint = body && typeof body.shareMeshMint === 'string' ? body.shareMeshMint.trim() : ''
  const evidence = body?.evidence as SolanaB2ActivationEvidence | undefined
  if (!shareMeshMint || !evidence || typeof evidence !== 'object') {
    return res.status(400).json({ success: false, error: 'shareMeshMint_and_evidence_required' } satisfies ApiEnvelope<never>)
  }

  try {
    const row = await markSolanaCreatorRelayEnabled({ db: db as any, shareMeshMint, evidence })
    if (!row) return res.status(409).json({ success: false, error: 'b2_readiness_not_verified' } satisfies ApiEnvelope<never>)
    console.warn('[keeper/solana/activate-b2-relay]', {
      shareMeshMint,
      approvalRef: evidence.approvalRef,
      relayEnabled: row.relayEnabled,
    })
    return res.status(200).json({ success: true, data: row } satisfies ApiEnvelope<typeof row>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(409).json({ success: false, error: message.slice(0, 300) } satisfies ApiEnvelope<never>)
  }
}
