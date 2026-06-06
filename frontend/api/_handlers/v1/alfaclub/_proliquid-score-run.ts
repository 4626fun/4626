/**
 * GET/POST /api/v1/alfaclub/proliquid-score-run
 *
 * CRON-secret-gated assistive scorer for ProLiquid Telegram signals.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { runProliquidSignalScoring } from '../../../../server/_lib/alfaclub/proliquidSignals.js'

declare const process: { env: Record<string, string | undefined> }

function readCronSecret(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return String(header[0] ?? '')
  if (typeof header === 'string' && header.trim().length > 0) return header.trim()

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function readConfiguredCronSecret(): string {
  return (process.env.CRON_SECRET ?? '').trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = readConfiguredCronSecret()
  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: 'CRON_SECRET is not configured',
    })
  }

  const providedSecret = readCronSecret(req)
  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-proliquid-score-run', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const result = await runProliquidSignalScoring()
    const status = result.ok ? 200 : result.reason === 'disabled' ? 503 : 202
    return res.status(status).json({
      success: result.ok,
      reason: result.reason ?? null,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
