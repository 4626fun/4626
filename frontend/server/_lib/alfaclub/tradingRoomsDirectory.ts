import { getDb } from '../db/postgres.js'
import { materializeRoomDisplayFields } from './roomDisplayLabels.js'
import type { AlfaRoomTier, AlfaRoomType } from '../../../src/lib/alfaclub/keyDefense.js'

export type AlfaClubRoomDirectoryItem = {
  roomId: string
  roomName: string
  displayLabel: string
  creatorHandle: string | null
  roomType: AlfaRoomType
  tier: AlfaRoomTier | null
  keySupply: number | null
  roomPoints: number | null
  keyPriceUsdc: number | null
  buyPriceUsdc: number | null
  sellPriceUsdc: number | null
  volumeUsdc: number | null
  feesGeneratedUsdc: number | null
  tradingFundUsdc: number | null
  pnlUsdc: number | null
  pnlPct7d: number | null
  pnlPct30d: number | null
  pnlPctAllTime: number | null
  imageUrl: string | null
  description: string | null
  featured: boolean
  uniqueHolders: number | null
  ingestedAt: string
}

export type AlfaClubRoomSnapshotRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  cached_display_label: string | null
  room_type: string | null
  tier: string | null
  volume_col_raw: string | null
  volume_raw: string | null
  supply_col_raw: string | null
  supply_raw: string | null
  buy_price_raw: string | null
  sell_price_raw: string | null
  mid_price_raw: string | null
  fund_size_raw: string | null
  creator_reward_raw: string | null
  pnl_raw: string | null
  pnl_pct_7d_raw: string | null
  pnl_pct_30d_raw: string | null
  pnl_pct_all_raw: string | null
  image_url: string | null
  room_description: string | null
  featured: boolean | null
  unique_holders_raw: string | null
  ingested_at: string
}

const TIER_SET = new Set<AlfaRoomTier>(['casual', 'club', 'exclusive'])
const ROOM_TYPE_SET = new Set<AlfaRoomType>(['trading', 'social'])

function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** Snapshot buy/sell/mid/volume/fees are USDC×1e6; fund_size/pnl are already USD. */
function normalizeUsdc(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw / 1_000_000
}

function parseTier(raw: string | null | undefined): AlfaRoomTier | null {
  const value = (raw ?? '').trim().toLowerCase()
  return TIER_SET.has(value as AlfaRoomTier) ? (value as AlfaRoomTier) : null
}

function parseRoomType(raw: string | null | undefined): AlfaRoomType {
  const value = (raw ?? '').trim().toLowerCase()
  return ROOM_TYPE_SET.has(value as AlfaRoomType) ? (value as AlfaRoomType) : 'trading'
}

export function rowToAlfaClubRoomDirectoryItem(
  row: AlfaClubRoomSnapshotRow,
): AlfaClubRoomDirectoryItem {
  const labels = materializeRoomDisplayFields({
    roomId: row.room_id,
    roomName: row.room_name,
    creatorHandle: row.creator_twitter_username,
    cachedDisplayLabel: row.cached_display_label,
  })
  const volumeRaw = parseNumber(row.volume_col_raw) ?? parseNumber(row.volume_raw)
  const volumeUsdc = normalizeUsdc(volumeRaw)
  const buyPriceUsdc = normalizeUsdc(parseNumber(row.buy_price_raw))
  const sellPriceUsdc = normalizeUsdc(parseNumber(row.sell_price_raw))
  const midPriceUsdc = normalizeUsdc(parseNumber(row.mid_price_raw))
  return {
    roomId: row.room_id,
    roomName: labels.roomName,
    displayLabel: labels.displayLabel,
    creatorHandle: labels.creatorHandle,
    roomType: parseRoomType(row.room_type),
    tier: parseTier(row.tier),
    keySupply: parseNumber(row.supply_col_raw) ?? parseNumber(row.supply_raw),
    // Scaled volume for legacy "points" sort/compat — not loyalty points.
    roomPoints: volumeUsdc,
    keyPriceUsdc: midPriceUsdc ?? buyPriceUsdc,
    buyPriceUsdc,
    sellPriceUsdc,
    volumeUsdc,
    feesGeneratedUsdc: normalizeUsdc(parseNumber(row.creator_reward_raw)),
    tradingFundUsdc: parseNumber(row.fund_size_raw),
    pnlUsdc: parseNumber(row.pnl_raw),
    pnlPct7d: parseNumber(row.pnl_pct_7d_raw),
    pnlPct30d: parseNumber(row.pnl_pct_30d_raw),
    pnlPctAllTime: parseNumber(row.pnl_pct_all_raw),
    imageUrl: row.image_url,
    description: row.room_description,
    featured: row.featured === true,
    uniqueHolders: parseNumber(row.unique_holders_raw),
    ingestedAt: row.ingested_at,
  }
}

/**
 * Lightweight room directory for `/alfaclub/trading-rooms`.
 * Skips the chat_ingest lateral join used by key-safety list so we can return
 * the full snapshot set (~1k rooms) without timing out.
 */
export async function listAlfaClubRoomsDirectory(
  limit = 2000,
): Promise<AlfaClubRoomDirectoryItem[]> {
  const db = await getDb()
  if (!db) return []

  const capped = Math.min(2500, Math.max(1, Math.floor(limit)))

  const result = await db.sql`
    select
      s.room_id::text as room_id,
      coalesce(
        nullif(trim(s.room_name), ''),
        nullif(trim(s.raw->'metadata'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'title'), ''),
        nullif(trim(e.room_name), ''),
        nullif(trim(lc.display_label), ''),
        case
          when nullif(trim(s.sn), '') is not null and nullif(trim(s.sn), '') !~ '^[0-9]+$'
            then nullif(trim(s.sn), '')
          else null
        end
      ) as room_name,
      coalesce(
        nullif(trim(s.creator_twitter_username), ''),
        nullif(trim(s.raw->'creator'->>'twitter_username'), ''),
        nullif(trim(s.raw->'creator'->>'username'), ''),
        nullif(trim(s.raw->'room'->>'creatorUsername'), ''),
        nullif(trim(s.raw->'room'->>'username'), ''),
        nullif(trim(e.creator_twitter_username), '')
      ) as creator_twitter_username,
      lc.display_label as cached_display_label,
      s.room_type,
      s.tier,
      s.volume::text as volume_col_raw,
      nullif(s.raw->'room'->>'volume', '') as volume_raw,
      s.current_supply::text as supply_col_raw,
      coalesce(
        nullif(s.raw->'room'->>'keySupply', ''),
        nullif(s.raw->'room'->>'keysSupply', ''),
        nullif(s.raw->'room'->>'totalSupply', '')
      ) as supply_raw,
      s.buy_price::text as buy_price_raw,
      s.sell_price::text as sell_price_raw,
      s.mid_price::text as mid_price_raw,
      s.fund_size::text as fund_size_raw,
      nullif(s.raw->'room'->>'creatorReward', '') as creator_reward_raw,
      s.pnl::text as pnl_raw,
      s.pnl_percentage_7d::text as pnl_pct_7d_raw,
      s.pnl_percentage_30d::text as pnl_pct_30d_raw,
      s.pnl_percentage_all_time::text as pnl_pct_all_raw,
      s.image_url,
      s.room_description,
      s.featured,
      s.unique_holders::text as unique_holders_raw,
      s.ingested_at::text as ingested_at
    from public.alfaclub_rooms_snapshot s
    left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
    left join lateral (
      select e2.creator_twitter_username, e2.room_name
      from public.alfaclub_explore_latest e2
      where e2.room_id = s.room_id
      order by e2.ingested_at desc nulls last
      limit 1
    ) e on true
    where lower(coalesce(s.room_type, '')) in ('trading', 'social')
      and lower(coalesce(s.tier, '')) in ('casual', 'club', 'exclusive')
    order by coalesce(
      s.volume,
      case
        when nullif(s.raw->'room'->>'volume', '') ~ '^[0-9]+(\\.[0-9]+)?$'
          then (s.raw->'room'->>'volume')::numeric
        else null
      end
    ) desc nulls last
    limit ${capped};
  `

  return ((result.rows ?? []) as AlfaClubRoomSnapshotRow[]).map(
    rowToAlfaClubRoomDirectoryItem,
  )
}
