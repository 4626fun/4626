/**
 * POST /api/v1/alfaclub/chat-token-refresh
 *
 * Cron-secret-gated entry point that runs exactly one Privy session-refresh
 * pass for the AlfaClub chat bridge in Vercel's serverless runtime. This
 * mirrors the long-lived `startAlfaClubPrivyTokenRefresher` loop that runs
 * inside the Railway agent — Vercel cron invokes this every ~30 minutes so
 * the user can retire the Railway-only refresher without losing automatic
 * identity-token rotation.
 *
 * The handler delegates to `runAlfaClubPrivyRefreshOnce` (one-shot) and
 * never returns raw token material; only refresh status, fingerprintable
 * metadata, and the new identity-token expiry timestamp are surfaced.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { runAlfaClubPrivyRefreshOnce } from '../../../../server/_lib/alfaclub/privyTokenRefresher.js'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const configuredSecret = (process.env.CRON_SECRET ?? '').trim()
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
    rateLimitKey('alfaclub-chat-token-refresh', getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    // Always force a refresh on the cron path. Vercel only invokes us every
    // ~30 minutes, well below the access-token TTL, so there is no risk of
    // burning rate budget — and skipping based on the identity-token's
    // remaining lifetime would mean a missed cron tick (cold start, transient
    // 5xx, etc.) could push the next refresh past the 1-hour cliff.
    const outcome = await runAlfaClubPrivyRefreshOnce({}, { force: true })

    if (outcome.status === 'refreshed') {
      return res.status(200).json({
        success: true,
        data: {
          status: 'refreshed',
          identityTokenExp: outcome.identityTokenExp
            ? new Date(outcome.identityTokenExp).toISOString()
            : null,
        },
      })
    }

    if (outcome.status === 'missing_tokens') {
      return res.status(503).json({
        success: false,
        reason: 'missing_tokens',
        data: { missing: outcome.missing },
      })
    }

    if (outcome.status === 'error') {
      // Token refresh failed against Privy (e.g. expired refresh token, network
      // blip). Surface as 502 so cron monitoring can distinguish "Privy said
      // no" from "we are misconfigured" (503). Error string already redacted
      // by the refresher (no token material in the message body).
      return res.status(502).json({
        success: false,
        reason: 'refresh_failed',
        error: outcome.error.slice(0, 256),
      })
    }

    // `not_due` is unreachable because we forced above, but keep a safe branch
    // so a future refactor that drops `force` doesn't fall through to 200.
    return res.status(202).json({
      success: false,
      reason: outcome.status,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
