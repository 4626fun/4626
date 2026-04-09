import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getStringQuery, setPublicCors } from '../server/zora/_shared.js'

import {
  getRequestOrigin,
  matchSocialPreviewRewrite,
  normalizeSocialPreviewInput,
  resolveSocialPreviewPayloadSafe,
} from './_handlers/_socialPreview.js'

declare const process: { env: Record<string, string | undefined> }

function isDebugEnabled(): boolean {
  const explicit = String(process.env.SOCIAL_PREVIEW_DEBUG_ENABLED ?? '')
    .trim()
    .toLowerCase()
  if (explicit === '1' || explicit === 'true' || explicit === 'yes') return true

  const vercelEnv = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase()
  return vercelEnv !== 'production'
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

  const originOverride = getStringQuery(req, 'origin')
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
