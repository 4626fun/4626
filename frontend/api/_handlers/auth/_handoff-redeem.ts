import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_SESSION,
  handleOptions,
  makeSessionToken,
  readJsonBody,
  setCookie,
  setCors,
  setNoStore,
  getDb,
  getClientIp,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'

import { consumeHandoffCode, ensureHandoffSchema } from '../../../server/auth/_handoff.js'



type RedeemBody = {
  code?: string
}

// FIX: FINDING-04 — global rate limit on handoff redeem to resist distributed brute-force.
// In-memory Map with TTL; complements the per-IP limit below.
// NOTE: This counter is per-isolate on serverless. Each warm Vercel instance
// has its own copy, so concurrent instances do not share state. The per-IP
// limit is the primary brute-force defense; this global counter is
// defense-in-depth that only works within a single isolate. For true global
// deduplication, move to a durable counter (e.g., Upstash Redis or a DB row
// with TTL). The handoff code has 256-bit entropy, making brute-force
// infeasible regardless.
const GLOBAL_HANDOFF_WINDOW_MS = 60_000
const GLOBAL_HANDOFF_MAX_FAILED = 100
let globalHandoffFailedCount = 0
let globalHandoffWindowResetAt = Date.now() + GLOBAL_HANDOFF_WINDOW_MS

function checkGlobalHandoffRateLimit(): boolean {
  const now = Date.now()
  if (now >= globalHandoffWindowResetAt) {
    globalHandoffFailedCount = 0
    globalHandoffWindowResetAt = now + GLOBAL_HANDOFF_WINDOW_MS
  }
  return globalHandoffFailedCount < GLOBAL_HANDOFF_MAX_FAILED
}

function recordGlobalHandoffFailure(): void {
  const now = Date.now()
  if (now >= globalHandoffWindowResetAt) {
    globalHandoffFailedCount = 0
    globalHandoffWindowResetAt = now + GLOBAL_HANDOFF_WINDOW_MS
  }
  globalHandoffFailedCount++
}

// FIX: FINDING-02 — removed sessionToken and privyToken from response body;
// session is conveyed via HttpOnly cookie only, preventing XSS exfiltration.
type HandoffRedeemResponse = {
  address: string
}
const HANDOFF_REDEEM_MAX_BODY_BYTES = 8_192

function isHandoffCode(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // FIX: FINDING-04 — enforce both per-IP and global rate limits to resist distributed brute-force.
  if (!checkGlobalHandoffRateLimit()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((globalHandoffWindowResetAt - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const ip = getClientIp(req as any)
  const limit = checkRateLimit(rateLimitKey('auth_handoff_redeem', ip), {
    windowMs: 60_000,
    maxRequests: 30,
  })
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<RedeemBody>(req, { maxBytes: HANDOFF_REDEEM_MAX_BODY_BYTES })
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!isHandoffCode(code)) {
    return res.status(400).json({ success: false, error: 'Invalid handoff code' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureHandoffSchema(db as any)
    const consumed = await consumeHandoffCode(db as any, code)
    if (!consumed?.address) {
      // FIX: FINDING-04 — record failed attempt for global rate limit tracking.
      recordGlobalHandoffFailure()
      return res.status(400).json({ success: false, error: 'Invalid or expired handoff code' } satisfies ApiEnvelope<never>)
    }

    const sessionToken = makeSessionToken({ address: consumed.address })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

    // FIX: FINDING-02 — do not return sessionToken or privyToken in response body;
    // the session cookie is set above, and the Privy JWT should not be relayed to clients.
    return res.status(200).json({
      success: true,
      data: {
        address: consumed.address,
      } satisfies HandoffRedeemResponse,
    } satisfies ApiEnvelope<HandoffRedeemResponse>)
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
}
