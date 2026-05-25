import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '../../../packages/server-core/src/index.js'
import {
  loadCreatorEthosProjectionByAddresses,
  mergeCreatorEthosScores,
} from '../../../server/_lib/zora/creatorEthosProjection.js'
import {
  resolveCreatorEthosByAddress,
  resolveEthosScoreSource,
} from '../../../server/_lib/zora/resolveCreatorEthosByAddress.js'
import { fetchFreshEthosScoresByUserkeys } from '../../../server/_lib/chat/ethosClient.js'
import {
  buildCreatorProfileFromTableContext,
  buildMediaContentFromAvatarUrl,
  buildTrend30dFromTableContext,
  loadExploreCoinTableContextByAddresses,
  type ExploreCoinTableContext,
} from '../../../server/_lib/zora/exploreCoinTableContext.js'
import { hydrateExploreSparklinesOnEdges } from '../../../server/_lib/zora/exploreSparklineHydrate.js'

type ExploreList =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'
  // Trend-specific
  | 'MOST_VALUABLE_TRENDS'
  | 'NEW_TRENDS'
  | 'TOP_VOLUME_TRENDS_24H'
  | 'TRENDING_TRENDS'
  // Creator-specific
  | 'NEW_CREATORS'
  | 'MOST_VALUABLE_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'
  | 'FEATURED_CREATORS'
  | 'TRENDING_CREATORS'
  // Content-specific
  | 'FEATURED_VIDEOS'
  | 'TRENDING_POSTS'
  // Combined
  | 'TRENDING_ALL'
  | 'TOP_VOLUME_ALL_24H'
  | 'NEW_ALL'
  | 'MOST_VALUABLE_ALL'

type ExploreSort = 'DEFAULT' | 'ETHOS_SCORE'

function parseList(value: string | null): ExploreList {
  switch (value) {
    case 'TOP_VOLUME_24H':
    case 'MOST_VALUABLE':
    case 'NEW':
    case 'LAST_TRADED':
    case 'LAST_TRADED_UNIQUE':
    case 'MOST_VALUABLE_TRENDS':
    case 'NEW_TRENDS':
    case 'TOP_VOLUME_TRENDS_24H':
    case 'TRENDING_TRENDS':
    case 'NEW_CREATORS':
    case 'MOST_VALUABLE_CREATORS':
    case 'TOP_VOLUME_CREATORS_24H':
    case 'FEATURED_CREATORS':
    case 'TRENDING_CREATORS':
    case 'FEATURED_VIDEOS':
    case 'TRENDING_POSTS':
    case 'TRENDING_ALL':
    case 'TOP_VOLUME_ALL_24H':
    case 'NEW_ALL':
    case 'MOST_VALUABLE_ALL':
      return value
    default:
      return 'TOP_GAINERS'
  }
}

function parseSort(value: string | null): ExploreSort {
  return value === 'ETHOS_SCORE' ? 'ETHOS_SCORE' : 'DEFAULT'
}

function normalizeExploreResponse(response: any) {
  if (response?.data?.edges || response?.data?.pageInfo) return response.data
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
}

function shortSymbol(address: string): string {
  return `${address.slice(2, 6).toUpperCase()}`
}

function toNumericString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? String(n) : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

async function attachIndexedCoinTableFieldsToEdges(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>> | null,
  edges: any[],
  sdk?: unknown,
): Promise<void> {
  if (!db || edges.length === 0) return
  const coinAddresses = edges
    .map((edge) => (typeof edge?.node?.address === 'string' ? edge.node.address : null))
    .filter((value): value is string => Boolean(value))
  const contextMap = await loadExploreCoinTableContextByAddresses(db, coinAddresses)
  for (const edge of edges) {
    const address = typeof edge?.node?.address === 'string' ? edge.node.address.toLowerCase() : ''
    if (!address || !edge?.node) continue
    const ctx = contextMap.get(address)
    if (ctx?.fees24hUsd) edge.node.fees24hUsd = ctx.fees24hUsd
    const trend30d = buildTrend30dFromTableContext(ctx)
    if (trend30d) edge.node.trend30d = trend30d
  }
  await hydrateExploreSparklinesOnEdges(db, edges, { sdk })
}

async function hasCreatorEthosProjection(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<boolean> {
  const result = await db.sql`
    SELECT to_regclass('public.creator_ethos_projection') IS NOT NULL AS has_projection;
  `
  return Boolean(result.rows?.[0]?.has_projection)
}

async function loadCreatorEthosProjectionPage(params: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
  offset: number
  count: number
  ethosMin: number | null
}) {
  const rows = await params.db.sql`
    WITH identity_ranked AS (
      SELECT
        cep.creator_address,
        cep.coin_address,
        cep.twitter_username,
        cep.zora_handle,
        cep.created_at,
        cep.market_cap_usd,
        cep.volume_24h_usd,
        cc.fees_24h_usd,
        cep.ethos_score,
        cep.ethos_level,
        cep.ethos_score_source,
        COALESCE(
          NULLIF(lower(regexp_replace(trim(cep.zora_handle), '^@', '')), ''),
          NULLIF(lower(regexp_replace(trim(cep.twitter_username), '^@', '')), ''),
          lower(cep.creator_address)
        ) AS identity_key,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            NULLIF(lower(regexp_replace(trim(cep.zora_handle), '^@', '')), ''),
            NULLIF(lower(regexp_replace(trim(cep.twitter_username), '^@', '')), ''),
            lower(cep.creator_address)
          )
          ORDER BY
            cep.ethos_score DESC NULLS LAST,
            cep.volume_24h_usd DESC NULLS LAST,
            cep.market_cap_usd DESC NULLS LAST,
            cep.creator_address ASC
        ) AS identity_rank
      FROM public.creator_ethos_projection cep
      LEFT JOIN creator_coins cc
        ON lower(cc.coin_address) = lower(cep.coin_address)
        AND cc.chain_id = 8453
      WHERE (
        ${params.ethosMin}::numeric IS NULL
        OR (cep.ethos_score IS NOT NULL AND cep.ethos_score >= ${params.ethosMin})
      )
    )
    SELECT
      creator_address,
      coin_address,
      twitter_username,
      zora_handle,
      created_at,
      market_cap_usd,
      volume_24h_usd,
      fees_24h_usd,
      ethos_score,
      ethos_level,
      ethos_score_source
    FROM identity_ranked
    WHERE identity_rank = 1
    ORDER BY
      CASE WHEN ethos_score IS NULL THEN 1 ELSE 0 END ASC,
      ethos_score DESC NULLS LAST,
      volume_24h_usd DESC NULLS LAST,
      market_cap_usd DESC NULLS LAST,
      creator_address ASC
    OFFSET ${params.offset}
    LIMIT ${params.count + 1};
  `
  return (rows.rows ?? []) as Array<{
    creator_address: string
    coin_address: string
    twitter_username: string | null
    zora_handle: string | null
    created_at: string | null
    market_cap_usd: string | number | null
    volume_24h_usd: string | number | null
    fees_24h_usd: string | number | null
    ethos_score: number | string | null
    ethos_level: string | null
    ethos_score_source: string | null
  }>
}

function isCreatorList(list: ExploreList): boolean {
  return (
    list === 'NEW_CREATORS' ||
    list === 'MOST_VALUABLE_CREATORS' ||
    list === 'TOP_VOLUME_CREATORS_24H' ||
    list === 'FEATURED_CREATORS' ||
    list === 'TRENDING_CREATORS'
  )
}

type ExploreDbListingRow = {
  coin_address: string
  creator_address: string
  twitter_username: string | null
  zora_handle: string | null
  created_at: string | null
  market_cap_usd: string | number | null
  volume_24h_usd: string | number | null
  fees_24h_usd?: string | number | null
}

function exploreRowDisplayLabel(
  row: Pick<ExploreDbListingRow, 'zora_handle' | 'twitter_username'>,
  address: string,
): string {
  const handle = typeof row.zora_handle === 'string' ? row.zora_handle.trim() : ''
  if (handle) return handle
  const twitter = typeof row.twitter_username === 'string' ? row.twitter_username.trim() : ''
  if (twitter) return twitter.startsWith('@') ? twitter : `@${twitter}`
  return shortSymbol(address)
}

function creatorExploreIdentityKey(row: {
  creator_address: string
  zora_handle?: string | null
  twitter_username?: string | null
}): string {
  const handle = typeof row.zora_handle === 'string' ? row.zora_handle.trim().toLowerCase().replace(/^@/, '') : ''
  if (handle) return `handle:${handle}`
  const twitter =
    typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase().replace(/^@/, '') : ''
  if (twitter) return `twitter:${twitter}`
  return `addr:${String(row.creator_address).toLowerCase()}`
}

function dedupeEthosSortedCreatorRows<
  T extends {
    creator_address: string
    zora_handle?: string | null
    twitter_username?: string | null
  },
>(rows: T[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = creatorExploreIdentityKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function buildCreatorProfileFromExploreRow(
  row: Pick<ExploreDbListingRow, 'zora_handle' | 'twitter_username'>,
): Record<string, unknown> | undefined {
  const handle = typeof row.zora_handle === 'string' ? row.zora_handle.trim() : ''
  if (handle) {
    const username = handle.replace(/^@/, '')
    return { handle, username }
  }
  const twitter = typeof row.twitter_username === 'string' ? row.twitter_username.trim() : ''
  if (twitter) return { username: twitter.replace(/^@/, '') }
  return undefined
}

type EthosSortedCreatorRow = ExploreDbListingRow & {
  ethos_score?: number | string | null
  ethos_level?: string | null
  ethos_score_source?: string | null
  canonical_social_score?: number | string | null
  canonical_wallet_score?: number | string | null
  owner_class_csw_score?: number | string | null
  owner_class_eoa_score?: number | string | null
  social_cached_score?: number | string | null
  wallet_cached_score?: number | string | null
}

async function assembleEthosSortedCreatorResponse(params: {
  pageRows: EthosSortedCreatorRow[]
  offset: number
  hasNextPage: boolean
  usingProjectionRows: boolean
  key: string | null
  db?: NonNullable<Awaited<ReturnType<typeof getDb>>> | null
  /** When true, skip per-row Zora getCoin calls and serve indexed projection fields only. */
  skipZoraCoinEnrichment?: boolean
  resolveNodeEthos: (
    row: EthosSortedCreatorRow,
  ) => { score: number | null; level: string | null; source: string | null }
}) {
  let coinDetails = new Map<string, any>()
  if (params.key && params.pageRows.length > 0 && !params.skipZoraCoinEnrichment) {
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(params.key)
      const responses = await Promise.allSettled(
        params.pageRows.map((row) => sdk.getCoin({ address: row.coin_address, chain: 8453 })),
      )
      responses.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const row = params.pageRows[index]
        if (!row) return
        const token = result.value?.data?.zora20Token
        if (token) coinDetails.set(row.coin_address.toLowerCase(), token)
      })
    } catch {
      coinDetails = new Map()
    }
  }

  let tableContext = new Map<string, ExploreCoinTableContext>()
  if (params.skipZoraCoinEnrichment && params.db && params.pageRows.length > 0) {
    tableContext = await loadExploreCoinTableContextByAddresses(
      params.db,
      params.pageRows.map((row) => String(row.coin_address)),
    )
  }

  const edges = params.pageRows.map((row, idx) => {
    const detail = coinDetails.get(String(row.coin_address).toLowerCase()) ?? null
    const ctx = tableContext.get(String(row.coin_address).toLowerCase()) ?? null
    const address = String(row.coin_address).toLowerCase()
    const creatorAddress = String(row.creator_address).toLowerCase()
    const displayName =
      typeof detail?.name === 'string' && detail.name.trim()
        ? detail.name.trim()
        : ctx?.name?.trim() || exploreRowDisplayLabel(row, address)
    const displaySymbol =
      typeof detail?.symbol === 'string' && detail.symbol.trim()
        ? detail.symbol.trim()
        : ctx?.symbol?.trim() || exploreRowDisplayLabel(row, address)
    const marketCap = toNumericString(detail?.marketCap) ?? toNumericString(row.market_cap_usd)
    const volume24h = toNumericString(detail?.volume24h) ?? toNumericString(row.volume_24h_usd)
    const fees24hUsd =
      toNumericString(row.fees_24h_usd) ?? (ctx?.fees24hUsd ? ctx.fees24hUsd : undefined)
    const creatorProfile =
      detail?.creatorProfile ?? buildCreatorProfileFromTableContext(row, ctx) ?? buildCreatorProfileFromExploreRow(row)
    const marketCapDelta24h =
      typeof detail?.marketCapDelta24h === 'string'
        ? detail.marketCapDelta24h
        : ctx?.marketCapDelta24h ?? undefined
    const uniqueHolders =
      typeof detail?.uniqueHolders === 'number'
        ? detail.uniqueHolders
        : typeof ctx?.uniqueHolders === 'number'
          ? ctx.uniqueHolders
          : undefined
    const mediaContent =
      detail?.mediaContent ?? buildMediaContentFromAvatarUrl(ctx?.avatarImageUrl)
    const ethos = params.resolveNodeEthos(row)
    const trend30d = buildTrend30dFromTableContext(ctx)
    return {
      cursor: String(params.offset + idx + 1),
      node: {
        id: typeof detail?.id === 'string' ? detail.id : undefined,
        address,
        creatorAddress,
        payoutRecipientAddress: creatorAddress,
        name: displayName,
        symbol: displaySymbol,
        coinType: 'CREATOR',
        chainId: 8453,
        createdAt: (typeof detail?.createdAt === 'string' && detail.createdAt) || row.created_at || undefined,
        marketCap,
        marketCapDelta24h,
        volume24h,
        fees24hUsd,
        totalVolume: typeof detail?.totalVolume === 'string' ? detail.totalVolume : undefined,
        uniqueHolders,
        mediaContent,
        creatorProfile,
        ethosScore: ethos.score,
        ethosLevel: ethos.level,
        ethosScoreSource: ethos.source,
        ...(trend30d ? { trend30d } : {}),
      },
    }
  })

  if (params.db && edges.length > 0) {
    let sdk: unknown = null
    if (params.key) {
      try {
        const mod: any = await import('@zoralabs/coins-sdk')
        mod.setApiKey(params.key)
        sdk = mod
      } catch {
        sdk = null
      }
    }
    await hydrateExploreSparklinesOnEdges(params.db, edges, { sdk })
  }

  return {
    edges,
    pageInfo: {
      hasNextPage: params.hasNextPage,
      endCursor: params.hasNextPage ? String(params.offset + params.pageRows.length) : null,
    },
    count: edges.length,
  }
}

async function buildEthosSortedCreatorList(params: {
  count: number
  after: string | null
  ethosMin: number | null
  key: string | null
}) {
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const offset = Math.max(0, Number.parseInt(params.after ?? '0', 10) || 0)
  let candidateRows: Array<{
    coin_address: string
    creator_address: string
    twitter_username: string | null
    zora_handle: string | null
    created_at: string | null
    market_cap_usd: string | number | null
    volume_24h_usd: string | number | null
    fees_24h_usd?: string | number | null
    ethos_score: number | string | null
    ethos_level: string | null
    ethos_score_source: string | null
    canonical_social_score: number | string | null
    canonical_wallet_score: number | string | null
    owner_class_csw_score: number | string | null
    owner_class_eoa_score: number | string | null
    social_cached_score: number | string | null
    wallet_cached_score: number | string | null
  }> = []

  const projectionAvailable = await hasCreatorEthosProjection(db)
  let usingProjectionRows = false
  if (projectionAvailable) {
    const projectionRows = await loadCreatorEthosProjectionPage({
      db,
      offset,
      count: params.count,
      ethosMin: params.ethosMin,
    })
    candidateRows = projectionRows.map((row) => ({
      ...row,
      canonical_social_score: null,
      canonical_wallet_score: null,
      owner_class_csw_score: null,
      owner_class_eoa_score: null,
      social_cached_score: null,
      wallet_cached_score: null,
    }))
    usingProjectionRows = true
  }

  if (usingProjectionRows && candidateRows.length > 0) {
    return assembleEthosSortedCreatorResponse({
      pageRows: candidateRows.slice(0, params.count),
      offset,
      hasNextPage: candidateRows.length > params.count,
      usingProjectionRows: true,
      skipZoraCoinEnrichment: true,
      key: params.key,
      db,
      resolveNodeEthos: (row) => ({
        score: toFiniteNumberOrNull(row.ethos_score),
        level: typeof row.ethos_level === 'string' ? row.ethos_level : null,
        source: typeof row.ethos_score_source === 'string' ? row.ethos_score_source : null,
      }),
    })
  }

  if (candidateRows.length === 0) {
    const windowTarget = Math.max(200, (offset + params.count) * 8)
    const candidateLimit = Math.min(2000, windowTarget)
    const rows = await db.sql`
    WITH ranked_creator_coins AS (
      SELECT
        cc.coin_address,
        lower(cc.creator_address) AS creator_address,
        cc.created_at,
        cc.market_cap_usd,
        cc.volume_24h_usd,
        cc.fees_24h_usd,
        ROW_NUMBER() OVER (
          PARTITION BY lower(cc.creator_address)
          ORDER BY
            cc.volume_24h_usd DESC NULLS LAST,
            cc.market_cap_usd DESC NULLS LAST,
            cc.created_at DESC NULLS LAST,
            cc.coin_address ASC
        ) AS creator_coin_rank
      FROM creator_coins cc
      WHERE cc.chain_id = 8453
    ),
    profile_identity AS (
      SELECT
        lower(a.address) AS creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        NULLIF(lower(trim(p.handle)), '') AS zora_handle,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY lower(a.address)
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM zora_profiles p
      CROSS JOIN LATERAL (
        SELECT NULLIF(p.signing_eoa, '') AS address
        UNION ALL
        SELECT NULLIF(p.primary_wallet, '')
        UNION ALL
        SELECT NULLIF(p.payout_recipient, '')
        UNION ALL
        SELECT NULLIF(p.smart_wallet_address, '')
        UNION ALL
        SELECT NULLIF(p.privy_wallet_address, '')
      ) a
      WHERE a.address IS NOT NULL
    ),
    profile_best AS (
      SELECT creator_address, twitter_username, zora_handle
      FROM profile_identity
      WHERE rn = 1
    ),
    canonical_wallet AS (
      SELECT
        rcc.creator_address,
        ces.score,
        ces.level
      FROM ranked_creator_coins rcc
      LEFT JOIN user_ethos_identity_keys uiek
        ON uiek.ethos_userkey = ('address:' || rcc.creator_address)
      LEFT JOIN canonical_ethos_scores ces
        ON ces.canonical_user_id = uiek.canonical_user_id
      WHERE rcc.creator_coin_rank = 1
    ),
    canonical_social AS (
      SELECT
        rcc.creator_address,
        ces.score,
        ces.level
      FROM ranked_creator_coins rcc
      LEFT JOIN profile_best pb
        ON pb.creator_address = rcc.creator_address
      LEFT JOIN user_ethos_identity_keys uiek
        ON pb.twitter_username IS NOT NULL
        AND uiek.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      LEFT JOIN canonical_ethos_scores ces
        ON ces.canonical_user_id = uiek.canonical_user_id
      WHERE rcc.creator_coin_rank = 1
    ),
    owner_class_from_csw AS (
      SELECT DISTINCT ON (rcc.creator_address)
        rcc.creator_address,
        zoc.ethos_score AS score,
        zoc.ethos_level AS level
      FROM ranked_creator_coins rcc
      JOIN zora_csw_owners zco
        ON lower(zco.csw_address) = rcc.creator_address
      CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
      JOIN zora_csw_owner_class zoc
        ON lower(zoc.eoa) = lower(owner_eoa)
      WHERE rcc.creator_coin_rank = 1
      ORDER BY rcc.creator_address, zoc.ethos_score DESC NULLS LAST, zoc.last_updated_at DESC NULLS LAST
    )
    SELECT
      rcc.coin_address,
      rcc.creator_address,
      pb.twitter_username,
      pb.zora_handle,
      rcc.created_at,
      rcc.market_cap_usd,
      rcc.volume_24h_usd,
      rcc.fees_24h_usd,
      cs.score AS canonical_social_score,
      cw.score AS canonical_wallet_score,
      oc.score AS owner_class_csw_score,
      zoc.ethos_score AS owner_class_eoa_score,
      es_social.score AS social_cached_score,
      es_wallet.score AS wallet_cached_score,
      NULL::text AS ethos_score_source,
      NULLIF(
        GREATEST(
          COALESCE(cs.score, -1),
          COALESCE(cw.score, -1),
          COALESCE(oc.score, -1),
          COALESCE(zoc.ethos_score, -1),
          COALESCE(es_social.score, -1),
          COALESCE(es_wallet.score, -1)
        ),
        -1
      ) AS ethos_score,
      COALESCE(cs.level, cw.level, oc.level, zoc.ethos_level, es_social.level, es_wallet.level) AS ethos_level
    FROM ranked_creator_coins rcc
    LEFT JOIN profile_best pb
      ON pb.creator_address = rcc.creator_address
    LEFT JOIN canonical_social cs
      ON cs.creator_address = rcc.creator_address
    LEFT JOIN canonical_wallet cw
      ON cw.creator_address = rcc.creator_address
    LEFT JOIN owner_class_from_csw oc
      ON oc.creator_address = rcc.creator_address
    LEFT JOIN zora_csw_owner_class zoc
      ON lower(zoc.eoa) = rcc.creator_address
    LEFT JOIN ethos_userkey_scores es_social
      ON pb.twitter_username IS NOT NULL
      AND es_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      AND es_social.status = 'matched'
    LEFT JOIN ethos_userkey_scores es_wallet
      ON es_wallet.ethos_userkey = ('address:' || rcc.creator_address)
      AND es_wallet.status = 'matched'
    WHERE rcc.creator_coin_rank = 1
      AND (
        ${params.ethosMin}::numeric IS NULL
        OR NULLIF(
          GREATEST(
            COALESCE(cs.score, -1),
            COALESCE(cw.score, -1),
            COALESCE(oc.score, -1),
            COALESCE(zoc.ethos_score, -1),
            COALESCE(es_social.score, -1),
            COALESCE(es_wallet.score, -1)
          ),
          -1
        ) >= ${params.ethosMin}
      )
    ORDER BY
      CASE
        WHEN NULLIF(
          GREATEST(
            COALESCE(cs.score, -1),
            COALESCE(cw.score, -1),
            COALESCE(oc.score, -1),
            COALESCE(zoc.ethos_score, -1),
            COALESCE(es_social.score, -1),
            COALESCE(es_wallet.score, -1)
          ),
          -1
        ) IS NULL
        THEN 1
        ELSE 0
      END ASC,
      NULLIF(
        GREATEST(
          COALESCE(cs.score, -1),
          COALESCE(cw.score, -1),
          COALESCE(oc.score, -1),
          COALESCE(zoc.ethos_score, -1),
          COALESCE(es_social.score, -1),
          COALESCE(es_wallet.score, -1)
        ),
        -1
      ) DESC NULLS LAST,
      rcc.volume_24h_usd DESC NULLS LAST,
      rcc.market_cap_usd DESC NULLS LAST,
      rcc.creator_address ASC
    OFFSET 0
    LIMIT ${candidateLimit};
  `

    candidateRows = (rows.rows ?? []) as Array<{
      coin_address: string
      creator_address: string
      twitter_username: string | null
      zora_handle: string | null
      created_at: string | null
      market_cap_usd: string | number | null
      volume_24h_usd: string | number | null
      fees_24h_usd: string | number | null
      ethos_score: number | string | null
      ethos_level: string | null
      canonical_social_score: number | string | null
      canonical_wallet_score: number | string | null
      owner_class_csw_score: number | string | null
      owner_class_eoa_score: number | string | null
      social_cached_score: number | string | null
      wallet_cached_score: number | string | null
      ethos_score_source: string | null
    }>
  }

  const normalizedCandidateAddresses = candidateRows.map((row) => String(row.creator_address).toLowerCase())
  const liveEthosMap =
    normalizedCandidateAddresses.length > 0
      ? await resolveCreatorEthosByAddress(normalizedCandidateAddresses)
      : new Map()

  const mergedEthosForRow = (row: EthosSortedCreatorRow) => {
    const creatorAddress = String(row.creator_address).toLowerCase()
    const projectionScore = toFiniteNumberOrNull(row.ethos_score)
    const projectionEntry =
      projectionScore != null
        ? {
            creatorAddress,
            score: projectionScore,
            level: typeof row.ethos_level === 'string' ? row.ethos_level : null,
            source: typeof row.ethos_score_source === 'string' ? row.ethos_score_source : null,
          }
        : null
    const live = liveEthosMap.get(creatorAddress)
    return mergeCreatorEthosScores(projectionEntry, live, live?.source ?? null)
  }

  candidateRows.sort((a, b) => {
    const aScore = mergedEthosForRow(a).score ?? Number.NEGATIVE_INFINITY
    const bScore = mergedEthosForRow(b).score ?? Number.NEGATIVE_INFINITY
    if (aScore !== bScore) return bScore - aScore
    const aVol = toFiniteNumberOrNull(a.volume_24h_usd) ?? Number.NEGATIVE_INFINITY
    const bVol = toFiniteNumberOrNull(b.volume_24h_usd) ?? Number.NEGATIVE_INFINITY
    if (aVol !== bVol) return bVol - aVol
    const aMcap = toFiniteNumberOrNull(a.market_cap_usd) ?? Number.NEGATIVE_INFINITY
    const bMcap = toFiniteNumberOrNull(b.market_cap_usd) ?? Number.NEGATIVE_INFINITY
    if (aMcap !== bMcap) return bMcap - aMcap
    return String(a.creator_address).localeCompare(String(b.creator_address))
  })

  candidateRows = dedupeEthosSortedCreatorRows(candidateRows)

  const pageRows = candidateRows.slice(offset, offset + params.count)
  const hasNextPage = candidateRows.length > offset + params.count

  const freshUserkeys = Array.from(
    new Set(
      pageRows
        .map((row) => {
          const twitterUsername = typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : ''
          if (twitterUsername) return twitterUsername
          const zoraHandle = typeof row.zora_handle === 'string' ? row.zora_handle.trim().toLowerCase() : ''
          return zoraHandle
        })
        .filter((username) => username.length > 0)
        .map((username) => `service:x.com:username:${username}`),
    ),
  )
  const freshScoreMap = freshUserkeys.length > 0 ? await fetchFreshEthosScoresByUserkeys(freshUserkeys) : new Map()

  const getFreshScoreForRow = (row: { twitter_username: string | null; zora_handle: string | null }): { score: number | null; level: string | null } => {
    const twitterUsername = typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : ''
    const zoraHandle = typeof row.zora_handle === 'string' ? row.zora_handle.trim().toLowerCase() : ''
    const username = twitterUsername || zoraHandle
    if (!username) return { score: null, level: null }
    const fresh = freshScoreMap.get(`service:x.com:username:${username}`) ?? null
    if (typeof fresh?.score !== 'number' || !Number.isFinite(fresh.score)) return { score: null, level: null }
    return { score: fresh.score, level: typeof fresh.level === 'string' ? fresh.level : null }
  }

  return assembleEthosSortedCreatorResponse({
    pageRows,
    offset,
    hasNextPage,
    usingProjectionRows: false,
    key: params.key,
    db,
    resolveNodeEthos: (row) => {
      const merged = mergedEthosForRow(row)
      const fresh = getFreshScoreForRow(row)
      const finalScore = Math.max(
        merged.score ?? Number.NEGATIVE_INFINITY,
        fresh.score ?? Number.NEGATIVE_INFINITY,
      )
      const normalizedFinalScore = Number.isFinite(finalScore) ? finalScore : null
      const finalLevel =
        (fresh.score != null && normalizedFinalScore === fresh.score
          ? fresh.level
          : merged.level ?? row.ethos_level) ?? null
      const baseSource =
        merged.source ??
        row.ethos_score_source ??
        resolveEthosScoreSource({
          canonicalSocial: toFiniteNumberOrNull(row.canonical_social_score),
          canonicalWallet: toFiniteNumberOrNull(row.canonical_wallet_score),
          ownerClassFromCsw: toFiniteNumberOrNull(row.owner_class_csw_score),
          ownerClassEoa: toFiniteNumberOrNull(row.owner_class_eoa_score),
          socialCached: toFiniteNumberOrNull(row.social_cached_score),
          walletCached: toFiniteNumberOrNull(row.wallet_cached_score),
        })
      const finalScoreSource =
        fresh.score != null && normalizedFinalScore === fresh.score ? 'social_fresh' : baseSource
      return {
        score: normalizedFinalScore,
        level: finalLevel,
        source: finalScoreSource,
      }
    },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const key = requireServerKey()
  if (!key) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const list = parseList(getStringQuery(req, 'list'))
  const sort = parseSort(getStringQuery(req, 'sort'))
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined
  const ethosMin = (() => {
    const raw = getNumberQuery(req, 'ethosMin')
    return Number.isFinite(raw ?? NaN) ? Number(raw) : null
  })()

  if (sort === 'ETHOS_SCORE' && isCreatorList(list)) {
    try {
      const data = await buildEthosSortedCreatorList({
        count,
        after: after ?? null,
        ethosMin,
        key,
      })
      setCache(res, 180)
      return res.status(200).json({
        success: true,
        data,
      })
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 500
      return res.status(status).json({
        success: false,
        error: e?.message || 'Failed to fetch Ethos-sorted creators',
      })
    }
  }

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const options = { count, after }
    
    // Map list type to SDK function
    const sdkFunctions: Record<ExploreList, () => Promise<any>> = {
      'TOP_GAINERS': () => sdk.getCoinsTopGainers(options),
      'TOP_VOLUME_24H': () => sdk.getCoinsTopVolume24h(options),
      'MOST_VALUABLE': () => sdk.getCoinsMostValuable(options),
      'NEW': () => sdk.getCoinsNew(options),
      'LAST_TRADED': () => sdk.getCoinsLastTraded(options),
      'LAST_TRADED_UNIQUE': () => sdk.getCoinsLastTradedUnique(options),
      // Trend-specific
      'MOST_VALUABLE_TRENDS': () => sdk.getMostValuableTrends(options),
      'NEW_TRENDS': () => sdk.getNewTrends(options),
      'TOP_VOLUME_TRENDS_24H': () => sdk.getTopVolumeTrends24h(options),
      'TRENDING_TRENDS': () => sdk.getTrendingTrends(options),
      // Creator-specific
      'NEW_CREATORS': () => sdk.getCreatorCoins(options),
      'MOST_VALUABLE_CREATORS': () => sdk.getMostValuableCreatorCoins(options),
      'TOP_VOLUME_CREATORS_24H': () => sdk.getExploreTopVolumeCreators24h(options),
      'FEATURED_CREATORS': () => sdk.getExploreFeaturedCreators(options),
      'TRENDING_CREATORS': () => sdk.getTrendingCreators(options),
      // Content-specific
      'FEATURED_VIDEOS': () => sdk.getExploreFeaturedVideos(options),
      'TRENDING_POSTS': () => sdk.getTrendingPosts(options),
      // Combined
      'TRENDING_ALL': () => sdk.getTrendingAll(options),
      'TOP_VOLUME_ALL_24H': () => sdk.getExploreTopVolumeAll24h(options),
      'NEW_ALL': () => sdk.getExploreNewAll(options),
      'MOST_VALUABLE_ALL': () => sdk.getMostValuableAll(options),
    }
    
    const fn = sdkFunctions[list] || (() => sdk.getCoinsTopGainers(options))
    const response = await fn()

    // Handle different response structures from both coin and creator list endpoints.
    const data = normalizeExploreResponse(response)
    if (isCreatorList(list)) {
      const edges = Array.isArray(data?.edges) ? data.edges : []
      const creatorAddresses = edges
        .map((edge: any) => edge?.node?.creatorAddress)
        .filter((value: unknown): value is string => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value))
        .map((address: string) => address.toLowerCase())
      const db = await getDb()
      const projectionMap =
        db && creatorAddresses.length > 0
          ? await loadCreatorEthosProjectionByAddresses(db, creatorAddresses)
          : new Map()
      const creatorEthosMap = await resolveCreatorEthosByAddress(creatorAddresses)

      for (const edge of edges) {
        if (!edge?.node || typeof edge.node !== 'object') continue
        const creatorAddress = typeof edge.node.creatorAddress === 'string' ? edge.node.creatorAddress.toLowerCase() : ''
        if (!creatorAddress) continue
        const merged = mergeCreatorEthosScores(
          projectionMap.get(creatorAddress),
          creatorEthosMap.get(creatorAddress),
          creatorEthosMap.get(creatorAddress)?.source ?? null,
        )
        if (merged.score == null) continue
        edge.node.ethosScore = merged.score
        edge.node.ethosLevel = merged.level
        edge.node.ethosScoreSource = merged.source
      }

      if (typeof ethosMin === 'number' && Number.isFinite(ethosMin)) {
        data.edges = edges.filter((edge: any) => {
          const score = edge?.node?.ethosScore
          return typeof score === 'number' && score >= ethosMin
        })
      }
    }

    const exploreEdges = Array.isArray(data?.edges) ? data.edges : []
    const db = await getDb()
    if (db && exploreEdges.length > 0) {
      await attachIndexedCoinTableFieldsToEdges(db, exploreEdges, sdk)
    }

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch explore list',
    })
  }
}


