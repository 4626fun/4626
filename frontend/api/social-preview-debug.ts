import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getStringQuery, setPublicCors } from '../server/zora/_shared.js'

import {
  getRequestOrigin,
  matchSocialPreviewRewrite,
  normalizeSocialPreviewInput,
  resolveSocialPreviewPayloadSafe,
} from './_handlers/social/_socialPreview.js'

declare const process: { env: Record<string, string | undefined> }

// Only enable the debug endpoint when an operator explicitly opts in via
// SOCIAL_PREVIEW_DEBUG_ENABLED. The previous behaviour of auto-enabling on
// every non-production Vercel env exposed internal rewrite rules on every
// preview deployment (those URLs are not secret; anyone with the URL can hit
// them). The endpoint still short-circuits to 404 in any env where the flag
// is unset or set to a falsy value, including all production deployments.
function isDebugEnabled(): boolean {
  const explicit = String(process.env.SOCIAL_PREVIEW_DEBUG_ENABLED ?? '')
    .trim()
    .toLowerCase()
  return explicit === '1' || explicit === 'true' || explicit === 'yes'
}

// Parse SOCIAL_PREVIEW_DEBUG_ALLOWED_ORIGINS (comma-separated list of exact
// origins, e.g. 'https://4626.fun,https://staging.4626.fun'). The `origin`
// query parameter must exactly match one of the entries before it is used as
// the social-preview origin override; otherwise the request falls back to
// the request-derived origin. An empty allowlist rejects every override.
function getAllowedOriginOverrides(): ReadonlySet<string> {
  const raw = String(process.env.SOCIAL_PREVIEW_DEBUG_ALLOWED_ORIGINS ?? '').trim()
  if (!raw) return new Set<string>()
  const out = new Set<string>()
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
      // Store the canonical origin (protocol + host + optional port) so
      // comparison does not drift on trailing slashes or paths.
      out.add(parsed.origin)
    } catch {
      // Drop malformed entries silently; an operator misconfiguration should
      // not open the gate.
    }
  }
  return out
}

function getUserAgent(req: VercelRequest): string {
  const fromQuery = getStringQuery(req, 'userAgent') ?? getStringQuery(req, 'ua')
  if (fromQuery) return fromQuery

  const header = req.headers['user-agent']
  if (Array.isArray(header)) return String(header[0] ?? '')
  if (typeof header === 'string') return header
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (!isDebugEnabled()) {
    res.status(404).json({ success: false, error: 'Not found' })
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const pathOrUrl = getStringQuery(req, 'path')
  if (!pathOrUrl) {
    res.status(400).json({
      success: false,
      error: 'path is required',
      hint: 'Example: /api/social-preview-debug?path=/explore/creators/base/0xabc...&userAgent=Twitterbot/1.0',
    })
    return
  }

  const userAgent = getUserAgent(req)
  const rewriteMatch = matchSocialPreviewRewrite(pathOrUrl, userAgent)
  if (!rewriteMatch) {
    res.status(200).json({
      success: true,
      matched: false,
      path: pathOrUrl,
      userAgent,
      reason: 'No social-bot rewrite matched for this path/user-agent.',
    })
    return
  }

  // M-24 fix: originOverride must be in the explicit allowlist. A malformed
  // or non-allowlisted override is dropped and we fall back to the
  // request-derived origin; we do not surface an error to avoid turning the
  // endpoint into an allowlist oracle.
  const rawOriginOverride = getStringQuery(req, 'origin')
  let originOverride: string | null = null
  if (rawOriginOverride) {
    try {
      const parsed = new URL(rawOriginOverride)
      const allowedOrigins = getAllowedOriginOverrides()
      if (allowedOrigins.has(parsed.origin)) {
        originOverride = parsed.origin
      }
    } catch {
      originOverride = null
    }
  }
  const origin = originOverride ?? getRequestOrigin(req)
  const input = normalizeSocialPreviewInput({
    origin,
    kind: rewriteMatch.query.kind,
    chain: rewriteMatch.query.chain ?? null,
    address: rewriteMatch.query.address ?? null,
    sort: rewriteMatch.query.sort ?? null,
    time: rewriteMatch.query.time ?? null,
  })
  const payload = await resolveSocialPreviewPayloadSafe(input)

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    matched: true,
    path: pathOrUrl,
    userAgent,
    rewrite: rewriteMatch,
    normalizedInput: input,
    payload,
  })
}
