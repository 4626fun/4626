import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'
import { getDb } from '../../../packages/server-core/src/index.js'
import { fetchFreshEthosScoresByUserkeys } from '../../../server/_lib/chat/ethosClient.js'

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
    SELECT
      creator_address,
      coin_address,
      twitter_username,
      zora_handle,
      created_at,
      market_cap_usd,
      volume_24h_usd,
      ethos_score,
      ethos_level,
      ethos_score_source
    FROM public.creator_ethos_projection
    WHERE (
      ${params.ethosMin}::numeric IS NULL
      OR (ethos_score IS NOT NULL AND ethos_score >= ${params.ethosMin})
    )
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

type CreatorEthosResolved = {
  creatorAddress: string
  score: number | null
  level: string | null
}

function resolveEthosScoreSource(candidates: {
  canonicalSocial: number | null
  canonicalWallet: number | null
  ownerClassFromCsw: number | null
  ownerClassEoa: number | null
  socialCached: number | null
  walletCached: number | null
}): string | null {
  const entries: Array<{ source: string; score: number | null }> = [
    { source: 'canonical_social', score: candidates.canonicalSocial },
    { source: 'canonical_wallet', score: candidates.canonicalWallet },
    { source: 'owner_class_csw', score: candidates.ownerClassFromCsw },
    { source: 'owner_class_eoa', score: candidates.ownerClassEoa },
    { source: 'social_cached', score: candidates.socialCached },
    { source: 'wallet_cached', score: candidates.walletCached },
  ]
  const scored = entries.filter((entry): entry is { source: string; score: number } =>
    typeof entry.score === 'number' && Number.isFinite(entry.score),
  )
  if (scored.length === 0) return null
  const maxScore = Math.max(...scored.map((entry) => entry.score))
  return scored.find((entry) => entry.score === maxScore)?.source ?? null
}

async function resolveCreatorEthosByAddress(creatorAddresses: string[]): Promise<Map<string, CreatorEthosResolved>> {
  const normalizedAddresses = Array.from(
    new Set(
      creatorAddresses
        .map((address) => String(address || '').trim().toLowerCase())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  )
  if (normalizedAddresses.length === 0) return new Map()

  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const rows = await db.sql`
    WITH input AS (
      SELECT unnest(${normalizedAddresses}::text[]) AS creator_address
    ),
    profile_identity AS (
      SELECT
        i.creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        NULLIF(lower(trim(p.handle)), '') AS zora_handle,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY i.creator_address
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM input i
      JOIN zora_profiles p
        ON lower(i.creator_address) = lower(NULLIF(p.signing_eoa, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.primary_wallet, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.payout_recipient, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.smart_wallet_address, ''))
        OR lower(i.creator_address) = lower(NULLIF(p.privy_wallet_address, ''))
    ),
    profile_best AS (
      SELECT creator_address, twitter_username, zora_handle
      FROM profile_identity
      WHERE rn = 1
    ),
    canonical_wallet AS (
      SELECT
        i.creator_address,
        ces.score,
        ces.level
      FROM input i
      LEFT JOIN user_ethos_identity_keys uiek
        ON uiek.ethos_userkey = ('address:' || i.creator_address)
      LEFT JOIN canonical_ethos_scores ces
        ON ces.canonical_user_id = uiek.canonical_user_id
    ),
    canonical_social AS (
      SELECT
        i.creator_address,
        ces.score,
        ces.level
      FROM input i
      LEFT JOIN profile_best pb
        ON pb.creator_address = i.creator_address
      LEFT JOIN user_ethos_identity_keys uiek
        ON pb.twitter_username IS NOT NULL
        AND uiek.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      LEFT JOIN canonical_ethos_scores ces
        ON ces.canonical_user_id = uiek.canonical_user_id
    ),
    owner_class_from_csw AS (
      SELECT DISTINCT ON (i.creator_address)
        i.creator_address,
        zoc.ethos_score AS score,
        zoc.ethos_level AS level
      FROM input i
      JOIN zora_csw_owners zco
        ON lower(zco.csw_address) = i.creator_address
      CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
      JOIN zora_csw_owner_class zoc
        ON lower(zoc.eoa) = lower(owner_eoa)
      ORDER BY i.creator_address, zoc.ethos_score DESC NULLS LAST, zoc.last_updated_at DESC NULLS LAST
    )
    SELECT
      i.creator_address,
      pb.twitter_username,
      pb.zora_handle,
      cs.score AS canonical_social_score,
      cs.level AS canonical_social_level,
      cw.score AS canonical_wallet_score,
      cw.level AS canonical_wallet_level,
      zoc.ethos_score AS owner_class_score,
      zoc.ethos_level AS owner_class_level,
      oc.score AS owner_class_csw_score,
      oc.level AS owner_class_csw_level,
      es_social.score AS social_score,
      es_social.level AS social_level,
      es_wallet.score AS wallet_score,
      es_wallet.level AS wallet_level
    FROM input i
    LEFT JOIN profile_best pb
      ON pb.creator_address = i.creator_address
    LEFT JOIN canonical_social cs
      ON cs.creator_address = i.creator_address
    LEFT JOIN canonical_wallet cw
      ON cw.creator_address = i.creator_address
    LEFT JOIN zora_csw_owner_class zoc
      ON lower(zoc.eoa) = i.creator_address
    LEFT JOIN owner_class_from_csw oc
      ON oc.creator_address = i.creator_address
    LEFT JOIN ethos_userkey_scores es_social
      ON pb.twitter_username IS NOT NULL
      AND es_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      AND es_social.status = 'matched'
    LEFT JOIN ethos_userkey_scores es_wallet
      ON es_wallet.ethos_userkey = ('address:' || i.creator_address)
      AND es_wallet.status = 'matched';
  `

  const typed = (rows.rows ?? []) as Array<{
    creator_address: string
    twitter_username: string | null
    zora_handle: string | null
    canonical_social_score: number | string | null
    canonical_social_level: string | null
    canonical_wallet_score: number | string | null
    canonical_wallet_level: string | null
    owner_class_score: number | string | null
    owner_class_level: string | null
    owner_class_csw_score: number | string | null
    owner_class_csw_level: string | null
    social_score: number | string | null
    social_level: string | null
    wallet_score: number | string | null
    wallet_level: string | null
  }>

  const socialUserkeys = Array.from(
    new Set(
      typed
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
  const socialFreshMap = socialUserkeys.length > 0 ? await fetchFreshEthosScoresByUserkeys(socialUserkeys) : new Map()

  const out = new Map<string, CreatorEthosResolved>()
  for (const row of typed) {
    const creatorAddress = String(row.creator_address).toLowerCase()
    const twitterUsername = typeof row.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : ''
    const zoraHandle = typeof row.zora_handle === 'string' ? row.zora_handle.trim().toLowerCase() : ''
    const socialIdentifier = twitterUsername || zoraHandle
    const socialFresh = socialIdentifier ? socialFreshMap.get(`service:x.com:username:${socialIdentifier}`) ?? null : null
    const canonicalSocialScore = toFiniteNumberOrNull(row.canonical_social_score)
    const canonicalWalletScore = toFiniteNumberOrNull(row.canonical_wallet_score)
    const ownerClassScore = toFiniteNumberOrNull(row.owner_class_score)
    const ownerClassCswScore = toFiniteNumberOrNull(row.owner_class_csw_score)
    const dbSocialScore = toFiniteNumberOrNull(row.social_score)
    const dbWalletScore = toFiniteNumberOrNull(row.wallet_score)
    const scoreCandidates = [
      canonicalSocialScore,
      canonicalWalletScore,
      ownerClassScore,
      ownerClassCswScore,
      dbSocialScore,
      dbWalletScore,
      typeof socialFresh?.score === 'number' ? socialFresh.score : null,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const score = scoreCandidates.length > 0 ? Math.max(...scoreCandidates) : null
    const level = typeof socialFresh?.level === 'string'
      ? socialFresh.level
      : row.canonical_social_level
        ?? row.canonical_wallet_level
        ?? row.owner_class_csw_level
        ?? row.owner_class_level
        ?? row.social_level
        ?? row.wallet_level
        ?? null
    out.set(creatorAddress, {
      creatorAddress,
      score,
      level,
    })
  }

  return out
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

  const freshUserkeys = Array.from(
    new Set(
      candidateRows
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

  candidateRows.sort((a, b) => {
    const aBase = toFiniteNumberOrNull(a.ethos_score)
    const bBase = toFiniteNumberOrNull(b.ethos_score)
    const aFresh = getFreshScoreForRow(a).score
    const bFresh = getFreshScoreForRow(b).score
    const aScore = Math.max(aBase ?? Number.NEGATIVE_INFINITY, aFresh ?? Number.NEGATIVE_INFINITY)
    const bScore = Math.max(bBase ?? Number.NEGATIVE_INFINITY, bFresh ?? Number.NEGATIVE_INFINITY)
    if (aScore !== bScore) return bScore - aScore
    const aVol = toFiniteNumberOrNull(a.volume_24h_usd) ?? Number.NEGATIVE_INFINITY
    const bVol = toFiniteNumberOrNull(b.volume_24h_usd) ?? Number.NEGATIVE_INFINITY
    if (aVol !== bVol) return bVol - aVol
    const aMcap = toFiniteNumberOrNull(a.market_cap_usd) ?? Number.NEGATIVE_INFINITY
    const bMcap = toFiniteNumberOrNull(b.market_cap_usd) ?? Number.NEGATIVE_INFINITY
    if (aMcap !== bMcap) return bMcap - aMcap
    return String(a.creator_address).localeCompare(String(b.creator_address))
  })

  const pageRows = usingProjectionRows
    ? candidateRows.slice(0, params.count)
    : candidateRows.slice(offset, offset + params.count)
  const hasNextPage = usingProjectionRows
    ? candidateRows.length > params.count
    : candidateRows.length > offset + params.count

  let coinDetails = new Map<string, any>()
  if (params.key) {
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(params.key)
      const responses = await Promise.allSettled(
        pageRows.map((row) => sdk.getCoin({ address: row.coin_address, chain: 8453 })),
      )
      responses.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const row = pageRows[index]
        if (!row) return
        const token = result.value?.data?.zora20Token
        if (token) coinDetails.set(row.coin_address.toLowerCase(), token)
      })
    } catch {
      coinDetails = new Map()
    }
  }

  const edges = pageRows.map((row, idx) => {
    const detail = coinDetails.get(String(row.coin_address).toLowerCase()) ?? null
    const address = String(row.coin_address).toLowerCase()
    const creatorAddress = String(row.creator_address).toLowerCase()
    const displayName = typeof detail?.name === 'string' && detail.name.trim() ? detail.name.trim() : shortSymbol(address)
    const displaySymbol = typeof detail?.symbol === 'string' && detail.symbol.trim() ? detail.symbol.trim() : shortSymbol(address)
    const marketCap = toNumericString(detail?.marketCap) ?? toNumericString(row.market_cap_usd)
    const volume24h = toNumericString(detail?.volume24h) ?? toNumericString(row.volume_24h_usd)
    const creatorProfile = detail?.creatorProfile
    const baseScore = toFiniteNumberOrNull(row.ethos_score)
    const fresh = getFreshScoreForRow(row)
    const finalScore = Math.max(baseScore ?? Number.NEGATIVE_INFINITY, fresh.score ?? Number.NEGATIVE_INFINITY)
    const normalizedFinalScore = Number.isFinite(finalScore) ? finalScore : null
    const finalLevel = (fresh.score != null && normalizedFinalScore === fresh.score ? fresh.level : row.ethos_level) ?? null
    const baseSource = row.ethos_score_source ?? resolveEthosScoreSource({
      canonicalSocial: toFiniteNumberOrNull(row.canonical_social_score),
      canonicalWallet: toFiniteNumberOrNull(row.canonical_wallet_score),
      ownerClassFromCsw: toFiniteNumberOrNull(row.owner_class_csw_score),
      ownerClassEoa: toFiniteNumberOrNull(row.owner_class_eoa_score),
      socialCached: toFiniteNumberOrNull(row.social_cached_score),
      walletCached: toFiniteNumberOrNull(row.wallet_cached_score),
    })
    const finalScoreSource =
      fresh.score != null && normalizedFinalScore === fresh.score
        ? 'social_fresh'
        : baseSource
    return {
      cursor: String(offset + idx + 1),
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
        volume24h,
        totalVolume: typeof detail?.totalVolume === 'string' ? detail.totalVolume : undefined,
        uniqueHolders: typeof detail?.uniqueHolders === 'number' ? detail.uniqueHolders : undefined,
        mediaContent: detail?.mediaContent,
        creatorProfile,
        ethosScore: normalizedFinalScore,
        ethosLevel: finalLevel,
        ethosScoreSource: finalScoreSource,
      },
    }
  })

  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(offset + params.count) : null,
    },
    count: edges.length,
  }
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
      setCache(res, 120)
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
      const creatorEthosMap = await resolveCreatorEthosByAddress(creatorAddresses)

      for (const edge of edges) {
        if (!edge?.node || typeof edge.node !== 'object') continue
        const creatorAddress = typeof edge.node.creatorAddress === 'string' ? edge.node.creatorAddress.toLowerCase() : ''
        const resolvedEthos = creatorEthosMap.get(creatorAddress)
        if (!resolvedEthos) continue
        edge.node.ethosScore = resolvedEthos.score
        edge.node.ethosLevel = resolvedEthos.level
      }

      if (typeof ethosMin === 'number' && Number.isFinite(ethosMin)) {
        data.edges = edges.filter((edge: any) => {
          const score = edge?.node?.ethosScore
          return typeof score === 'number' && score >= ethosMin
        })
      }
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


