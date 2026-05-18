import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { syncEthosUserkeyScores } from '../server/_lib/identity/ethosCanonicalScores.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

type Db = Awaited<ReturnType<typeof getDb>>

const ADDRESS_RE = /^0x[a-f0-9]{40}$/

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? '')
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const lowered = value.trim().toLowerCase()
  return ADDRESS_RE.test(lowered) ? lowered : null
}

function normalizeHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^@+/, '').toLowerCase()
  if (!normalized) return null
  if (/[\s<>]/.test(normalized)) return null
  return normalized
}

async function fetchCreatorBatch(params: {
  db: NonNullable<Db>
  offset: number
  limit: number
}): Promise<Array<{ creatorAddress: string; twitterUsername: string; volume24hUsd: number | null }>> {
  const baseRows = await params.db.sql`
    SELECT
      p.creator_address,
      p.volume_24h_usd
    FROM public.creator_ethos_projection p
    ORDER BY p.creator_address ASC
    LIMIT ${params.limit}
    OFFSET ${Math.max(0, params.offset)};
  `

  const creators = (baseRows.rows ?? [])
    .map((row: any) => {
      const creatorAddress = normalizeAddress(row.creator_address)
      const volume24hUsdRaw = typeof row.volume_24h_usd === 'number' ? row.volume_24h_usd : Number(row.volume_24h_usd)
      const volume24hUsd = Number.isFinite(volume24hUsdRaw) ? volume24hUsdRaw : null
      if (!creatorAddress) return null
      return { creatorAddress, volume24hUsd }
    })
    .filter((row): row is { creatorAddress: string; volume24hUsd: number | null } => Boolean(row))

  if (creators.length === 0) return []

  const creatorAddresses = creators.map((row) => row.creatorAddress)
  const profileRows = await params.db.sql`
    WITH input AS (
      SELECT unnest(${creatorAddresses}::text[]) AS creator_address
    ),
    profile_identity AS (
      SELECT
        i.creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY i.creator_address
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM input i
      JOIN zora_profiles p
        ON i.creator_address = lower(NULLIF(p.signing_eoa, ''))
        OR i.creator_address = lower(NULLIF(p.primary_wallet, ''))
        OR i.creator_address = lower(NULLIF(p.payout_recipient, ''))
        OR i.creator_address = lower(NULLIF(p.smart_wallet_address, ''))
        OR i.creator_address = lower(NULLIF(p.privy_wallet_address, ''))
    )
    SELECT creator_address, twitter_username
    FROM profile_identity
    WHERE rn = 1
      AND twitter_username IS NOT NULL
      AND trim(twitter_username) <> '';
  `

  const twitterMap = new Map<string, string>()
  for (const row of profileRows.rows ?? []) {
    const creatorAddress = normalizeAddress(row.creator_address)
    const twitterUsername = normalizeHandle(row.twitter_username)
    if (!creatorAddress || !twitterUsername) continue
    twitterMap.set(creatorAddress, twitterUsername)
  }

  return creators
    .map((row: any) => {
      const twitterUsername = twitterMap.get(row.creatorAddress) ?? null
      if (!twitterUsername) return null
      return { creatorAddress: row.creatorAddress, twitterUsername, volume24hUsd: row.volume24hUsd }
    })
    .filter((row): row is { creatorAddress: string; twitterUsername: string; volume24hUsd: number | null } => Boolean(row))
}

async function refreshProjectionScoresForCreators(params: {
  db: NonNullable<Db>
  creatorAddresses: string[]
}): Promise<number> {
  if (params.creatorAddresses.length === 0) return 0
  const result = await params.db.sql`
    WITH input AS (
      SELECT unnest(${params.creatorAddresses}::text[]) AS creator_address
    ),
    resolved AS (
      SELECT
        p.creator_address,
        p.twitter_username,
        cs.score AS canonical_social_score,
        cs.level AS canonical_social_level,
        cs.updated_at AS canonical_social_updated_at,
        cw.score AS canonical_wallet_score,
        cw.level AS canonical_wallet_level,
        cw.updated_at AS canonical_wallet_updated_at,
        es_social.score AS social_cached_score,
        es_social.level AS social_cached_level,
        es_social.fetched_at AS social_cached_fetched_at,
        es_wallet.score AS wallet_cached_score,
        es_wallet.level AS wallet_cached_level,
        es_wallet.fetched_at AS wallet_cached_fetched_at
      FROM input i
      JOIN public.creator_ethos_projection p
        ON p.creator_address = i.creator_address
      LEFT JOIN public.user_ethos_identity_keys uiek_social
        ON p.twitter_username IS NOT NULL
        AND uiek_social.ethos_userkey = ('service:x.com:username:' || lower(trim(p.twitter_username)))
      LEFT JOIN public.canonical_ethos_scores cs
        ON cs.canonical_user_id = uiek_social.canonical_user_id
      LEFT JOIN public.user_ethos_identity_keys uiek_wallet
        ON uiek_wallet.ethos_userkey = ('address:' || p.creator_address)
      LEFT JOIN public.canonical_ethos_scores cw
        ON cw.canonical_user_id = uiek_wallet.canonical_user_id
      LEFT JOIN public.ethos_userkey_scores es_social
        ON p.twitter_username IS NOT NULL
        AND es_social.ethos_userkey = ('service:x.com:username:' || lower(trim(p.twitter_username)))
        AND es_social.status = 'matched'
      LEFT JOIN public.ethos_userkey_scores es_wallet
        ON es_wallet.ethos_userkey = ('address:' || p.creator_address)
        AND es_wallet.status = 'matched'
    ),
    computed AS (
      SELECT
        creator_address,
        NULLIF(
          GREATEST(
            COALESCE(canonical_social_score, -1),
            COALESCE(canonical_wallet_score, -1),
            COALESCE(social_cached_score, -1),
            COALESCE(wallet_cached_score, -1)
          ),
          -1
        ) AS ethos_score,
        CASE
          WHEN canonical_social_score IS NOT NULL
            AND canonical_social_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN canonical_social_level
          WHEN canonical_wallet_score IS NOT NULL
            AND canonical_wallet_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN canonical_wallet_level
          WHEN social_cached_score IS NOT NULL
            AND social_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN social_cached_level
          WHEN wallet_cached_score IS NOT NULL
            AND wallet_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN wallet_cached_level
          ELSE NULL
        END AS ethos_level,
        CASE
          WHEN canonical_social_score IS NOT NULL
            AND canonical_social_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'canonical_social'
          WHEN canonical_wallet_score IS NOT NULL
            AND canonical_wallet_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'canonical_wallet'
          WHEN social_cached_score IS NOT NULL
            AND social_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'social_cached'
          WHEN wallet_cached_score IS NOT NULL
            AND wallet_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'wallet_cached'
          ELSE NULL
        END AS ethos_score_source,
        GREATEST(
          COALESCE(canonical_social_updated_at, '-infinity'::timestamptz),
          COALESCE(canonical_wallet_updated_at, '-infinity'::timestamptz),
          COALESCE(social_cached_fetched_at, '-infinity'::timestamptz),
          COALESCE(wallet_cached_fetched_at, '-infinity'::timestamptz)
        ) AS score_updated_at
      FROM resolved
    )
    UPDATE public.creator_ethos_projection p
    SET
      ethos_score = c.ethos_score,
      ethos_level = c.ethos_level,
      ethos_score_source = c.ethos_score_source,
      score_updated_at = CASE
        WHEN c.score_updated_at = '-infinity'::timestamptz THEN NULL
        ELSE c.score_updated_at
      END,
      refreshed_at = NOW()
    FROM computed c
    WHERE p.creator_address = c.creator_address;
  `
  return Math.max(0, Number(result.rowCount ?? 0))
}

async function hydrateProjectionTwitterBatch(params: {
  db: NonNullable<Db>
  afterAddress: string | null
  limit: number
}): Promise<{ scanned: number; updated: number; cursorAfter: string | null }> {
  const candidates = await params.db.sql`
    SELECT p.creator_address
    FROM public.creator_ethos_projection p
    WHERE (p.twitter_username IS NULL OR trim(p.twitter_username) = '')
      AND (${params.afterAddress}::text IS NULL OR p.creator_address > ${params.afterAddress})
    ORDER BY p.creator_address ASC
    LIMIT ${params.limit};
  `
  const creatorAddresses = (candidates.rows ?? [])
    .map((row: any) => normalizeAddress(row.creator_address))
    .filter((value: string | null): value is string => Boolean(value))
  if (creatorAddresses.length === 0) {
    return { scanned: 0, updated: 0, cursorAfter: params.afterAddress }
  }

  const updated = await params.db.sql`
    WITH input AS (
      SELECT unnest(${creatorAddresses}::text[]) AS creator_address
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
        ON i.creator_address = lower(NULLIF(p.signing_eoa, ''))
        OR i.creator_address = lower(NULLIF(p.primary_wallet, ''))
        OR i.creator_address = lower(NULLIF(p.payout_recipient, ''))
        OR i.creator_address = lower(NULLIF(p.smart_wallet_address, ''))
        OR i.creator_address = lower(NULLIF(p.privy_wallet_address, ''))
    ),
    best AS (
      SELECT creator_address, twitter_username, zora_handle
      FROM profile_identity
      WHERE rn = 1
    )
    UPDATE public.creator_ethos_projection p
    SET
      twitter_username = b.twitter_username,
      zora_handle = COALESCE(p.zora_handle, b.zora_handle),
      refreshed_at = NOW()
    FROM best b
    WHERE p.creator_address = b.creator_address
      AND b.twitter_username IS NOT NULL;
  `
  return {
    scanned: creatorAddresses.length,
    updated: Math.max(0, Number(updated.rowCount ?? 0)),
    cursorAfter: creatorAddresses[creatorAddresses.length - 1] ?? params.afterAddress,
  }
}

async function refreshProjectionForCreators(params: {
  db: NonNullable<Db>
  creatorAddresses: string[]
}): Promise<number> {
  if (params.creatorAddresses.length === 0) return 0
  const result = await params.db.sql`
    WITH input AS (
      SELECT unnest(${params.creatorAddresses}::text[]) AS creator_address
    ),
    ranked_creator_coins AS (
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
      JOIN input i
        ON lower(cc.creator_address) = i.creator_address
      WHERE cc.chain_id = 8453
    ),
    top_creator_coin AS (
      SELECT *
      FROM ranked_creator_coins
      WHERE creator_coin_rank = 1
    ),
    profile_identity AS (
      SELECT
        tcc.creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        NULLIF(lower(trim(p.handle)), '') AS zora_handle,
        p.last_refreshed_at,
        ROW_NUMBER() OVER (
          PARTITION BY tcc.creator_address
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM top_creator_coin tcc
      JOIN zora_profiles p
        ON lower(NULLIF(p.signing_eoa, '')) = tcc.creator_address
        OR lower(NULLIF(p.primary_wallet, '')) = tcc.creator_address
        OR lower(NULLIF(p.payout_recipient, '')) = tcc.creator_address
        OR lower(NULLIF(p.smart_wallet_address, '')) = tcc.creator_address
        OR lower(NULLIF(p.privy_wallet_address, '')) = tcc.creator_address
    ),
    profile_best AS (
      SELECT creator_address, twitter_username, zora_handle
      FROM profile_identity
      WHERE rn = 1
    ),
    candidate_scores AS (
      SELECT
        tcc.creator_address,
        tcc.coin_address,
        tcc.created_at,
        tcc.market_cap_usd,
        tcc.volume_24h_usd,
        pb.twitter_username,
        pb.zora_handle,
        cs.score AS canonical_social_score,
        cs.level AS canonical_social_level,
        cs.updated_at AS canonical_social_updated_at,
        cw.score AS canonical_wallet_score,
        cw.level AS canonical_wallet_level,
        cw.updated_at AS canonical_wallet_updated_at,
        oc.score AS owner_class_csw_score,
        oc.level AS owner_class_csw_level,
        oc.last_updated_at AS owner_class_csw_updated_at,
        zoc.ethos_score AS owner_class_eoa_score,
        zoc.ethos_level AS owner_class_eoa_level,
        zoc.last_updated_at AS owner_class_eoa_updated_at,
        es_social.score AS social_cached_score,
        es_social.level AS social_cached_level,
        es_social.fetched_at AS social_cached_fetched_at,
        es_wallet.score AS wallet_cached_score,
        es_wallet.level AS wallet_cached_level,
        es_wallet.fetched_at AS wallet_cached_fetched_at
      FROM top_creator_coin tcc
      LEFT JOIN profile_best pb
        ON pb.creator_address = tcc.creator_address
      LEFT JOIN user_ethos_identity_keys uiek_social
        ON pb.twitter_username IS NOT NULL
        AND uiek_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      LEFT JOIN canonical_ethos_scores cs
        ON cs.canonical_user_id = uiek_social.canonical_user_id
      LEFT JOIN user_ethos_identity_keys uiek_wallet
        ON uiek_wallet.ethos_userkey = ('address:' || tcc.creator_address)
      LEFT JOIN canonical_ethos_scores cw
        ON cw.canonical_user_id = uiek_wallet.canonical_user_id
      LEFT JOIN LATERAL (
        SELECT zoc1.ethos_score AS score, zoc1.ethos_level AS level, zoc1.last_updated_at
        FROM zora_csw_owners zco
        CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
        JOIN zora_csw_owner_class zoc1
          ON lower(zoc1.eoa) = lower(owner_eoa)
        WHERE lower(zco.csw_address) = tcc.creator_address
        ORDER BY zoc1.ethos_score DESC NULLS LAST, zoc1.last_updated_at DESC NULLS LAST
        LIMIT 1
      ) oc ON true
      LEFT JOIN zora_csw_owner_class zoc
        ON lower(zoc.eoa) = tcc.creator_address
      LEFT JOIN ethos_userkey_scores es_social
        ON pb.twitter_username IS NOT NULL
        AND es_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
        AND es_social.status = 'matched'
      LEFT JOIN ethos_userkey_scores es_wallet
        ON es_wallet.ethos_userkey = ('address:' || tcc.creator_address)
        AND es_wallet.status = 'matched'
    ),
    scored AS (
      SELECT
        creator_address,
        coin_address,
        created_at,
        market_cap_usd,
        volume_24h_usd,
        twitter_username,
        zora_handle,
        NULLIF(
          GREATEST(
            COALESCE(canonical_social_score, -1),
            COALESCE(canonical_wallet_score, -1),
            COALESCE(owner_class_csw_score, -1),
            COALESCE(owner_class_eoa_score, -1),
            COALESCE(social_cached_score, -1),
            COALESCE(wallet_cached_score, -1)
          ),
          -1
        ) AS ethos_score,
        CASE
          WHEN canonical_social_score IS NOT NULL
            AND canonical_social_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN canonical_social_level
          WHEN canonical_wallet_score IS NOT NULL
            AND canonical_wallet_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN canonical_wallet_level
          WHEN owner_class_csw_score IS NOT NULL
            AND owner_class_csw_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN owner_class_csw_level
          WHEN owner_class_eoa_score IS NOT NULL
            AND owner_class_eoa_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN owner_class_eoa_level
          WHEN social_cached_score IS NOT NULL
            AND social_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN social_cached_level
          WHEN wallet_cached_score IS NOT NULL
            AND wallet_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN wallet_cached_level
          ELSE NULL
        END AS ethos_level,
        CASE
          WHEN canonical_social_score IS NOT NULL
            AND canonical_social_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'canonical_social'
          WHEN canonical_wallet_score IS NOT NULL
            AND canonical_wallet_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'canonical_wallet'
          WHEN owner_class_csw_score IS NOT NULL
            AND owner_class_csw_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'owner_class_csw'
          WHEN owner_class_eoa_score IS NOT NULL
            AND owner_class_eoa_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'owner_class_eoa'
          WHEN social_cached_score IS NOT NULL
            AND social_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'social_cached'
          WHEN wallet_cached_score IS NOT NULL
            AND wallet_cached_score = GREATEST(
              COALESCE(canonical_social_score, -1),
              COALESCE(canonical_wallet_score, -1),
              COALESCE(owner_class_csw_score, -1),
              COALESCE(owner_class_eoa_score, -1),
              COALESCE(social_cached_score, -1),
              COALESCE(wallet_cached_score, -1)
            ) THEN 'wallet_cached'
          ELSE NULL
        END AS ethos_score_source,
        GREATEST(
          COALESCE(canonical_social_updated_at, '-infinity'::timestamptz),
          COALESCE(canonical_wallet_updated_at, '-infinity'::timestamptz),
          COALESCE(owner_class_csw_updated_at, '-infinity'::timestamptz),
          COALESCE(owner_class_eoa_updated_at, '-infinity'::timestamptz),
          COALESCE(social_cached_fetched_at, '-infinity'::timestamptz),
          COALESCE(wallet_cached_fetched_at, '-infinity'::timestamptz)
        ) AS score_updated_at
      FROM candidate_scores
    )
    INSERT INTO public.creator_ethos_projection (
      creator_address,
      coin_address,
      created_at,
      market_cap_usd,
      volume_24h_usd,
      twitter_username,
      zora_handle,
      ethos_score,
      ethos_level,
      ethos_score_source,
      score_updated_at,
      refreshed_at
    )
    SELECT
      creator_address,
      coin_address,
      created_at,
      market_cap_usd,
      volume_24h_usd,
      twitter_username,
      zora_handle,
      ethos_score,
      ethos_level,
      ethos_score_source,
      CASE
        WHEN score_updated_at = '-infinity'::timestamptz THEN NULL
        ELSE score_updated_at
      END AS score_updated_at,
      NOW()
    FROM scored
    ON CONFLICT (creator_address) DO UPDATE SET
      coin_address = EXCLUDED.coin_address,
      created_at = EXCLUDED.created_at,
      market_cap_usd = EXCLUDED.market_cap_usd,
      volume_24h_usd = EXCLUDED.volume_24h_usd,
      twitter_username = EXCLUDED.twitter_username,
      zora_handle = EXCLUDED.zora_handle,
      ethos_score = EXCLUDED.ethos_score,
      ethos_level = EXCLUDED.ethos_level,
      ethos_score_source = EXCLUDED.ethos_score_source,
      score_updated_at = EXCLUDED.score_updated_at,
      refreshed_at = NOW();
  `
  return Math.max(0, Number(result.rowCount ?? 0))
}

async function readProjectionSummary(db: NonNullable<Db>): Promise<{
  total: number
  scored: number
  socialCached: number
  canonicalSocial: number
  walletCached: number
}> {
  const result = await db.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE ethos_score IS NOT NULL)::bigint AS scored,
      COUNT(*) FILTER (WHERE ethos_score_source = 'social_cached')::bigint AS social_cached,
      COUNT(*) FILTER (WHERE ethos_score_source = 'canonical_social')::bigint AS canonical_social,
      COUNT(*) FILTER (WHERE ethos_score_source = 'wallet_cached')::bigint AS wallet_cached
    FROM public.creator_ethos_projection;
  `
  const row = result.rows?.[0] ?? {}
  return {
    total: Number(row.total ?? 0),
    scored: Number(row.scored ?? 0),
    socialCached: Number(row.social_cached ?? 0),
    canonicalSocial: Number(row.canonical_social ?? 0),
    walletCached: Number(row.wallet_cached ?? 0),
  }
}

async function main(): Promise<void> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const batchSize = readIntEnv('ETHOS_CREATOR_SOCIAL_BACKFILL_BATCH_SIZE', 400, 50, 2000)
  const maxBatches = readIntEnv('ETHOS_CREATOR_SOCIAL_BACKFILL_MAX_BATCHES', 50, 1, 1000)
  const sleepMs = readIntEnv('ETHOS_CREATOR_SOCIAL_BACKFILL_SLEEP_MS', 300, 0, 2000)
  const hydrateBatchSize = readIntEnv('ETHOS_CREATOR_TWITTER_HYDRATE_BATCH_SIZE', 400, 50, 2000)
  const hydrateMaxBatches = readIntEnv('ETHOS_CREATOR_TWITTER_HYDRATE_MAX_BATCHES', 50, 1, 1000)

  const before = await readProjectionSummary(db)
  console.info('[ethos-creator-social-backfill] before', before)

  let hydrateCursor: string | null = null
  let hydratedScanned = 0
  let hydratedUpdated = 0
  for (let batch = 1; batch <= hydrateMaxBatches; batch += 1) {
    const hydrated = await hydrateProjectionTwitterBatch({
      db,
      afterAddress: hydrateCursor,
      limit: hydrateBatchSize,
    })
    if (hydrated.scanned === 0) {
      console.info('[ethos-creator-social-backfill] hydrate_done_no_more_batches', { batch })
      break
    }
    hydratedScanned += hydrated.scanned
    hydratedUpdated += hydrated.updated
    hydrateCursor = hydrated.cursorAfter
    console.info('[ethos-creator-social-backfill] hydrate_batch', {
      batch,
      scanned: hydrated.scanned,
      updated: hydrated.updated,
      cursorAfter: hydrateCursor,
    })
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs))
    }
  }

  let processedCreators = 0
  let processedUserkeys = 0
  let syncedUserkeys = 0
  let refreshedRows = 0

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const offset = (batch - 1) * batchSize
    const creators = await fetchCreatorBatch({
      db,
      offset,
      limit: batchSize,
    })
    if (creators.length === 0) {
      console.info('[ethos-creator-social-backfill] done_no_more_batches', { batch })
      break
    }

    const creatorAddresses = creators.map((row) => row.creatorAddress)
    const userkeys = Array.from(new Set(
      creators.map((row) => `service:x.com:username:${row.twitterUsername}`),
    ))

    const syncResult = await syncEthosUserkeyScores({
      db,
      forceUserkeys: userkeys,
      chunkSize: 100,
    })

    const refreshed = await refreshProjectionScoresForCreators({
      db,
      creatorAddresses,
    })

    processedCreators += creatorAddresses.length
    processedUserkeys += userkeys.length
    syncedUserkeys += syncResult.updated
    refreshedRows += refreshed

    console.info('[ethos-creator-social-backfill] batch', {
      batch,
      offset,
      creators: creatorAddresses.length,
      userkeys: userkeys.length,
      syncedAttempted: syncResult.attempted,
      syncedUpdated: syncResult.updated,
      syncedFailed: syncResult.failed,
      refreshedRows: refreshed,
    })

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs))
    }
  }

  const after = await readProjectionSummary(db)
  console.info('[ethos-creator-social-backfill] after', after)
  console.info('[ethos-creator-social-backfill] totals', {
    hydratedScanned,
    hydratedUpdated,
    processedCreators,
    processedUserkeys,
    syncedUserkeys,
    refreshedRows,
  })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown_error'
  console.error('[ethos-creator-social-backfill] failed', { error: message })
  process.exit(1)
})
