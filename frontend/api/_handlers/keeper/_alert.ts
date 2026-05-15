/**
 * POST /api/keeper/alert
 *
 * Receives alerts from keeper workflows and forwards them to the console and
 * optional webhook alerting target.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

type AlertSeverity = 'info' | 'warning' | 'critical'

interface AlertPayload {
  vaultAddress?: string
  alertType: string
  severity: AlertSeverity
  message: string
  details?: Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-alert', getClientIp(req)),
    RATE_LIMITS.creRuntimeTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as AlertPayload | null
  if (!body?.alertType || !body?.severity || !body?.message) {
    return res.status(400).json({
      success: false,
      error: 'Must provide alertType, severity, and message',
    } satisfies ApiEnvelope<never>)
  }

  const { vaultAddress, alertType, severity, message, details } = body

  const logPrefix = `[keeper/alert][${severity.toUpperCase()}][${alertType}]`
  const logMsg = vaultAddress
    ? `${logPrefix} ${vaultAddress}: ${message}`
    : `${logPrefix} ${message}`

  switch (severity) {
    case 'critical':
      console.error(logMsg, details ?? '')
      break
    case 'warning':
      console.warn(logMsg, details ?? '')
      break
    default:
      console.log(logMsg, details ?? '')
  }

  const webhookUrl = process.env.KPR_ALERT_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'keeper-workflow',
          alertType,
          severity,
          vaultAddress,
          message,
          details,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      })
    } catch (err) {
      console.warn('[keeper/alert] Failed to forward to webhook:', err)
    }
  }

  return res.status(200).json({
    success: true,
    data: { received: true },
  } satisfies ApiEnvelope<{ received: boolean }>)
}
