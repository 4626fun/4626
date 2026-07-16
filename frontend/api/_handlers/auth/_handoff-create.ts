import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  getClientIp,
  checkDurableRateLimit,
  rateLimitKey,
  resolveAuthorizedRequestPrincipal,
} from '@4626/server-core'

import { createHandoffCode, ensureHandoffSchema } from '../../../server/auth/_handoff.js'

type HandoffCreateBody = {
  privyToken?: string
  expectedAddress?: string
}

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}
const HANDOFF_CREATE_MAX_BODY_BYTES = 8_192

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  let authorized
  try {
    authorized = await resolveAuthorizedRequestPrincipal(req, { lowercase: true })
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
  if (!authorized || !isAddressLike(authorized.address)) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const cookiePrincipal = normalizeAddress(authorized.address)
  const handoffAddress = normalizeAddress(
    authorized.canonicalSmartWalletAddress ?? authorized.address,
  )
  if (!isAddressLike(handoffAddress)) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const ip = getClientIp(req as any)
  const limit = await checkDurableRateLimit(
    rateLimitKey('auth_handoff_create', String(authorized.profileId), cookiePrincipal, ip),
    {
      windowMs: 60_000,
      maxRequests: 20,
    },
    { failClosed: true },
  )
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

  const expectedAddress = normalizeAddress(body.expectedAddress)
  if (expectedAddress) {
    if (!isAddressLike(expectedAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expected session address',
      } satisfies ApiEnvelope<never>)
    }
    // Bind create to the principal established immediately before this call
    // (typically /api/auth/privy). Either the cookie principal or the resolved
    // canonical handoff address is accepted so a just-bridged CSW session and a
    // signer-proven upgrade cannot race each other.
    if (expectedAddress !== cookiePrincipal && expectedAddress !== handoffAddress) {
      return res.status(409).json({
        success: false,
        error: 'Session principal changed before handoff creation',
        code: 'SESSION_PRINCIPAL_CHANGED',
      } satisfies ApiEnvelope<never> & { code: string })
    }
  }

  try {
    await ensureHandoffSchema(db as any)
    // Never persist Privy bearer tokens in handoff rows. Redeem mints only the
    // 4626 cookie; the client already refreshed Privy on the source host.
    const handoff = await createHandoffCode(db as any, {
      address: handoffAddress,
      privyToken: null,
    })
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
