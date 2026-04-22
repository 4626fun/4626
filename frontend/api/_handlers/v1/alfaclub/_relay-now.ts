/**
 * POST /api/v1/alfaclub/relay-now
 *
 * Admin-only escape valve that invokes one feedback-relayer tick
 * synchronously. Useful for verifying Privy owner-context resolution
 * (dry-run mode) and forcing a submission without waiting for the
 * Railway-side setInterval.
 *
 * Note: this endpoint runs in the Vercel process. For it to actually
 * submit (non-dry-run), the Privy env vars must be configured on Vercel
 * too (`XMTP_AGENT_PRIVY_WALLET_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
 * `PRIVY_WALLET_AUTHORIZATION_KEY`, `CDP_PAYMASTER_URL`). By default we
 * expect the relayer to live on Railway and this endpoint to be used
 * primarily in `dryRun: true` mode from the admin UI.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  handleOptions,
  getSessionAddress,
  isAdminAddress,
} from '../../../../packages/server-core/src/index.js'

import { relayAlfaClubFeedbackOnce } from '../../../../server/_lib/alfaclub/feedbackRelayer.js'
import { SCORECARD_DISCLAIMER } from '../../../../server/_lib/alfaclub/scorecard.js'

type RelayNowRequest = {
  /** If true, skip the actual UserOp send — exercises preflight only. */
  dryRun?: boolean
  /** Optional override for the per-tick cap. Clamped [1, 10]. */
  maxPerTick?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-relay-now', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 2_048 })) as RelayNowRequest
  const dryRun = Boolean(body?.dryRun)
  const rawMax = typeof body?.maxPerTick === 'number' ? body.maxPerTick : 1
  const maxPerTick = Math.max(1, Math.min(10, Math.floor(Number.isFinite(rawMax) ? rawMax : 1)))

  try {
    const result = await relayAlfaClubFeedbackOnce({ dryRun, maxPerTick })
    return res.status(200).json({
      success: true,
      disclaimer: SCORECARD_DISCLAIMER,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
