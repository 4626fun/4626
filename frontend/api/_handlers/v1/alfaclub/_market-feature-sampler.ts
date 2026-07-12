/**
 * GET/POST /api/v1/alfaclub/market-feature-sampler
 *
 * Cron-secret-gated continuous HL feature snapshot sampler for InverseAKITA.
 * Public Hyperliquid reads + scoped telemetry writes only.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { isCronSecretAuthorized, readConfiguredCronSecret } from '../../../../server/_lib/alfaclub/alfaclubCronAuth.js'
import { ingestMarketFeatureSnapshots } from '../../../../server/_lib/alfaclub/marketState/ingestSampler.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!readConfiguredCronSecret()) {
    return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured' })
  }
  if (!isCronSecretAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-market-feature-sampler', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const data = await ingestMarketFeatureSnapshots()
    return res.status(200).json({ success: true, reason: null, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
