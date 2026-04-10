import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'


import { listCreatorXmtpAgents } from '../../../../../server/_lib/creatorXmtpAgents.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function setPrivateNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Authorization, Cookie')
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function parseCursor(raw: string | undefined): { createdAt: string; creatorAddress: `0x${string}` } | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  try {
    const json = Buffer.from(v, 'base64url').toString('utf8')
    const parsed: any = JSON.parse(json)
    const createdAt = typeof parsed?.createdAt === 'string' ? parsed.createdAt : ''
    const creatorAddress = typeof parsed?.creatorAddress === 'string' ? parsed.creatorAddress : ''
    if (!createdAt || !/^0x[a-fA-F0-9]{40}$/.test(creatorAddress)) return null
    return { createdAt, creatorAddress: creatorAddress.toLowerCase() as `0x${string}` }
  } catch {
    return null
  }
}

function encodeCursor(cursor: { createdAt: string; creatorAddress: `0x${string}` } | null): string | null {
  if (!cursor) return null
  const payload = JSON.stringify(cursor)
  return Buffer.from(payload, 'utf8').toString('base64url')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/creators', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agents-creators-list', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const limitRaw = typeof req.query?.limit === 'string' ? req.query.limit : ''
  const listedRaw = typeof req.query?.listed === 'string' ? req.query.listed : 'true'
  const cursorRaw = typeof req.query?.cursor === 'string' ? req.query.cursor : ''
  const creatorAddressRaw = typeof req.query?.creatorAddress === 'string' ? req.query.creatorAddress.trim() : ''

  const limit = clampInt(Number(limitRaw || '50'), 1, 200)
  const includeUnlistedRequested = listedRaw.toLowerCase() === 'false' || listedRaw === '0'
  if (includeUnlistedRequested && !g.auth) {
    return res.status(403).json({ success: false, error: 'Authentication required for unlisted creator queries' })
  }
  const listedOnly = !includeUnlistedRequested
  const cursor = parseCursor(cursorRaw)
  const creatorAddress =
    creatorAddressRaw.length > 0 && /^0x[a-fA-F0-9]{40}$/.test(creatorAddressRaw)
      ? (creatorAddressRaw.toLowerCase() as `0x${string}`)
      : null
  if (creatorAddressRaw.length > 0 && !creatorAddress) {
    return res.status(400).json({ success: false, error: 'Invalid creatorAddress' })
  }

  try {
    const { rows, nextCursor } = await listCreatorXmtpAgents({
      listedOnly,
      limit,
      cursor: cursor ?? undefined,
      creatorAddress: creatorAddress ?? undefined,
    })
    if (includeUnlistedRequested) setPrivateNoStore(res)
    else setCache(res, 60)
    return res.status(200).json({
      success: true,
      data: {
        count: rows.length,
        agents: rows.map((r) => ({
          creatorAddress: r.creatorAddress,
          xmtpAgentAddress: r.xmtpAgentAddress,
          agentType: r.agentType ?? 'eoa',
          cswAddress: r.cswAddress ?? null,
          listedPublicly: r.listedPublicly,
          createdAt: r.createdAt,
        })),
        nextCursor: encodeCursor(nextCursor),
      },
    })
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Failed to list creator agents'
    const code = msg.includes('db_not_configured') ? 503 : 500
    return res.status(code).json({ success: false, error: msg })
  }
}
