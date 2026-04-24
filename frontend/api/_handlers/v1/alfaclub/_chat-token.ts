/**
 * /api/v1/alfaclub/chat-token
 *
 * Admin-only runtime token rotation endpoint for AlfaClub room chat bridge.
 *
 * Methods:
 * - GET:    Read token metadata (never returns raw JWT)
 * - POST:   Upsert a new AlfaClub Privy JWT
 * - DELETE: Clear the DB-backed JWT (env fallback may still exist)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  handleOptions,
  getSessionAddress,
  isAdminAddress,
} from '../../../../packages/server-core/src/index.js'

import {
  clearAlfaClubChatToken,
  readAlfaClubChatToken,
  readAlfaClubChatTokenMeta,
  upsertAlfaClubChatToken,
  upsertAlfaClubPrivyAccessToken,
  upsertAlfaClubPrivyRefreshToken,
} from '../../../../server/_lib/alfaclub/chatTokenStore.js'

declare const process: { env: Record<string, string | undefined> }

type ChatTokenUpdateBody = {
  jwt?: string
  alfaclubJwt?: string
  // Bootstrap for the auto-refresher. When supplied alongside `jwt`, the
  // refresher no longer needs env-var fallback and will rotate `jwt`
  // automatically every ~30 minutes.
  privyAccessToken?: string
  privyRefreshToken?: string
}

function isPlausibleJwt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim())
}

function isPlausibleRefreshToken(value: unknown): value is string {
  // Privy refresh tokens are opaque base64url-ish strings. Allow the same
  // charset as a JWT segment (letters, digits, _, -), minimum 16 chars.
  if (typeof value !== 'string') return false
  return /^[A-Za-z0-9_-]{16,}$/.test(value.trim())
}

function fingerprintJwt(token: string | null): string | null {
  if (!token) return null
  const v = token.trim()
  if (!v) return null
  if (v.length <= 20) return `${v.slice(0, 4)}…${v.slice(-4)}`
  return `${v.slice(0, 10)}…${v.slice(-8)}`
}

function readEnvJwt(): string | null {
  const token = (process.env.ALFACLUB_CHAT_JWT ?? '').trim()
  return token || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-chat-token', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  if (req.method === 'GET') {
    const [meta, stored] = await Promise.all([
      readAlfaClubChatTokenMeta(),
      readAlfaClubChatToken(),
    ])
    const envJwt = readEnvJwt()
    const activeSource = meta.hasToken ? 'db' : envJwt ? 'env' : 'none'
    return res.status(200).json({
      success: true,
      data: {
        activeSource,
        db: meta,
        envFallbackConfigured: Boolean(envJwt),
        tokenFingerprint:
          activeSource === 'db'
            ? fingerprintJwt(stored?.jwt ?? null)
            : fingerprintJwt(envJwt),
      },
    })
  }

  if (req.method === 'DELETE') {
    const cleared = await clearAlfaClubChatToken({ clearedBy: admin.toLowerCase() })
    if (!cleared) {
      return res.status(503).json({ success: false, error: 'token_store_unavailable' })
    }
    const envJwt = readEnvJwt()
    return res.status(200).json({
      success: true,
      data: {
        activeSource: envJwt ? 'env' : 'none',
        db: cleared,
        envFallbackConfigured: Boolean(envJwt),
        tokenFingerprint: fingerprintJwt(envJwt),
      },
    })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as ChatTokenUpdateBody
  const candidate = typeof body?.jwt === 'string' && body.jwt.trim()
    ? body.jwt.trim()
    : typeof body?.alfaclubJwt === 'string'
      ? body.alfaclubJwt.trim()
      : ''
  if (!isPlausibleJwt(candidate)) {
    return res.status(400).json({
      success: false,
      error: 'jwt is required and must be a Privy JWT (three dot-separated segments).',
    })
  }

  // Optional: bootstrap the auto-refresher in the same call. Both tokens
  // must be present for refresher semantics to work; reject partial
  // bootstraps rather than silently leaving the refresher misconfigured.
  //
  // Validate bootstrap tokens BEFORE mutating chat_jwt so a 400 from a
  // malformed bootstrap doesn't leave the caller with a side-effect-y
  // "failure" (P2 review feedback on PR #368). After validation passes,
  // writes happen in sequence: chat_jwt -> access -> refresh. If one of
  // the later upserts fails at the DB level, chat_jwt may still be
  // rotated, but that's acceptable because the caller KNOWS the jwt
  // field was intended to succeed. Pre-flight validation is the piece
  // callers were previously tripping on with 400s.
  const accessCandidate =
    typeof body?.privyAccessToken === 'string' ? body.privyAccessToken.trim() : ''
  const refreshCandidate =
    typeof body?.privyRefreshToken === 'string' ? body.privyRefreshToken.trim() : ''
  const wantsRefresherBootstrap = Boolean(accessCandidate || refreshCandidate)
  if (wantsRefresherBootstrap) {
    if (!isPlausibleJwt(accessCandidate)) {
      return res.status(400).json({
        success: false,
        error: 'privyAccessToken is required as a JWT when bootstrapping the refresher.',
      })
    }
    if (!isPlausibleRefreshToken(refreshCandidate)) {
      return res.status(400).json({
        success: false,
        error: 'privyRefreshToken is required (opaque base64url string, >= 16 chars) when bootstrapping the refresher.',
      })
    }
  }

  const saved = await upsertAlfaClubChatToken({
    jwt: candidate,
    updatedBy: admin.toLowerCase(),
  })
  if (!saved) {
    return res.status(503).json({ success: false, error: 'token_store_unavailable' })
  }

  const refresherBootstrapped: { access: boolean; refresh: boolean } = {
    access: false,
    refresh: false,
  }
  if (wantsRefresherBootstrap) {
    refresherBootstrapped.access = await upsertAlfaClubPrivyAccessToken({
      accessToken: accessCandidate,
      updatedBy: admin.toLowerCase(),
    })
    refresherBootstrapped.refresh = await upsertAlfaClubPrivyRefreshToken({
      refreshToken: refreshCandidate,
      updatedBy: admin.toLowerCase(),
    })
  }

  return res.status(200).json({
    success: true,
    data: {
      activeSource: 'db',
      db: saved,
      envFallbackConfigured: Boolean(readEnvJwt()),
      tokenFingerprint: fingerprintJwt(candidate),
      refresherBootstrapped,
    },
  })
}

