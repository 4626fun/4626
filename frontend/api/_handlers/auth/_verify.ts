import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  clearCookie,
  consumeNonce,
  COOKIE_NONCE,
  COOKIE_SESSION,
  ensureNonceSchema,
  handleOptions,
  hostMatchesDomain,
  makeSessionToken,
  parseCookies,
  parseSiweMessage,
  readNonceToken,
  readJsonBody,
  setCookie,
  setCors,
  setNoStore,
  verifySiweSignature,
} from '../../../server/auth/_shared.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { upsertProfileByWallet } from '../../../server/_lib/profileSync.js'


type VerifyBody = { message?: string; signature?: string; nonceToken?: string }

type VerifyResponse = {
  address: string
  sessionToken: string
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').split(',')[0]?.trim() ?? ''
}

function getRequestOrigin(req: VercelRequest): string {
  const protoRaw = firstHeaderValue(req.headers?.['x-forwarded-proto'])
  const hostRaw =
    firstHeaderValue(req.headers?.['x-forwarded-host']) || firstHeaderValue(req.headers?.host)
  if (!hostRaw) return ''
  const proto = protoRaw.toLowerCase().startsWith('https') ? 'https' : 'http'
  return `${proto}://${hostRaw}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<VerifyBody>(req)
  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''
  const nonceTokenRaw = typeof body?.nonceToken === 'string' ? body.nonceToken : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiweMessage(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid message' } satisfies ApiEnvelope<never>)
  }

  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  if (!hostMatchesDomain(host, parsed.domain)) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const cookies = parseCookies(req)
  const cookieNonce = cookies[COOKIE_NONCE] ?? ''
  const cookieMatches = cookieNonce && cookieNonce === parsed.nonce
  if (!cookieMatches) {
    // Fallback for embedded contexts where cookies may be blocked: validate the signed nonce token.
    const nonceToken = nonceTokenRaw ? readNonceToken(nonceTokenRaw) : null
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
  const requestOrigin = normalizeOrigin(getRequestOrigin(req))
  const acceptedOrigins = new Set<string>()
  if (requestOrigin) acceptedOrigins.add(requestOrigin)
  try {
    const canonicalOrigin = normalizeOrigin(getCanonicalOrigin(req))
    if (canonicalOrigin) acceptedOrigins.add(canonicalOrigin)
  } catch {
    // Canonical origin may be intentionally unset in some environments; rely on request-origin binding.
  }
  if (!acceptedOrigins.has(parsedUriOrigin)) {
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

  const token = makeSessionToken({ address: verified.address })
  setCookie(req, res, COOKIE_SESSION, token, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })
  clearCookie(req, res, COOKIE_NONCE)

  try {
    await ensureWaitlistSchema(db as any)
    await upsertProfileByWallet(db as any, { primaryWallet: verified.address })
  } catch {
    // best-effort: auth should succeed even if DB is unavailable
  }

  return res.status(200).json({
    success: true,
    data: { address: verified.address, sessionToken: token } satisfies VerifyResponse,
  } satisfies ApiEnvelope<VerifyResponse>)
}

