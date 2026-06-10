import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  clearCookie,
  consumeNonce,
  COOKIE_NONCE,
  COOKIE_SESSION,
  ensureNonceSchema,
  handleOptions,
  makeSessionToken,
  parseCookies,
  parseSiweMessage,
  readNonceToken,
  readJsonBody,
  setCookie,
  setCors,
  setNoStore,
  verifySiweSignature,
  getDb,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import { isCswOwner } from '../../../server/_lib/wallet/cswOwner.js'

import { getTrustedRequestOrigins, isAddressLike, normalizeOrigin } from '../../../server/_lib/infra/trust.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { upsertProfileByWallet } from '../../../server/_lib/identity/profileSync.js'
type VerifyBody = { message?: string; signature?: string; nonceToken?: string; cswAddress?: string }

// FIX: FINDING-02/07 — removed sessionToken from response body;
// session is conveyed via HttpOnly cookie only, preventing XSS exfiltration.
// FIX: FINDING-13 — omit cswOwnership when verification fails.
type VerifyResponse = {
  address: string
  cswOwnership?: {
    cswAddress: string
    ownerAddress: string
    verified: true
  } | null
}

async function verifyCswOwnerOnBase(params: { smartWallet: string; ownerAddress: string }): Promise<boolean> {
  return isCswOwner(params.ownerAddress, params.smartWallet)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // H-07 / 4626-299: auth endpoints must use the durable Postgres-backed
  // limiter with failClosed=true so an attacker cannot bypass the budget
  // across concurrent serverless instances or when the DB is unreachable.
  const limiter = await checkDurableRateLimit(
    rateLimitKey('auth-verify', getClientIp(req)),
    RATE_LIMITS.authWrite,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<VerifyBody>(req, { maxBytes: 16_384 })
  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''
  const nonceTokenRaw = typeof body?.nonceToken === 'string' ? body.nonceToken : ''
  const cswAddressRaw = typeof body?.cswAddress === 'string' ? body.cswAddress.trim() : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }
  if (cswAddressRaw && !isAddressLike(cswAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid cswAddress' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiweMessage(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid message' } satisfies ApiEnvelope<never>)
  }

  const trustedOrigins = getTrustedRequestOrigins(req)
  const trustedDomains = new Set<string>()
  for (const origin of trustedOrigins) {
    try {
      trustedDomains.add(new URL(origin).host.toLowerCase())
    } catch {
      // ignore invalid origin entries
    }
  }

  if (!trustedDomains.has(String(parsed.domain).trim().toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const cookies = parseCookies(req)
  const cookieNonce = cookies[COOKIE_NONCE] ?? ''
  const cookieMatches = cookieNonce && cookieNonce === parsed.nonce
  if (!cookieMatches) {
    // Fallback for embedded contexts where cookies may be blocked: validate the signed nonce token.
    // FIX: FINDING-12 — pass requesting IP to validate nonce token IP binding.
    const nonceToken = nonceTokenRaw ? readNonceToken(nonceTokenRaw, { ip: getClientIp(req) }) : null
    if (!nonceToken || nonceToken.nonce !== parsed.nonce) {
      return res.status(400).json({ success: false, error: 'Nonce mismatch' } satisfies ApiEnvelope<never>)
    }
  }

  // Best-effort replay window: message must be recent.
  const issuedAtMs = Date.parse(parsed.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > 1000 * 60 * 15) {
    return res.status(400).json({ success: false, error: 'Message expired' } satisfies ApiEnvelope<never>)
  }

  if (parsed.chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'Invalid chain' } satisfies ApiEnvelope<never>)
  }

  const parsedUriOrigin = normalizeOrigin(parsed.uri)
  if (!parsedUriOrigin) {
    return res.status(400).json({ success: false, error: 'URI mismatch' } satisfies ApiEnvelope<never>)
  }
  if (!trustedOrigins.has(parsedUriOrigin)) {
    return res.status(400).json({ success: false, error: 'URI mismatch' } satisfies ApiEnvelope<never>)
  }
  if (new URL(parsedUriOrigin).host.toLowerCase() !== String(parsed.domain).trim().toLowerCase()) {
    return res.status(400).json({ success: false, error: 'URI mismatch' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
  try {
    await ensureNonceSchema(db as any)
    const consumed = await consumeNonce(db as any, parsed.nonce)
    if (!consumed) {
      return res.status(400).json({ success: false, error: 'Nonce already used or expired' } satisfies ApiEnvelope<never>)
    }
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }

  const verified = await verifySiweSignature({ message, signature })
  if (!verified) {
    return res.status(401).json({ success: false, error: 'Signature invalid' } satisfies ApiEnvelope<never>)
  }

  // FIX: FINDING-13 — only include cswOwnership when on-chain verification succeeds;
  // returning verified:false exposes a confusing API contract that invites client bugs.
  let cswOwnership: VerifyResponse['cswOwnership'] = null
  if (cswAddressRaw) {
    const ownerVerified = await verifyCswOwnerOnBase({
      smartWallet: cswAddressRaw,
      ownerAddress: verified.address,
    })
    if (ownerVerified) {
      cswOwnership = {
        cswAddress: cswAddressRaw,
        ownerAddress: verified.address,
        verified: true,
      }
    }
  }

  const token = makeSessionToken({ address: verified.address })
  setCookie(req, res, COOKIE_SESSION, token, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })
  clearCookie(req, res, COOKIE_NONCE)

  try {
    await ensureWaitlistSchema(db as any)
    const verifiedCanonicalCsw =
      cswOwnership?.verified === true ? cswOwnership.cswAddress.toLowerCase() : null
    await upsertProfileByWallet(db as any, {
      primaryWallet: verified.address,
      cswAddress: verifiedCanonicalCsw,
      baseSubAccount: null,
    })
  } catch {
    // best-effort: auth should succeed even if DB is unavailable
  }

  // FIX: FINDING-02/07 — do not return sessionToken in response body;
  // the session cookie is set above via setCookie.
  return res.status(200).json({
    success: true,
    data: { address: verified.address, cswOwnership } satisfies VerifyResponse,
  } satisfies ApiEnvelope<VerifyResponse>)
}
