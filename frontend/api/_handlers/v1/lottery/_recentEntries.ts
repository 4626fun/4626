import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  getApiContracts,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'

import { getDb } from '@4626/server-core'
import {
  resolveRecentEntries,
  resolveRecentEntriesBlockRange,
} from '../../../../server/_lib/lottery/recentEntriesQuery.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const v = req.query?.[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function parseBlock(value: string | null): bigint | null {
  if (!value) return null
  const s = value.trim().toLowerCase()
  try {
    if (s.startsWith('0x')) return BigInt(s)
    const n = BigInt(Math.floor(Number(s)))
    return n >= 0n ? n : null
  } catch {
    return null
  }
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = value ? Number(value) : NaN
  if (!Number.isFinite(n)) return def
  const i = Math.floor(n)
  return Math.max(min, Math.min(max, i))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/recentEntries', kind: 'logs' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-recent-entries', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const creatorCoin = (getStringQuery(req, 'creatorCoin') || '').trim()
  if (creatorCoin && !isAddressLike(creatorCoin)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorCoin address' })
  }

  const limit = clampInt(getStringQuery(req, 'limit'), 25, 1, 200)
  const fromBlockQ = parseBlock(getStringQuery(req, 'fromBlock'))
  const toBlockQ = parseBlock(getStringQuery(req, 'toBlock'))

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!lotteryManager) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  try {
    const { fromBlock, toBlock } = await resolveRecentEntriesBlockRange(fromBlockQ, toBlockQ)
    const db = await getDb()
    const { events, dataSource } = await resolveRecentEntries(db, {
      lotteryManager: String(lotteryManager).toLowerCase(),
      creatorCoin: creatorCoin ? creatorCoin.toLowerCase() : null,
      fromBlock,
      toBlock,
      limit,
    })

    setCache(res, dataSource === 'index' ? 60 : 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        lotteryManager: String(lotteryManager).toLowerCase(),
        creatorCoin: creatorCoin ? creatorCoin.toLowerCase() : null,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        limit,
        dataSource,
        events,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read entry logs' })
  }
}
