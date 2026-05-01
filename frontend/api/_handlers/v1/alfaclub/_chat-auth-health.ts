/**
 * GET /api/v1/alfaclub/chat-auth-health
 *
 * Cron-secret-gated read-only endpoint that exposes redacted AlfaClub auth
 * health metadata. The body NEVER contains token material — only:
 *   - last refresh success: when, identity-token expiry, writer name,
 *     whether the refresh token rotated.
 *   - last refresh failure: when, classified error code, redacted detail.
 *   - live `chat_jwt` row metadata: writer, expiry, minutes-until-expiry,
 *     and a flag indicating whether the writer matches the single-writer
 *     invariant (see `evaluateWriterAnomaly` in `authHealthStore.ts`).
 *
 * Recommended monitoring thresholds (also in
 * `docs/operations/alfaclub-auth-hardening.md`):
 *
 *   - `liveChatJwt.minutesUntilExpiry < 20`     → page (refresh probably stalled)
 *   - `lastFailure.at` newer than `lastSuccess.at` → page
 *   - `liveChatJwt.writerAnomaly.isAnomalous`   → page (a non-canonical writer
 *                                                  overwrote the slot)
 *   - `liveChatJwt.minutesUntilExpiry < 5`      → wake oncall
 *
 * Auth: same `CRON_SECRET` header / Authorization: Bearer pattern as the
 * existing `chat-token-refresh` endpoint. Not exposed to the public web.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import {
  readAlfaClubChatToken,
} from '../../../../server/_lib/alfaclub/chatTokenStore.js'
import {
  readAuthHealthSnapshot,
} from '../../../../server/_lib/alfaclub/authHealthStore.js'

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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
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
    rateLimitKey('alfaclub-chat-auth-health', getClientIp(req)),
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
    // Fetch the chat_jwt row directly so we can populate the live snapshot
    // without leaking the token material through the response. The
    // `readAlfaClubChatToken` reader returns the JWT in `jwt`; we hand only
    // its expiry-derivable metadata to the snapshotter, never the raw value
    // back to the client.
    const liveTokenRecord = await readAlfaClubChatToken().catch(() => null)
    const liveChatJwt = liveTokenRecord
      ? {
          jwt: null, // intentionally not passed downstream — never echo the token
          updatedAt: liveTokenRecord.updatedAt,
          updatedBy: liveTokenRecord.updatedBy,
          expiresAtIso: liveTokenRecord.expiresAt,
        }
      : null

    const snapshot = await readAuthHealthSnapshot({ liveChatJwt })

    return res.status(200).json({
      success: true,
      data: snapshot,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
