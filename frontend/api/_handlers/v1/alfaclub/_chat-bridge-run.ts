/**
 * POST /api/v1/alfaclub/chat-bridge-run
 *
 * Cron-secret-gated entry point for running exactly one AlfaClub chat bridge
 * tick inside Vercel serverless runtime.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { runAlfaClubChatBridgeTickOnce } from '../../../../server/_lib/alfaclub/chatBridge.js'

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
    rateLimitKey('alfaclub-chat-bridge-run', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const result = await runAlfaClubChatBridgeTickOnce()
    if (!result.ok) {
      const status = result.reason === 'kill_switch' ? 503 : 202
      return res.status(status).json({
        success: false,
        reason: result.reason,
        data: {
          intervalMs: result.intervalMs,
          roomId: result.roomId,
        },
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        intervalMs: result.intervalMs,
        roomId: result.roomId,
        tick: result.data,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
