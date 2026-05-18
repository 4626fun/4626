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

type ProfileIdentity = {
  twitterUsername: string | null
  zoraHandle: string | null
  lastRefreshedAtMs: number
}

type CswOwnerEntry = {
  baseOwner: string | null
  owners: string[]
}

function chooseBetterProfile(current: ProfileIdentity | undefined, next: ProfileIdentity): ProfileIdentity {
  if (!current) return next
  const currentHasTwitter = Boolean(current.twitterUsername)
  const nextHasTwitter = Boolean(next.twitterUsername)
  if (nextHasTwitter && !currentHasTwitter) return next
  if (!nextHasTwitter && currentHasTwitter) return current
  if (next.lastRefreshedAtMs > current.lastRefreshedAtMs) return next
  return current
}

function buildAddressProfileMap(rows: any[]): Map<string, ProfileIdentity> {
  const map = new Map<string, ProfileIdentity>()
  for (const row of rows) {
    const twitterUsername = normalizeHandle(row.twitter_username)
    const zoraHandle = normalizeHandle(row.handle)
    if (!twitterUsername && !zoraHandle) continue
    const refreshedRaw = row.last_refreshed_at ? Date.parse(String(row.last_refreshed_at)) : Number.NaN
    const lastRefreshedAtMs = Number.isFinite(refreshedRaw) ? refreshedRaw : 0
    const profile: ProfileIdentity = { twitterUsername, zoraHandle, lastRefreshedAtMs }
    const addresses = [
      normalizeAddress(row.signing_eoa),
      normalizeAddress(row.primary_wallet),
      normalizeAddress(row.payout_recipient),
      normalizeAddress(row.smart_wallet_address),
      normalizeAddress(row.privy_wallet_address),
    ]
    for (const address of addresses) {
      if (!address) continue
      map.set(address, chooseBetterProfile(map.get(address), profile))
    }
  }
  return map
}

async function loadAddressProfileMap(db: NonNullable<Db>): Promise<Map<string, ProfileIdentity>> {
  const profiles = await db.sql`
    SELECT
      p.twitter_username,
      p.handle,
      p.last_refreshed_at,
      p.signing_eoa,
      p.primary_wallet,
      p.payout_recipient,
      p.smart_wallet_address,
      p.privy_wallet_address
    FROM public.zora_profiles p
    WHERE (p.twitter_username IS NOT NULL AND trim(p.twitter_username) <> '')
      OR (p.handle IS NOT NULL AND trim(p.handle) <> '');
  `
  return buildAddressProfileMap(profiles.rows ?? [])
}

async function loadCswOwnerMap(db: NonNullable<Db>): Promise<Map<string, CswOwnerEntry>> {
  let result: { rows?: any[]; rowCount?: number }
  try {
    result = await db.sql`
      SELECT
        lower(zco.csw_address) AS csw_address,
        lower(NULLIF(zco.base_owner, '')) AS base_owner,
        COALESCE(zco.current_owners, ARRAY[]::text[]) AS current_owners
      FROM public.zora_csw_owners zco;
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.warn('[ethos-creator-social-backfill] csw_owner_map_unavailable', { error: message })
    return new Map<string, CswOwnerEntry>()
  }
  const map = new Map<string, CswOwnerEntry>()
  for (const row of result.rows ?? []) {
    const cswAddress = normalizeAddress(row.csw_address)
    if (!cswAddress) continue
    const baseOwner = normalizeAddress(row.base_owner)
    const owners = Array.isArray(row.current_owners)
      ? row.current_owners.map((value: unknown) => normalizeAddress(value)).filter((value: string | null): value is string => Boolean(value))
      : []
    map.set(cswAddress, { baseOwner, owners })
  }
  return map
}

async function fetchCreatorBatch(params: {
  db: NonNullable<Db>
  offset: number
  limit: number
}): Promise<Array<{ creatorAddress: string; twitterUsername: string; volume24hUsd: number | null }>> {
  const baseRows = await params.db.sql`
    SELECT
      p.creator_address,
      p.volume_24h_usd,
      p.twitter_username
    FROM public.creator_ethos_projection p
    WHERE p.twitter_username IS NOT NULL
      AND trim(p.twitter_username) <> ''
    ORDER BY p.creator_address ASC
    LIMIT ${params.limit}
    OFFSET ${Math.max(0, params.offset)};
  `

  return (baseRows.rows ?? [])
    .map((row: any) => {
      const creatorAddress = normalizeAddress(row.creator_address)
      const twitterUsername = normalizeHandle(row.twitter_username)
      const volume24hUsdRaw = typeof row.volume_24h_usd === 'number' ? row.volume_24h_usd : Number(row.volume_24h_usd)
      const volume24hUsd = Number.isFinite(volume24hUsdRaw) ? volume24hUsdRaw : null
      if (!creatorAddress || !twitterUsername) return null
      return { creatorAddress, twitterUsername, volume24hUsd }
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
  addressProfileMap: Map<string, ProfileIdentity>
  cswOwnerMap: Map<string, CswOwnerEntry>
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

  const creatorUpdates: Array<{ creatorAddress: string; twitterUsername: string | null; zoraHandle: string | null }> = []
  for (const creatorAddress of creatorAddresses) {
    const candidates: Array<{ address: string; rank: number }> = [{ address: creatorAddress, rank: 0 }]
    const ownerEntry = params.cswOwnerMap.get(creatorAddress)
    if (ownerEntry?.baseOwner) candidates.push({ address: ownerEntry.baseOwner, rank: 1 })
    for (const ownerAddress of ownerEntry?.owners ?? []) {
      candidates.push({ address: ownerAddress, rank: 2 })
    }
    const deduped = new Map<string, number>()
    for (const candidate of candidates) {
      const prev = deduped.get(candidate.address)
      if (prev === undefined || candidate.rank < prev) deduped.set(candidate.address, candidate.rank)
    }

    let best: { twitterUsername: string | null; zoraHandle: string | null; rank: number; refreshedAtMs: number } | null = null
    for (const [candidateAddress, rank] of deduped.entries()) {
      const profile = params.addressProfileMap.get(candidateAddress)
      if (!profile) continue
      const candidate = {
        twitterUsername: profile.twitterUsername,
        zoraHandle: profile.zoraHandle,
        rank,
        refreshedAtMs: profile.lastRefreshedAtMs,
      }
      if (!best) {
        best = candidate
        continue
      }
      const bestHasTwitter = Boolean(best.twitterUsername)
      const candidateHasTwitter = Boolean(candidate.twitterUsername)
      if (candidateHasTwitter && !bestHasTwitter) {
        best = candidate
        continue
      }
      if (!candidateHasTwitter && bestHasTwitter) continue
      if (candidate.rank < best.rank) {
        best = candidate
        continue
      }
      if (candidate.rank > best.rank) continue
      if (candidate.refreshedAtMs > best.refreshedAtMs) best = candidate
    }
    if (!best) continue
    if (!best.twitterUsername && !best.zoraHandle) continue
    creatorUpdates.push({
      creatorAddress,
      twitterUsername: best.twitterUsername,
      zoraHandle: best.zoraHandle,
    })
  }

  if (creatorUpdates.length === 0) {
    return {
      scanned: creatorAddresses.length,
      updated: 0,
      cursorAfter: creatorAddresses[creatorAddresses.length - 1] ?? params.afterAddress,
    }
  }

  const updateCreators = creatorUpdates.map((row) => row.creatorAddress)
  const updateTwitter = creatorUpdates.map((row) => row.twitterUsername)
  const updateHandles = creatorUpdates.map((row) => row.zoraHandle)
  const updated = await params.db.sql`
    WITH payload AS (
      SELECT *
      FROM unnest(
        ${updateCreators}::text[],
        ${updateTwitter}::text[],
        ${updateHandles}::text[]
      ) AS t(creator_address, twitter_username, zora_handle)
    )
    UPDATE public.creator_ethos_projection p
    SET
      twitter_username = COALESCE(payload.twitter_username, p.twitter_username),
      zora_handle = COALESCE(p.zora_handle, payload.zora_handle),
      refreshed_at = NOW()
    FROM payload
    WHERE p.creator_address = payload.creator_address
      AND (
        (payload.twitter_username IS NOT NULL AND (p.twitter_username IS NULL OR trim(p.twitter_username) = ''))
        OR (payload.zora_handle IS NOT NULL AND p.zora_handle IS NULL)
      );
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
  console.info('[ethos-creator-social-backfill] loading_profile_map')
  const addressProfileMap = await loadAddressProfileMap(db)
  console.info('[ethos-creator-social-backfill] loading_csw_owner_map')
  const cswOwnerMap = await loadCswOwnerMap(db)
  console.info('[ethos-creator-social-backfill] profile_map_loaded', {
    profileAddresses: addressProfileMap.size,
    cswOwnerEntries: cswOwnerMap.size,
  })

  let hydrateCursor: string | null = null
  let hydratedScanned = 0
  let hydratedUpdated = 0
  for (let batch = 1; batch <= hydrateMaxBatches; batch += 1) {
    const hydrated = await hydrateProjectionTwitterBatch({
      db,
      addressProfileMap,
      cswOwnerMap,
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
  const stack = error instanceof Error ? error.stack : null
  console.error('[ethos-creator-social-backfill] failed', { error: message, stack })
  process.exit(1)
})
