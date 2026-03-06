import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { createHandoffCode, ensureHandoffSchema } from '../../../server/auth/_handoff.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { getClientIp, checkRateLimit, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'

type HandoffCreateBody = {
  privyToken?: string
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

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
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<HandoffCreateBody>(req).catch(() => null)) ?? (req.body as HandoffCreateBody | null) ?? {}
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
