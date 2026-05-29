import type { getDb } from '@4626/server-core'

import { parseSparklineValuesFromDb } from './exploreSparklineCache.js'

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

export type ExploreCoinTableContext = {
  coinAddress: string
  fees24hUsd: string | null
  uniqueHolders: number | null
  marketCapDelta24h: string | null
  name: string | null
  symbol: string | null
  avatarImageUrl: string | null
  zoraHandle: string | null
  sparkline30dValues: number[]
  sparkline30dChangePct: number | null
}

function toNumericString(value: unknown): string | null {
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? String(n) : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function toIntegerOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  return null
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function loadExploreCoinTableContextByAddresses(
  db: Db,
  coinAddresses: string[],
): Promise<Map<string, ExploreCoinTableContext>> {
  const normalized = [...new Set(coinAddresses.map((address) => address.toLowerCase()).filter(Boolean))]
  if (normalized.length === 0) return new Map()

  const result = await db.sql`
    WITH requested AS (
      SELECT unnest(${normalized}::text[]) AS coin_address
    ),
    profile_match AS (
      SELECT DISTINCT ON (lower(zp.zora_creator_coin_address))
        lower(zp.zora_creator_coin_address) AS coin_address,
        zp.zora_creator_coin_name,
        zp.zora_creator_coin_symbol,
        zp.unique_holders AS profile_unique_holders,
        zp.avatar_image_url,
        zp.handle AS zora_handle,
        zp.last_refreshed_at
      FROM zora_profiles zp
      WHERE lower(zp.zora_creator_coin_address) = ANY(${normalized}::text[])
      ORDER BY lower(zp.zora_creator_coin_address), zp.last_refreshed_at DESC NULLS LAST
    )
    SELECT
      lower(r.coin_address) AS coin_address,
      cc.fees_24h_usd,
      cc.unique_holders AS coin_unique_holders,
      cc.market_cap_delta_24h,
      cc.sparkline_30d_values,
      cc.sparkline_30d_change_pct,
      cc.sparkline_30d_updated_at,
      pm.zora_creator_coin_name,
      pm.zora_creator_coin_symbol,
      pm.profile_unique_holders,
      pm.avatar_image_url,
      pm.zora_handle
    FROM requested r
    LEFT JOIN creator_coins cc
      ON lower(cc.coin_address) = lower(r.coin_address)
      AND cc.chain_id = 8453
    LEFT JOIN profile_match pm
      ON pm.coin_address = lower(r.coin_address);
  `

  const map = new Map<string, ExploreCoinTableContext>()
  for (const row of result.rows ?? []) {
    const coinAddress = typeof row.coin_address === 'string' ? row.coin_address.toLowerCase() : ''
    if (!coinAddress) continue

    const coinUniqueHolders = toIntegerOrNull(row.coin_unique_holders)
    const profileUniqueHolders = toIntegerOrNull(row.profile_unique_holders)
    const sparklineValues = parseSparklineValuesFromDb(row.sparkline_30d_values)
    const sparklineChangePct =
      sparklineValues.length >= 2 ? toFiniteNumberOrNull(row.sparkline_30d_change_pct) : null
    map.set(coinAddress, {
      coinAddress,
      fees24hUsd: toNumericString(row.fees_24h_usd),
      uniqueHolders: coinUniqueHolders ?? profileUniqueHolders,
      marketCapDelta24h: toNumericString(row.market_cap_delta_24h),
      name: normalizeText(row.zora_creator_coin_name),
      symbol: normalizeText(row.zora_creator_coin_symbol),
      avatarImageUrl: normalizeText(row.avatar_image_url),
      zoraHandle: normalizeText(row.zora_handle),
      sparkline30dValues: sparklineValues,
      sparkline30dChangePct: sparklineChangePct,
    })
  }
  return map
}

export function buildMediaContentFromAvatarUrl(url: string | null | undefined) {
  if (!url) return undefined
  return {
    previewImage: {
      small: url,
      medium: url,
    },
  }
}

export function buildTrend30dFromTableContext(
  ctx: ExploreCoinTableContext | null | undefined,
): { values: number[]; changePercent: number | null } | undefined {
  if (!ctx || ctx.sparkline30dValues.length < 2) return undefined
  return {
    values: ctx.sparkline30dValues,
    changePercent: ctx.sparkline30dChangePct,
  }
}

export function buildCreatorProfileFromTableContext(
  row: { zora_handle?: string | null; twitter_username?: string | null },
  ctx: ExploreCoinTableContext | null | undefined,
): Record<string, unknown> | undefined {
  const handleFromRow =
    typeof row.zora_handle === 'string' && row.zora_handle.trim()
      ? row.zora_handle.trim()
      : typeof row.twitter_username === 'string' && row.twitter_username.trim()
        ? row.twitter_username.trim().replace(/^@/, '')
        : null
  const handle = ctx?.zoraHandle ?? handleFromRow
  const avatarUrl = ctx?.avatarImageUrl

  if (!handle && !avatarUrl) {
    if (!handleFromRow) return undefined
    return { handle: handleFromRow, username: handleFromRow.replace(/^@/, '') }
  }

  return {
    handle,
    username: handle?.replace(/^@/, ''),
    ...(avatarUrl
      ? {
          avatar: {
            previewImage: {
              small: avatarUrl,
              medium: avatarUrl,
            },
          },
        }
      : {}),
  }
}
