/**
 * POST /api/waitlist/preprovision
 *
 * Manually trigger (or re-trigger) pre-provisioning for a waitlist user.
 * Requires authenticated session or SIWA — uses the caller's wallet address.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { isCswOwner } from '../../../server/_lib/cswOwner.js'
import { getDb, isDbConfigured } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
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

  // Require authenticated session or SIWA
  const principalWallet = readRequestPrincipalAddress(req)
  if (!principalWallet || !isValidEvmAddress(principalWallet)) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database connection failed' } satisfies ApiEnvelope<never>)
  }

  // Find the user's waitlist profile by wallet (match any linked wallet field)
  try {
    const q = await (db as any).sql`
      SELECT id, primary_wallet, embedded_wallet, csw_address, preprovisioned_at
      FROM profiles
      WHERE LOWER(primary_wallet) = ${principalWallet}
         OR LOWER(embedded_wallet) = ${principalWallet}
         OR LOWER(csw_address) = ${principalWallet}
      ORDER BY created_at DESC
      LIMIT 1;
    `
    let row = q.rows?.[0]

    // If no direct match, check if principal wallet is an owner of a profile's linked CSW
    if (!row?.id) {
      const cswProfiles = await (db as any).sql`
        SELECT id, primary_wallet, embedded_wallet, csw_address, preprovisioned_at
        FROM profiles
        WHERE csw_address IS NOT NULL
          AND LOWER(csw_address) != ${principalWallet}
        ORDER BY updated_at DESC
        LIMIT 50
      `
      for (const p of cswProfiles?.rows ?? []) {
        const csw = p?.csw_address ? String(p.csw_address).trim() : ''
        if (!csw || !/^0x[a-fA-F0-9]{40}$/.test(csw)) continue
        try {
          const owned = await isCswOwner(principalWallet, csw)
          if (owned) {
            row = p
            break
          }
        } catch {
          continue
        }
      }
    }

    if (!row?.id) {
      return res.status(404).json({ success: false, error: 'No waitlist profile found for this wallet' } satisfies ApiEnvelope<never>)
    }

    const walletForProvision = String(
      row.csw_address || row.primary_wallet || row.embedded_wallet || principalWallet
    ).toLowerCase()
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
