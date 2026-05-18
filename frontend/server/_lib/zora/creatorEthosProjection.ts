type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[]; rowCount?: number }>
}

declare const process: { env: Record<string, string | undefined> }

let schemaChecked = false
let schemaCheckPromise: Promise<boolean> | null = null

async function hasProjectionTable(db: Db): Promise<boolean> {
  const result = await db.sql`
    SELECT to_regclass('public.creator_ethos_projection') IS NOT NULL AS has_projection;
  `
  return Boolean(result.rows?.[0]?.has_projection)
}

export async function ensureCreatorEthosProjectionSchema(db: Db): Promise<boolean> {
  if (schemaChecked) return true
  if (schemaCheckPromise) return schemaCheckPromise
  schemaCheckPromise = hasProjectionTable(db)
    .then((ok) => {
      schemaChecked = ok
      return ok
    })
    .finally(() => {
      schemaCheckPromise = null
    })
  return schemaCheckPromise
}

function readInt(value: string | undefined, fallback: number, min = 100, max = 250_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

export async function refreshCreatorEthosProjection(params: {
  db: Db
  limit?: number
  mode?: 'full' | 'fast'
}): Promise<{ refreshedRows: number; appliedLimit: number; available: boolean }> {
  const available = await ensureCreatorEthosProjectionSchema(params.db)
  if (!available) return { refreshedRows: 0, appliedLimit: 0, available: false }

  const appliedLimit = Math.max(
    100,
    Math.min(
      250_000,
      Math.floor(
        params.limit ??
          readInt(process.env.ETHOS_CREATOR_PROJECTION_LIMIT, 50_000, 100, 250_000),
      ),
    ),
  )

  const mode = params.mode ?? 'full'

  if (mode === 'fast') {
    const result = await params.db.sql`
      WITH projection_seed AS (
        SELECT
          rcc.creator_address,
          rcc.coin_address,
          rcc.created_at,
          rcc.market_cap_usd,
          rcc.volume_24h_usd,
          NULLIF(
            GREATEST(
              COALESCE(cw.score, -1),
              COALESCE(es_wallet.score, -1),
              COALESCE(zoc.ethos_score, -1)
            ),
            -1
          ) AS ethos_score,
          COALESCE(cw.level, es_wallet.level, zoc.ethos_level) AS ethos_level,
          CASE
            WHEN cw.score IS NOT NULL THEN 'canonical_wallet'
            WHEN es_wallet.score IS NOT NULL THEN 'wallet_cached'
            WHEN zoc.ethos_score IS NOT NULL THEN 'owner_class_eoa'
            ELSE NULL
          END AS ethos_score_source,
          GREATEST(
            COALESCE(cw.updated_at, '-infinity'::timestamptz),
            COALESCE(es_wallet.fetched_at, '-infinity'::timestamptz),
            COALESCE(zoc.last_updated_at, '-infinity'::timestamptz)
          ) AS score_updated_at
        FROM (
          SELECT
            lower(cc.creator_address) AS creator_address,
            cc.coin_address,
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
            ) AS rank_per_creator
          FROM creator_coins cc
          WHERE cc.chain_id = 8453
        ) rcc
        LEFT JOIN user_ethos_identity_keys uiek_wallet
          ON uiek_wallet.ethos_userkey = ('address:' || rcc.creator_address)
        LEFT JOIN canonical_ethos_scores cw
          ON cw.canonical_user_id = uiek_wallet.canonical_user_id
        LEFT JOIN ethos_userkey_scores es_wallet
          ON es_wallet.ethos_userkey = ('address:' || rcc.creator_address)
          AND es_wallet.status = 'matched'
        LEFT JOIN zora_csw_owner_class zoc
          ON lower(zoc.eoa) = rcc.creator_address
        WHERE rcc.rank_per_creator = 1
        LIMIT ${appliedLimit}
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
        NULL,
        NULL,
        ethos_score,
        ethos_level,
        ethos_score_source,
        CASE WHEN score_updated_at = '-infinity'::timestamptz THEN NULL ELSE score_updated_at END AS score_updated_at,
        NOW()
      FROM projection_seed
      ON CONFLICT (creator_address) DO UPDATE SET
        coin_address = EXCLUDED.coin_address,
        created_at = EXCLUDED.created_at,
        market_cap_usd = EXCLUDED.market_cap_usd,
        volume_24h_usd = EXCLUDED.volume_24h_usd,
        ethos_score = EXCLUDED.ethos_score,
        ethos_level = EXCLUDED.ethos_level,
        ethos_score_source = EXCLUDED.ethos_score_source,
        score_updated_at = EXCLUDED.score_updated_at,
        refreshed_at = NOW();
    `

    return {
      refreshedRows: Math.max(0, Number(result.rowCount ?? 0)),
      appliedLimit,
      available: true,
    }
  }

  const result = await params.db.sql`
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
    top_creator_coin AS (
      SELECT *
      FROM ranked_creator_coins
      WHERE creator_coin_rank = 1
      ORDER BY volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address ASC
      LIMIT ${appliedLimit}
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

  return {
    refreshedRows: Math.max(0, Number(result.rowCount ?? 0)),
    appliedLimit,
    available: true,
  }
}
