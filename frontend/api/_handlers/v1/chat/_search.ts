import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  guardAgentApiRequest,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  getCachedEthosScoreByAddress,
  getCachedEthosProfileByUserkey,
  getCachedEthosScoreByUserkey,
  getCachedEthosScoresByUserkeys,
  normalizeEthosUserkey,
} from '../../../../server/_lib/chat/ethosClient.js'
import { getDb } from '../../../../server/_lib/db/postgres.js'
import {
  ethosCanonicalReadEnabled,
  getCanonicalEthosScoresByUserkeys,
} from '../../../../server/_lib/identity/ethosCanonicalScores.js'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'

const MAX_BULK_USERKEYS = 100
const MAX_SEARCH_BODY_BYTES = 32_768

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/chat/search', kind: 'read' })
  if (!g.ok) return

  const requester = normalizeChatAddress(g.auth?.address)
  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-search', requester ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentsRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody<{ userkeys?: unknown }>(req, { maxBytes: MAX_SEARCH_BODY_BYTES }).catch(() => null)
    const rawUserkeys = Array.isArray(body?.userkeys) ? body.userkeys : []
    const userkeys = Array.from(
      new Set(
        rawUserkeys
          .map((value) => (typeof value === 'string' ? normalizeEthosUserkey(value) : null))
          .filter((value): value is string => Boolean(value))
          .slice(0, MAX_BULK_USERKEYS),
      ),
    )

    if (userkeys.length === 0) {
      return res.status(200).json({ success: true, data: { users: [], agents: [], vaults: [] } })
    }

    let scores = new Map<string, Awaited<ReturnType<typeof getCachedEthosScoreByUserkey>>>()
    if (ethosCanonicalReadEnabled()) {
      try {
        const db = await getDb()
        if (db) scores = await getCanonicalEthosScoresByUserkeys({ db, userkeys })
      } catch {
        scores = new Map()
      }
    } else {
      try {
        scores = await getCachedEthosScoresByUserkeys(userkeys)
      } catch {
        scores = new Map()
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        users: userkeys.map((userkey) => {
          const address = userkey.startsWith('address:') ? normalizeChatAddress(userkey.slice('address:'.length)) : null
          const ethos = scores.get(userkey) ?? null
          return {
            address,
            userkey,
            ethosScore: ethos?.score ?? null,
            ethosLevel: ethos?.level ?? null,
          }
        }),
        agents: [],
        vaults: [],
      },
    })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const address = normalizeChatAddress(query)
  const userkey = address ? `address:${address}` : normalizeEthosUserkey(query)
  const includeProfile = String(req.query.profile ?? '').trim() === '1'
  if (!userkey) {
    return res.status(200).json({ success: true, data: { users: [], agents: [], vaults: [] } })
  }

  const canonicalReadsEnabled = ethosCanonicalReadEnabled()
  let ethos = null
  let profile = null
  try {
    if (canonicalReadsEnabled) {
      const db = await getDb()
      if (db) {
        const mapped = await getCanonicalEthosScoresByUserkeys({ db, userkeys: [userkey] })
        ethos = mapped.get(userkey) ?? null
      }
      // Canonical read mode avoids live Ethos API calls on request paths.
      profile = null
    } else {
      ethos = address ? await getCachedEthosScoreByAddress(address) : await getCachedEthosScoreByUserkey(userkey)
      if (includeProfile) profile = await getCachedEthosProfileByUserkey(userkey)
    }
  } catch {
    ethos = null
    profile = null
  }

  return res.status(200).json({
    success: true,
    data: {
      users: [{
        address: address ?? null,
        userkey,
        ethosScore: ethos?.score ?? null,
        ethosLevel: ethos?.level ?? null,
        ethosProfile: profile,
      }],
      agents: [],
      vaults: [],
    },
  })
}
