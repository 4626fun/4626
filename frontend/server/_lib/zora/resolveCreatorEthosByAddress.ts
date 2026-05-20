import { getDb } from '../../../packages/server-core/src/index.js'
import { fetchFreshEthosScoresByUserkeys } from '../chat/ethosClient.js'

export type CreatorEthosResolved = {
  creatorAddress: string
  score: number | null
  level: string | null
  source: string | null
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function resolveEthosScoreSource(candidates: {
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

export async function resolveCreatorEthosByAddress(
  creatorAddresses: string[],
): Promise<Map<string, CreatorEthosResolved>> {
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
    const source =
      typeof socialFresh?.score === 'number' && score === socialFresh.score
        ? 'social_fresh'
        : resolveEthosScoreSource({
            canonicalSocial: canonicalSocialScore,
            canonicalWallet: canonicalWalletScore,
            ownerClassFromCsw: ownerClassCswScore,
            ownerClassEoa: ownerClassScore,
            socialCached: dbSocialScore,
            walletCached: dbWalletScore,
          })
    out.set(creatorAddress, {
      creatorAddress,
      score,
      level,
      source,
    })
  }

  return out
}
