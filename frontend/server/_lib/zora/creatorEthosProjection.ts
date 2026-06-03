type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[]; rowCount?: number }>
}

declare const process: { env: Record<string, string | undefined> }

let schemaChecked = false
let schemaCheckPromise: Promise<boolean> | null = null
let warnedMissingUnifiedChartRefreshFn = false
let warnedMissingMarketCapBucketsRefreshFn = false

async function hasProjectionTable(db: Db): Promise<boolean> {
  const result = await db.sql`
    SELECT to_regclass('public.creator_ethos_projection') IS NOT NULL AS has_projection;
  `
  return Boolean(result.rows?.[0]?.has_projection)
}

async function hasFunction(db: Db, signature: string): Promise<boolean> {
  const result = await db.sql`
    SELECT to_regprocedure(${signature}) IS NOT NULL AS available;
  `
  return Boolean(result.rows?.[0]?.available)
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

export type CreatorEthosProjectionByAddress = {
  creatorAddress: string
  score: number | null
  level: string | null
  source: string | null
}

/** 15-minute cron slots for ethos-sync; used to alternate full projection refreshes. */
export function pickCreatorEthosProjectionRefreshMode(lane: 'main' | 'hot'): 'full' | 'fast' {
  const forced = String(process.env.ETHOS_CREATOR_PROJECTION_MODE ?? '').trim().toLowerCase()
  if (forced === 'full' || forced === 'fast') return forced
  if (lane === 'hot') {
    const hotFull = String(process.env.ETHOS_CREATOR_PROJECTION_HOT_USE_FULL ?? '').trim().toLowerCase()
    if (hotFull === '1' || hotFull === 'true' || hotFull === 'yes' || hotFull === 'on') return 'full'
    return 'fast'
  }
  const everyN = readInt(process.env.ETHOS_CREATOR_PROJECTION_FULL_EVERY_N, 4, 1, 48)
  const slot = Math.floor(Date.now() / (15 * 60 * 1000))
  return slot % everyN === 0 ? 'full' : 'fast'
}

export async function loadCreatorEthosProjectionByAddresses(
  db: Db,
  creatorAddresses: string[],
): Promise<Map<string, CreatorEthosProjectionByAddress>> {
  const normalized = Array.from(
    new Set(
      creatorAddresses
        .map((address) => String(address || '').trim().toLowerCase())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  )
  const out = new Map<string, CreatorEthosProjectionByAddress>()
  if (normalized.length === 0) return out

  const available = await ensureCreatorEthosProjectionSchema(db)
  if (!available) return out

  const rows = await db.sql`
    SELECT
      lower(creator_address) AS creator_address,
      ethos_score,
      ethos_level,
      ethos_score_source
    FROM public.creator_ethos_projection
    WHERE lower(creator_address) = ANY(${normalized}::text[]);
  `

  for (const row of rows.rows ?? []) {
    const creatorAddress = String(row.creator_address ?? '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(creatorAddress)) continue
    const scoreRaw = row.ethos_score
    const score =
      typeof scoreRaw === 'number'
        ? Number.isFinite(scoreRaw)
          ? scoreRaw
          : null
        : typeof scoreRaw === 'string'
          ? (() => {
              const n = Number(scoreRaw)
              return Number.isFinite(n) ? n : null
            })()
          : null
    out.set(creatorAddress, {
      creatorAddress,
      score,
      level: typeof row.ethos_level === 'string' ? row.ethos_level : null,
      source: typeof row.ethos_score_source === 'string' ? row.ethos_score_source : null,
    })
  }
  return out
}

export type CreatorEthosMerged = {
  score: number | null
  level: string | null
  source: string | null
}

export function mergeCreatorEthosScores(
  projection: CreatorEthosProjectionByAddress | null | undefined,
  live: { score: number | null; level: string | null } | null | undefined,
  liveSource?: string | null,
): CreatorEthosMerged {
  const projectionScore = projection?.score ?? null
  const liveScore = live?.score ?? null
  if (projectionScore == null && liveScore == null) {
    return { score: null, level: null, source: null }
  }
  if (projectionScore == null) {
    return {
      score: liveScore,
      level: live?.level ?? null,
      source: liveSource ?? null,
    }
  }
  if (liveScore == null) {
    return {
      score: projectionScore,
      level: projection?.level ?? null,
      source: projection?.source ?? null,
    }
  }
  if (liveScore > projectionScore) {
    return {
      score: liveScore,
      level: live?.level ?? projection?.level ?? null,
      source: liveSource ?? null,
    }
  }
  if (liveScore < projectionScore) {
    return {
      score: projectionScore,
      level: projection?.level ?? live?.level ?? null,
      source: projection?.source ?? null,
    }
  }
  return {
    score: projectionScore,
    level: projection?.level ?? live?.level ?? null,
    source: projection?.source ?? liveSource ?? null,
  }
}

function normalizeCreatorAddresses(creatorAddresses: string[]): string[] {
  return Array.from(
    new Set(
      creatorAddresses
        .map((address) => String(address || '').trim().toLowerCase())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  )
}

/** Projection-first Ethos merge used by explore and coin handlers. */
export async function loadMergedCreatorEthosByAddresses(
  creatorAddresses: string[],
): Promise<Map<string, CreatorEthosMerged & { creatorAddress: string }>> {
  const normalized = normalizeCreatorAddresses(creatorAddresses)
  const out = new Map<string, CreatorEthosMerged & { creatorAddress: string }>()
  if (normalized.length === 0) return out

  const { getDb } = await import('@4626/server-core')
  const { resolveCreatorEthosByAddress } = await import('./resolveCreatorEthosByAddress.js')
  const db = await getDb()
  if (!db) return out

  const projectionMap = await loadCreatorEthosProjectionByAddresses(db, normalized)
  let liveMap = new Map<string, { score: number | null; level: string | null; source: string | null }>()
  try {
    liveMap = await resolveCreatorEthosByAddress(normalized)
  } catch {
    liveMap = new Map()
  }

  for (const creatorAddress of normalized) {
    const live = liveMap.get(creatorAddress)
    const merged = mergeCreatorEthosScores(
      projectionMap.get(creatorAddress),
      live,
      live?.source ?? null,
    )
    if (merged.score == null) continue
    out.set(creatorAddress, { creatorAddress, ...merged })
  }
  return out
}

export async function refreshCreatorEthosProjection(params: {
  db: Db
  limit?: number
  /** @deprecated Ignored; all refreshes use the full projection/scoring path. */
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
          readInt(process.env.ETHOS_CREATOR_PROJECTION_LIMIT, 10_000, 100, 250_000),
      ),
    ),
  )
  const ethosPriorityLimit = Math.max(
    500,
    Math.min(
      50_000,
      readInt(process.env.ETHOS_CREATOR_PROJECTION_ETHOS_PRIORITY_LIMIT, 5_000, 500, 50_000),
    ),
  )
  const ethosPriorityMinScore = readInt(
    process.env.ETHOS_CREATOR_PROJECTION_ETHOS_PRIORITY_MIN_SCORE,
    1200,
    800,
    2500,
  )
  const volumeLimit = Math.max(500, appliedLimit - ethosPriorityLimit)

  // `fast` uses the same multi-source scorer as `full` (CSW owners + social + caches).
  // Callers choose refresh frequency via pickCreatorEthosProjectionRefreshMode().
  const _projectionMode = params.mode ?? 'full'

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
    top_by_volume AS (
      SELECT *
      FROM ranked_creator_coins
      WHERE creator_coin_rank = 1
      ORDER BY volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, creator_address ASC
      LIMIT ${volumeLimit}
    ),
    top_by_ethos_signal AS (
      SELECT rcc.*
      FROM ranked_creator_coins rcc
      WHERE rcc.creator_coin_rank = 1
        AND (
          EXISTS (
            SELECT 1
            FROM zora_csw_owner_class zoc
            WHERE lower(zoc.eoa) = rcc.creator_address
              AND zoc.ethos_score IS NOT NULL
              AND zoc.ethos_score >= ${ethosPriorityMinScore}
          )
          OR EXISTS (
            SELECT 1
            FROM zora_csw_owners zco
            CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
            JOIN zora_csw_owner_class zoc
              ON lower(zoc.eoa) = lower(owner_eoa)
            WHERE lower(zco.csw_address) = rcc.creator_address
              AND zoc.ethos_score IS NOT NULL
              AND zoc.ethos_score >= ${ethosPriorityMinScore}
          )
        )
      ORDER BY (
        SELECT MAX(zoc.ethos_score)
        FROM zora_csw_owner_class zoc
        WHERE lower(zoc.eoa) = rcc.creator_address
      ) DESC NULLS LAST,
      rcc.volume_24h_usd DESC NULLS LAST,
      rcc.creator_address ASC
      LIMIT ${ethosPriorityLimit}
    ),
    selected_creators AS (
      SELECT creator_address FROM top_by_volume
      UNION
      SELECT creator_address FROM top_by_ethos_signal
    ),
    top_creator_coin AS (
      SELECT rcc.*
      FROM ranked_creator_coins rcc
      INNER JOIN selected_creators sc ON sc.creator_address = rcc.creator_address
      WHERE rcc.creator_coin_rank = 1
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
        COALESCE(pb.twitter_username, existing.twitter_username) AS twitter_username,
        COALESCE(pb.zora_handle, existing.zora_handle) AS zora_handle,
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
      LEFT JOIN public.creator_ethos_projection existing
        ON existing.creator_address = tcc.creator_address
      LEFT JOIN user_ethos_identity_keys uiek_social
        ON COALESCE(pb.twitter_username, existing.twitter_username) IS NOT NULL
        AND uiek_social.ethos_userkey = (
          'service:x.com:username:' || COALESCE(pb.twitter_username, existing.twitter_username)
        )
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
        ON COALESCE(pb.twitter_username, existing.twitter_username) IS NOT NULL
        AND es_social.ethos_userkey = (
          'service:x.com:username:' || COALESCE(pb.twitter_username, existing.twitter_username)
        )
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
      twitter_username = COALESCE(EXCLUDED.twitter_username, creator_ethos_projection.twitter_username),
      zora_handle = COALESCE(EXCLUDED.zora_handle, creator_ethos_projection.zora_handle),
      ethos_score = EXCLUDED.ethos_score,
      ethos_level = EXCLUDED.ethos_level,
      ethos_score_source = EXCLUDED.ethos_score_source,
      score_updated_at = EXCLUDED.score_updated_at,
      refreshed_at = NOW();
  `

  // Keep chart distribution tables fresh for the 137+ Ethos charts
  try {
    await params.db.sql`SELECT public.refresh_creator_ethos_distribution();`
  } catch (e) {
    // Non-fatal — the distribution is a nice-to-have for charts
    console.warn('[creatorEthosProjection] failed to refresh distribution table', e)
  }

  // Snapshot for trend charts (daily + hourly)
  try {
    await params.db.sql`SELECT public.snapshot_creator_ethos_daily();`
  } catch (e) {
    console.warn('[creatorEthosProjection] failed to snapshot daily Ethos data', e)
  }

  try {
    await params.db.sql`SELECT public.snapshot_creator_ethos_hourly();`
  } catch (e) {
    console.warn('[creatorEthosProjection] failed to snapshot hourly Ethos data', e)
  }

  // Ultra high-resolution 15-min snapshots (use with short retention)
  try {
    await params.db.sql`SELECT public.snapshot_creator_ethos_15min();`
  } catch (e) {
    console.warn('[creatorEthosProjection] failed to snapshot 15min Ethos data', e)
  }

  // Market cap bucket stats for segmented charts
  try {
    const hasMarketCapBucketRefreshFn = await hasFunction(
      params.db,
      'public.refresh_ethos_market_cap_buckets()',
    )
    if (hasMarketCapBucketRefreshFn) {
      await params.db.sql`SELECT public.refresh_ethos_market_cap_buckets();`
      warnedMissingMarketCapBucketsRefreshFn = false
    } else if (!warnedMissingMarketCapBucketsRefreshFn) {
      warnedMissingMarketCapBucketsRefreshFn = true
      console.warn(
        '[creatorEthosProjection] skipping market cap buckets refresh; function public.refresh_ethos_market_cap_buckets() is missing',
      )
    }
  } catch (e) {
    console.warn('[creatorEthosProjection] failed to refresh market cap buckets', e)
  }

  // Refresh all interconnected chart materialized views (unified approach)
  try {
    const hasUnifiedChartRefreshFn = await hasFunction(
      params.db,
      'public.refresh_all_ethos_chart_views()',
    )
    if (hasUnifiedChartRefreshFn) {
      await params.db.sql`SELECT public.refresh_all_ethos_chart_views();`
      warnedMissingUnifiedChartRefreshFn = false
    } else if (!warnedMissingUnifiedChartRefreshFn) {
      warnedMissingUnifiedChartRefreshFn = true
      console.warn(
        '[creatorEthosProjection] skipping chart views refresh; function public.refresh_all_ethos_chart_views() is missing',
      )
    }
  } catch (e) {
    console.warn('[creatorEthosProjection] failed to refresh chart views', e)
  }

  return {
    refreshedRows: Math.max(0, Number(result.rowCount ?? 0)),
    appliedLimit,
    available: true,
  }
}
