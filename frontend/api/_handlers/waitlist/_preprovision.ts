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
import { getDb, isDbConfigured } from '../../../server/_lib/postgres.js'
import { checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { readRequestPrincipalAddress, resolveAuthorizedRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
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

  const clientIp = getClientIp(req)

  // Require authenticated session or SIWA
  const principalWallet = readRequestPrincipalAddress(req)
  if (!principalWallet || !isValidEvmAddress(principalWallet)) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  const rateLimit = checkRateLimit(
    rateLimitKey('waitlist-preprovision', clientIp, principalWallet.toLowerCase()),
    { windowMs: 60_000, maxRequests: 10 },
  )
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database connection failed' } satisfies ApiEnvelope<never>)
  }

  try {
    const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
    if (!authorizedPrincipal) {
      return res.status(404).json({ success: false, error: 'No waitlist profile found for this wallet' } satisfies ApiEnvelope<never>)
    }

    const q = await (db as any).sql`
      SELECT id, primary_wallet, embedded_wallet, csw_address, primary_smart_wallet, base_sub_account, preprovisioned_at
      FROM profiles
      WHERE id = ${authorizedPrincipal.profileId}
      LIMIT 1;
    `
    const row = q.rows?.[0]

    if (!row?.id) {
      return res.status(404).json({ success: false, error: 'No waitlist profile found for this wallet' } satisfies ApiEnvelope<never>)
    }

    const walletForProvisionCandidate = String(
      authorizedPrincipal.canonicalSmartWalletAddress ||
        row.csw_address ||
        row.primary_smart_wallet ||
        row.base_sub_account ||
        row.primary_wallet ||
        row.embedded_wallet ||
        principalWallet
    ).toLowerCase()
    const walletForProvision = isValidEvmAddress(walletForProvisionCandidate)
      ? walletForProvisionCandidate
      : principalWallet.toLowerCase()
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
