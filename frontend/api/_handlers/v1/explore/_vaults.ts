import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDb,
  guardAgentApiRequest,
  handleOptions,
  isDbConfigured,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'

import { ensureCreatorMetricsSchema } from '../../../../server/_lib/creatorMetricsSync.js'
import { ensureKeeprSchema } from '../../../../server/_lib/keeprSchema.js'

type ExploreVaultSort = 'volume' | 'marketCap' | 'fees24h' | 'new'
type ExploreVaultTimeFilter = '1d' | '1w' | '1y'

type ExploreVaultRow = {
  vaultAddress: `0x${string}` | null
  chainId: number
  creatorCoinAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  groupId: string
  graduatedAt: string | null
  settledAt: string | null
  settlementStage: string | null
  createdAt: string | null
  updatedAt: string | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  fees24hUsd: number | null
}

type ExploreVaultsResponse = {
  items: ExploreVaultRow[]
  count: number
  nextCursor: string | null
  sort: ExploreVaultSort
  time: ExploreVaultTimeFilter
}

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

const VALID_SORTS: Record<string, ExploreVaultSort> = {
  volume: 'volume',
  marketCap: 'marketCap',
  fees24h: 'fees24h',
  priceChange: 'fees24h',
  new: 'new',
}

const VALID_TIME_FILTERS: Record<string, ExploreVaultTimeFilter> = {
  '1d': '1d',
  '1w': '1w',
  '1y': '1y',
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 45) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`)
}

function readQueryParam(req: VercelRequest, key: string): string | undefined {
  const value = req.query?.[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function normalizeSort(value: string | undefined): ExploreVaultSort {
  const normalized = (value ?? '').trim()
  return VALID_SORTS[normalized] ?? 'volume'
}

function normalizeTimeFilter(value: string | undefined): ExploreVaultTimeFilter {
  const normalized = (value ?? '').trim().toLowerCase()
  return VALID_TIME_FILTERS[normalized] ?? '1d'
}

function parseOptionalChainId(value: string | undefined): number | null {
  if (!value) return null
  const chainId = Number(value)
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return Math.floor(chainId)
}

function toLowerHexOrNull(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

function toIsoStringOrNull(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toFiniteNumberOrNull(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  return n
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/explore/vaults', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-explore-vaults', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.exploreRead,
  )
  if (!limiter.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureKeeprSchema()
    await ensureCreatorMetricsSchema(db as any)

    const limitRaw = readQueryParam(req, 'limit')
    const cursorRaw = readQueryParam(req, 'cursor')
    const sortRaw = readQueryParam(req, 'sort')
    const timeRaw = readQueryParam(req, 'time')
    const chainIdRaw = readQueryParam(req, 'chainId')
    const queryRaw = readQueryParam(req, 'query')

    const limit = clampInt(Number(limitRaw || DEFAULT_LIMIT), 1, MAX_LIMIT)
    const offset = clampInt(Number(cursorRaw || '0'), 0, 500_000)
    const sort = normalizeSort(sortRaw)
    const time = normalizeTimeFilter(timeRaw)
    const chainId = parseOptionalChainId(chainIdRaw)
    const searchQuery = (queryRaw ?? '').trim().toLowerCase()
    const queryLike = searchQuery.length > 0 ? `%${searchQuery}%` : null

    const result = await db.sql`
      SELECT
        v.vault_address,
        v.chain_id,
        v.creator_coin_address,
        v.share_token_address,
        v.group_id,
        v.graduated_at,
        v.settled_at,
        v.settlement_stage,
        v.created_at,
        v.updated_at,
        cc.market_cap_usd,
        cc.volume_24h_usd,
        cc.fees_24h_usd
      FROM keepr_vaults AS v
      LEFT JOIN creator_coins AS cc
        ON LOWER(cc.coin_address) = LOWER(v.creator_coin_address)
       AND cc.chain_id = v.chain_id
      WHERE (${chainId}::int IS NULL OR v.chain_id = ${chainId})
        AND (
          ${queryLike}::text IS NULL
          OR LOWER(v.vault_address) LIKE ${queryLike}
          OR LOWER(v.creator_coin_address) LIKE ${queryLike}
          OR LOWER(COALESCE(v.share_token_address, '')) LIKE ${queryLike}
          OR LOWER(COALESCE(v.group_id, '')) LIKE ${queryLike}
        )
        AND (
          ${time} = '1y'
          OR (${time} = '1d' AND COALESCE(v.updated_at, v.created_at) >= NOW() - INTERVAL '1 day')
          OR (${time} = '1w' AND COALESCE(v.updated_at, v.created_at) >= NOW() - INTERVAL '7 days')
        )
      ORDER BY
        CASE WHEN ${sort} = 'marketCap' THEN COALESCE(cc.market_cap_usd, 0) END DESC NULLS LAST,
        CASE WHEN ${sort} = 'volume' THEN COALESCE(cc.volume_24h_usd, 0) END DESC NULLS LAST,
        CASE WHEN ${sort} = 'fees24h' THEN COALESCE(cc.fees_24h_usd, 0) END DESC NULLS LAST,
        CASE WHEN ${sort} = 'new' THEN EXTRACT(EPOCH FROM COALESCE(v.created_at, v.updated_at, NOW())) END DESC NULLS LAST,
        COALESCE(v.updated_at, v.created_at, NOW()) DESC,
        LOWER(v.vault_address) ASC
      LIMIT ${limit + 1}
      OFFSET ${offset};
    `

    const rows = Array.isArray(result.rows) ? result.rows : []
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows

    const items: ExploreVaultRow[] = pageRows.map((row: any) => ({
      vaultAddress: toLowerHexOrNull(row.vault_address),
      chainId: Number(row.chain_id || 0),
      creatorCoinAddress: toLowerHexOrNull(row.creator_coin_address),
      shareTokenAddress: toLowerHexOrNull(row.share_token_address),
      groupId: typeof row.group_id === 'string' ? row.group_id : '',
      graduatedAt: toIsoStringOrNull(row.graduated_at),
      settledAt: toIsoStringOrNull(row.settled_at),
      settlementStage: typeof row.settlement_stage === 'string' ? row.settlement_stage : null,
      createdAt: toIsoStringOrNull(row.created_at),
      updatedAt: toIsoStringOrNull(row.updated_at),
      marketCapUsd: toFiniteNumberOrNull(row.market_cap_usd),
      volume24hUsd: toFiniteNumberOrNull(row.volume_24h_usd),
      fees24hUsd: toFiniteNumberOrNull(row.fees_24h_usd),
    }))

    const payload: ExploreVaultsResponse = {
      items,
      count: items.length,
      nextCursor: hasMore ? String(offset + limit) : null,
      sort,
      time,
    }

    setCache(res, 45)
    return res.status(200).json({
      success: true,
      data: payload,
    } satisfies ApiEnvelope<ExploreVaultsResponse>)
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error && error.message ? error.message : 'Failed to load explore vaults',
    } satisfies ApiEnvelope<never>)
  }
}
