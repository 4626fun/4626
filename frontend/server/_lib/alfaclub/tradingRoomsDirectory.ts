import { getDb } from '../db/postgres.js'
import { materializeRoomDisplayFields } from './roomDisplayLabels.js'
import type { AlfaRoomTier } from '../../../src/lib/alfaclub/keyDefense.js'

export type TradingRoomDirectoryItem = {
  roomId: string
  roomName: string
  displayLabel: string
  creatorHandle: string | null
  tier: AlfaRoomTier | null
  keySupply: number | null
  volumeUsdc: number | null
}

type SnapshotRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  cached_display_label: string | null
  tier: string | null
  volume_col_raw: string | null
  volume_raw: string | null
  supply_col_raw: string | null
  supply_raw: string | null
}

const TIER_SET = new Set<AlfaRoomTier>(['casual', 'club', 'exclusive'])

function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function normalizeMaybeUsdc(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  // Snapshot volume is already USDC units for trading rooms.
  return value
}

function parseTier(raw: string | null | undefined): AlfaRoomTier | null {
  const value = (raw ?? '').trim().toLowerCase()
  return TIER_SET.has(value as AlfaRoomTier) ? (value as AlfaRoomTier) : null
}

function rowToItem(row: SnapshotRow): TradingRoomDirectoryItem {
  const labels = materializeRoomDisplayFields({
    roomId: row.room_id,
    roomName: row.room_name,
    creatorHandle: row.creator_twitter_username,
    cachedDisplayLabel: row.cached_display_label,
  })
  return {
    roomId: row.room_id,
    roomName: labels.roomName,
    displayLabel: labels.displayLabel,
    creatorHandle: labels.creatorHandle,
    tier: parseTier(row.tier),
    keySupply: parseNumber(row.supply_col_raw) ?? parseNumber(row.supply_raw),
    volumeUsdc: normalizeMaybeUsdc(parseNumber(row.volume_col_raw) ?? parseNumber(row.volume_raw)),
  }
}

/**
 * Lightweight trading-room directory for `/alfaclub/trading-rooms`.
 * Skips the chat_ingest lateral join used by key-safety list so we can return
 * the full snapshot set (~1k rooms) without timing out.
 */
export async function listTradingRoomsDirectory(limit = 2000): Promise<TradingRoomDirectoryItem[]> {
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
      s.tier,
      s.volume::text as volume_col_raw,
      nullif(s.raw->'room'->>'volume', '') as volume_raw,
      s.current_supply::text as supply_col_raw,
      coalesce(
        nullif(s.raw->'room'->>'keySupply', ''),
        nullif(s.raw->'room'->>'keysSupply', ''),
        nullif(s.raw->'room'->>'totalSupply', '')
      ) as supply_raw
    from public.alfaclub_rooms_snapshot s
    left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
    left join lateral (
      select e2.creator_twitter_username, e2.room_name
      from public.alfaclub_explore_latest e2
      where e2.room_id = s.room_id
      order by e2.ingested_at desc nulls last
      limit 1
    ) e on true
    where lower(coalesce(s.room_type, '')) = 'trading'
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

  return ((result.rows ?? []) as SnapshotRow[]).map(rowToItem)
}
