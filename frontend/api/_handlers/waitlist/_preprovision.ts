/**
 * POST /api/waitlist/preprovision
 *
 * Manually trigger (or re-trigger) pre-provisioning for a waitlist user.
 * Requires an authenticated session — uses the caller's wallet address.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readSessionFromRequest,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../server/_lib/postgres.js'
import { preprovisionWaitlistUser } from '../../../server/_lib/waitlistPreprovision.js'

declare const process: { env: Record<string, string | undefined> }

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Require authenticated session
  const session = readSessionFromRequest(req)
  const sessionWallet = session?.address ? String(session.address).trim().toLowerCase() : ''
  if (!sessionWallet || !isValidEvmAddress(sessionWallet)) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database connection failed' } satisfies ApiEnvelope<never>)
  }

  // Find the user's waitlist profile by wallet
  try {
    const q = await (db as any).sql`
      SELECT id, primary_wallet, csw_address, preprovisioned_at
      FROM profiles
      WHERE LOWER(primary_wallet) = ${sessionWallet}
         OR LOWER(csw_address) = ${sessionWallet}
      ORDER BY created_at DESC
      LIMIT 1;
    `
    const row = q.rows?.[0]
    if (!row?.id) {
      return res.status(404).json({ success: false, error: 'No waitlist profile found for this wallet' } satisfies ApiEnvelope<never>)
    }

    const walletForProvision = String(row.csw_address || row.primary_wallet || sessionWallet).toLowerCase()
    const result = await preprovisionWaitlistUser(
      typeof row.id === 'number' ? row.id : Number(row.id),
      walletForProvision,
    )

    return res.status(200).json({
      success: true,
      data: {
        signupId: row.id,
        alreadyProvisioned: result === null,
        ...(result ?? {}),
      },
    } satisfies ApiEnvelope<any>)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Preprovision failed'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
