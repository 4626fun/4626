import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '@4626/server-core'
import { runCounterTradeLoop } from '../../../../server/_lib/alfaclub/counterTradeRunner.js'

declare const process: { env: Record<string, string | undefined> }

function readCronSecret(req: VercelRequest): string {
  const header = req.headers['x-cron-secret']
  if (Array.isArray(header)) return String(header[0] ?? '')
  if (typeof header === 'string' && header.trim()) return header.trim()
  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const match = auth.match(/^Bearer\s+(.+)$/i)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configured = String(process.env.CRON_SECRET ?? '').trim()
  if (!configured) {
    return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured' })
  }
  const provided = readCronSecret(req)
  if (!provided || provided !== configured) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-counter-trade-run', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const result = await runCounterTradeLoop()
    return res.status(result.ok ? 200 : 202).json({
      success: result.ok,
      reason: result.reason ?? null,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}

