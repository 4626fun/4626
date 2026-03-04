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
} from '../../../server/auth/_shared.js'
import { consumeHandoffCode, ensureHandoffSchema } from '../../../server/auth/_handoff.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { getClientIp, checkRateLimit, rateLimitKey } from '../../../server/_lib/rateLimit.js'

type RedeemBody = {
  code?: string
}

type HandoffRedeemResponse = {
  address: string
  sessionToken: string
}

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

  const ip = getClientIp(req as any)
  const limit = checkRateLimit(rateLimitKey('auth_handoff_redeem', ip), {
    windowMs: 60_000,
    maxRequests: 30,
  })
  if (!limit.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<RedeemBody>(req)
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
      return res.status(400).json({ success: false, error: 'Invalid or expired handoff code' } satisfies ApiEnvelope<never>)
    }

    const sessionToken = makeSessionToken({ address: consumed.address })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

    return res.status(200).json({
      success: true,
      data: {
        address: consumed.address,
        sessionToken,
      } satisfies HandoffRedeemResponse,
    } satisfies ApiEnvelope<HandoffRedeemResponse>)
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
}
