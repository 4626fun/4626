import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  getClientIp,
  checkRateLimit,
  rateLimitKey,
  readRequestPrincipalAddress,
} from '@4626/server-core'

import { createHandoffCode, ensureHandoffSchema } from '../../../server/auth/_handoff.js'




type HandoffCreateBody = {
  privyToken?: string
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}
const HANDOFF_CREATE_MAX_BODY_BYTES = 8_192

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipalAddress(req, { lowercase: true })
  if (!isAddressLike(principal)) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const ip = getClientIp(req as any)
  const limit = checkRateLimit(rateLimitKey('auth_handoff_create', principal, ip), {
    windowMs: 60_000,
    maxRequests: 20,
  })
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }

  let body: HandoffCreateBody
  try {
    body = (await readBoundedJsonObjectBody<HandoffCreateBody>(req, {
      maxBytes: HANDOFF_CREATE_MAX_BODY_BYTES,
    })) ?? {}
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const privyToken = typeof body.privyToken === 'string' && body.privyToken.trim() ? body.privyToken.trim() : null

  try {
    await ensureHandoffSchema(db as any)
    const handoff = await createHandoffCode(db as any, { address: principal, privyToken })
    return res.status(200).json({
      success: true,
      data: {
        code: handoff.code,
        expiresAt: handoff.expiresAt,
      } satisfies HandoffCreateResponse,
    } satisfies ApiEnvelope<HandoffCreateResponse>)
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
}
