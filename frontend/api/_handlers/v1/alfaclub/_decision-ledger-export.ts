/**
 * GET /api/v1/alfaclub/decision-ledger-export
 *
 * Cron-secret-gated read-only privacy-safe JSONL export of settled InverseAKITA
 * decisions plus Conditional Inverse Edge claim-gate report.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { isCronSecretAuthorized, readConfiguredCronSecret } from '../../../../server/_lib/alfaclub/alfaclubCronAuth.js'
import { exportSettledDecisionsJsonl } from '../../../../server/_lib/alfaclub/decisions/publicLedgerExport.js'

function readMinSampleForClaims(req: VercelRequest): number | undefined {
  const raw = typeof req.query.minSampleForClaims === 'string' ? req.query.minSampleForClaims : undefined
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return Math.floor(parsed)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!readConfiguredCronSecret()) {
    return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured' })
  }
  if (!isCronSecretAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-decision-ledger-export', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const minSampleForClaims = readMinSampleForClaims(req)
    const data = await exportSettledDecisionsJsonl(
      minSampleForClaims != null ? { minSampleForClaims } : undefined,
    )
    return res.status(200).json({
      success: true,
      reason: null,
      data: {
        rowCount: data.rowCount,
        report: data.report,
        jsonl: data.jsonl,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
