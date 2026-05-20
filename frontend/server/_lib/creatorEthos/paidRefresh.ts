import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'

import {
  materializeCanonicalEthosScores,
  seedEthosIdentityKeys,
  syncEthosUserkeyScores,
} from '../identity/ethosCanonicalScores.js'
import {
  ensureCreatorEthosProjectionSchema,
  loadCreatorEthosProjectionByAddresses,
} from '../zora/creatorEthosProjection.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[]; rowCount?: number }>
}

declare const process: { env: Record<string, string | undefined> }

/** $0.10 USDC at 6 decimals. */
export const ETHOS_PAID_REFRESH_PRICE_USDC: bigint = 100_000n

export const ETHOS_PAID_REFRESH_PRICE_DISPLAY = '$0.10'

function readInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

export function ethosPaidRefreshCooldownMinutes(): number {
  return readInt(process.env.ETHOS_PAID_REFRESH_COOLDOWN_MINUTES, 5, 1, 24 * 60)
}

export async function hasCreatorEthosRefreshOrdersTable(db: Db): Promise<boolean> {
  const result = await db.sql`
    SELECT to_regclass('public.creator_ethos_refresh_orders') IS NOT NULL AS has_table;
  `
  return Boolean(result.rows?.[0]?.has_table)
}

export async function getEthosPaidRefreshCooldown(params: {
  db: Db
  creatorAddress: string
}): Promise<{ inCooldown: boolean; retryAfterSeconds: number | null; lastOrderAt: string | null }> {
  const creatorAddress = params.creatorAddress.toLowerCase()
  const hasTable = await hasCreatorEthosRefreshOrdersTable(params.db)
  if (!hasTable) {
    return { inCooldown: false, retryAfterSeconds: null, lastOrderAt: null }
  }

  const cooldownMinutes = ethosPaidRefreshCooldownMinutes()
  const rows = await params.db.sql`
    SELECT created_at
    FROM public.creator_ethos_refresh_orders
    WHERE lower(creator_address) = ${creatorAddress}
      AND completed_at IS NOT NULL
      AND created_at > NOW() - (${cooldownMinutes}::int * INTERVAL '1 minute')
    ORDER BY created_at DESC
    LIMIT 1;
  `
  const lastOrderAt = rows.rows?.[0]?.created_at ? String(rows.rows[0].created_at) : null
  if (!lastOrderAt) {
    return { inCooldown: false, retryAfterSeconds: null, lastOrderAt: null }
  }

  const elapsedMs = Date.now() - Date.parse(lastOrderAt)
  const windowMs = cooldownMinutes * 60_000
  const remainingMs = Math.max(0, windowMs - elapsedMs)
  return {
    inCooldown: remainingMs > 0,
    retryAfterSeconds: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : null,
    lastOrderAt,
  }
}

export async function collectEthosUserkeysForCreator(
  db: Db,
  creatorAddress: string,
): Promise<{ userkeys: string[]; coinAddress: string | null }> {
  const normalized = creatorAddress.toLowerCase()
  const rows = await db.sql`
    WITH coin_row AS (
      SELECT
        lower(cc.creator_address) AS creator_address,
        cc.coin_address,
        ROW_NUMBER() OVER (
          ORDER BY cc.volume_24h_usd DESC NULLS LAST, cc.market_cap_usd DESC NULLS LAST, cc.coin_address ASC
        ) AS rn
      FROM creator_coins cc
      WHERE cc.chain_id = 8453
        AND lower(cc.creator_address) = ${normalized}
    ),
    profile_identity AS (
      SELECT
        cr.creator_address,
        NULLIF(lower(trim(p.twitter_username)), '') AS twitter_username,
        NULLIF(lower(trim(p.handle)), '') AS zora_handle,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN NULLIF(lower(trim(p.twitter_username)), '') IS NOT NULL THEN 0 ELSE 1 END,
            p.last_refreshed_at DESC NULLS LAST
        ) AS rn
      FROM coin_row cr
      JOIN zora_profiles p
        ON lower(NULLIF(p.signing_eoa, '')) = cr.creator_address
        OR lower(NULLIF(p.primary_wallet, '')) = cr.creator_address
        OR lower(NULLIF(p.payout_recipient, '')) = cr.creator_address
        OR lower(NULLIF(p.smart_wallet_address, '')) = cr.creator_address
        OR lower(NULLIF(p.privy_wallet_address, '')) = cr.creator_address
      WHERE cr.rn = 1
    ),
    owner_eoas AS (
      SELECT DISTINCT lower(owner_eoa) AS eoa
      FROM coin_row cr
      JOIN zora_csw_owners zco ON lower(zco.csw_address) = cr.creator_address
      CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
      WHERE cr.rn = 1
    )
    SELECT
      (SELECT coin_address FROM coin_row WHERE rn = 1 LIMIT 1) AS coin_address,
      (SELECT twitter_username FROM profile_identity WHERE rn = 1 LIMIT 1) AS twitter_username,
      (SELECT zora_handle FROM profile_identity WHERE rn = 1 LIMIT 1) AS zora_handle,
      (SELECT array_agg(DISTINCT eoa) FROM owner_eoas) AS owner_eoas;
  `

  const row = rows.rows?.[0]
  const coinAddress = typeof row?.coin_address === 'string' ? row.coin_address.toLowerCase() : null
  const userkeys = new Set<string>([`address:${normalized}`])
  const twitter = typeof row?.twitter_username === 'string' ? row.twitter_username.trim().toLowerCase() : ''
  const handle = typeof row?.zora_handle === 'string' ? row.zora_handle.trim().toLowerCase() : ''
  const social = twitter || handle
  if (social) userkeys.add(`service:x.com:username:${social}`)
  const ownerEoas = Array.isArray(row?.owner_eoas) ? row.owner_eoas : []
  for (const eoa of ownerEoas) {
    if (typeof eoa === 'string' && /^0x[a-f0-9]{40}$/.test(eoa)) {
      userkeys.add(`address:${eoa}`)
    }
  }

  return { userkeys: Array.from(userkeys), coinAddress }
}

export async function refreshCreatorEthosProjectionForCreator(
  db: Db,
  creatorAddress: string,
): Promise<{ refreshed: boolean; coinAddress: string | null }> {
  const available = await ensureCreatorEthosProjectionSchema(db)
  if (!available) return { refreshed: false, coinAddress: null }

  const normalized = creatorAddress.toLowerCase()
  const result = await db.sql`
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
        AND lower(cc.creator_address) = ${normalized}
    ),
    top_creator_coin AS (
      SELECT *
      FROM ranked_creator_coins
      WHERE creator_coin_rank = 1
      LIMIT 1
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
      LEFT JOIN profile_best pb ON pb.creator_address = tcc.creator_address
      LEFT JOIN user_ethos_identity_keys uiek_social
        ON pb.twitter_username IS NOT NULL
        AND uiek_social.ethos_userkey = ('service:x.com:username:' || pb.twitter_username)
      LEFT JOIN canonical_ethos_scores cs ON cs.canonical_user_id = uiek_social.canonical_user_id
      LEFT JOIN user_ethos_identity_keys uiek_wallet
        ON uiek_wallet.ethos_userkey = ('address:' || tcc.creator_address)
      LEFT JOIN canonical_ethos_scores cw ON cw.canonical_user_id = uiek_wallet.canonical_user_id
      LEFT JOIN LATERAL (
        SELECT zoc1.ethos_score AS score, zoc1.ethos_level AS level, zoc1.last_updated_at
        FROM zora_csw_owners zco
        CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
        JOIN zora_csw_owner_class zoc1 ON lower(zoc1.eoa) = lower(owner_eoa)
        WHERE lower(zco.csw_address) = tcc.creator_address
        ORDER BY zoc1.ethos_score DESC NULLS LAST, zoc1.last_updated_at DESC NULLS LAST
        LIMIT 1
      ) oc ON true
      LEFT JOIN zora_csw_owner_class zoc ON lower(zoc.eoa) = tcc.creator_address
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
        )::int AS ethos_score,
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
      refreshed_at = NOW()
    RETURNING coin_address;
  `

  const coinAddress =
    typeof result.rows?.[0]?.coin_address === 'string' ? String(result.rows[0].coin_address).toLowerCase() : null
  return { refreshed: (result.rowCount ?? 0) > 0, coinAddress }
}

export async function runPaidCreatorEthosRefresh(
  db: Db,
  creatorAddress: string,
): Promise<
  | { ok: true; coinAddress: string | null; ethosScore: number | null; ethosLevel: string | null; ethosScoreSource: string | null }
  | { ok: false; reason: 'creator_not_indexed' | 'projection_unavailable' | 'ethos_sync_failed'; message: string }
> {
  const { userkeys, coinAddress } = await collectEthosUserkeysForCreator(db, creatorAddress)
  if (!coinAddress) {
    return { ok: false, reason: 'creator_not_indexed', message: 'Creator is not in creator_coins yet.' }
  }

  try {
    await seedEthosIdentityKeys({ db, limit: Math.max(userkeys.length, 8) })
    await syncEthosUserkeyScores({ db, forceUserkeys: userkeys, chunkSize: 50 })
    await materializeCanonicalEthosScores({ db, userkeys, limit: userkeys.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ethos_sync_failed'
    return { ok: false, reason: 'ethos_sync_failed', message }
  }

  const projection = await refreshCreatorEthosProjectionForCreator(db, creatorAddress)
  if (!projection.refreshed) {
    return { ok: false, reason: 'projection_unavailable', message: 'Could not update creator_ethos_projection.' }
  }

  const row = (await loadCreatorEthosProjectionByAddresses(db, [creatorAddress])).get(creatorAddress.toLowerCase())
  return {
    ok: true,
    coinAddress: projection.coinAddress ?? coinAddress,
    ethosScore: row?.score ?? null,
    ethosLevel: row?.level ?? null,
    ethosScoreSource: row?.source ?? null,
  }
}

export async function insertCreatorEthosRefreshOrder(params: {
  db: Db
  creatorAddress: string
  coinAddress: string | null
  payerAddress: Address
  priceUsdcPaid: bigint
  paymentTxHash: Hex
  paymentTo: Address
  ethosScoreBefore: number | null
  ethosScoreAfter: number | null
}): Promise<{ ok: true } | { ok: false; reason: 'payment_already_used' | 'db_error'; message: string }> {
  const hasTable = await hasCreatorEthosRefreshOrdersTable(params.db)
  if (!hasTable) {
    return { ok: false, reason: 'db_error', message: 'creator_ethos_refresh_orders table missing' }
  }

  try {
    await params.db.sql`
      INSERT INTO public.creator_ethos_refresh_orders (
        creator_address,
        coin_address,
        payer_address,
        price_usdc_paid,
        payment_tx_hash,
        payment_to,
        ethos_score_before,
        ethos_score_after,
        completed_at
      ) VALUES (
        ${params.creatorAddress.toLowerCase()},
        ${params.coinAddress},
        ${getAddress(params.payerAddress).toLowerCase()},
        ${params.priceUsdcPaid.toString()},
        ${params.paymentTxHash.toLowerCase()},
        ${getAddress(params.paymentTo).toLowerCase()},
        ${params.ethosScoreBefore},
        ${params.ethosScoreAfter},
        NOW()
      );
    `
    return { ok: true }
  } catch (error: any) {
    const code = typeof error?.code === 'string' ? error.code : ''
    if (code === '23505') {
      return { ok: false, reason: 'payment_already_used', message: 'Payment tx hash already used.' }
    }
    const message = error instanceof Error ? error.message : 'db_error'
    return { ok: false, reason: 'db_error', message }
  }
}
