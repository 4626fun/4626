import type { AlfaRoomTier, AlfaRoomType } from './keyDefense'

export type AlfaClubRoomDirectoryItem = {
  roomId: string
  roomName: string
  displayLabel: string
  creatorHandle: string | null
  roomType: AlfaRoomType
  tier: AlfaRoomTier | null
  keySupply: number | null
  roomPoints: number | null
  /** Current key mid/buy price in USD. */
  keyPriceUsdc: number | null
  /** Lifetime key-trade volume in USD. */
  volumeUsdc: number | null
  /** Creator fees / rewards accrued in USD. */
  feesGeneratedUsdc: number | null
  /** Reported trading-fund size in USD (spot + Hyperliquid + Polymarket). */
  tradingFundUsdc: number | null
  imageUrl: string | null
  description: string | null
  featured: boolean
  uniqueHolders: number | null
  ingestedAt: string
}

export type AlfaClubRoomSort = 'points' | 'keys' | 'updated'
export type AlfaClubRoomTypeFilter = 'all' | AlfaRoomType
export type AlfaClubRoomTierFilter = 'all' | AlfaRoomTier

const RECENT_ROOMS_KEY = 'alfaclub:recent-room-ids:v1'
const MAX_RECENT_ROOMS = 6

export function formatRoomPoints(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('en-US', {
    notation: value >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value)
  return `${formatted} pts`
}

/** Format AlfaClub USDC amounts for directory/dashboard metrics. */
export function formatRoomUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: abs >= 1000 ? 0 : abs >= 1 ? 2 : 4,
  })
}

/**
 * AlfaClub snapshot prices/volumes are typically USDC with 6 decimals.
 * Values already in plain USD (e.g. fund_size) pass through unchanged.
 */
export function normalizeAlfaClubUsdc(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  if (raw >= 1_000_000) return raw / 1_000_000
  return raw
}

/**
 * Trading rooms encode their bonding-curve tier as a ring color around the
 * room avatar (amber = exclusive, sky = club, zinc = casual). Social rooms
 * have no curve tier, so they render with no ring at all.
 */
export function roomCurveTierRingClassName(room: {
  roomType: AlfaRoomType
  tier: AlfaRoomTier | null
}): string | null {
  if (room.roomType !== 'trading') return null
  if (room.tier === 'exclusive') return 'ring-amber-400'
  if (room.tier === 'club') return 'ring-sky-400'
  return 'ring-zinc-400'
}

export function formatRoomType(roomType: AlfaRoomType): string {
  switch (roomType) {
    case 'trading':
      return 'Trading Room'
    case 'social':
      return 'Social Room'
    default: {
      const exhaustive: never = roomType
      return exhaustive
    }
  }
}

export function sortAlfaClubRooms(
  rooms: readonly AlfaClubRoomDirectoryItem[],
  sort: AlfaClubRoomSort,
): AlfaClubRoomDirectoryItem[] {
  return [...rooms].sort((a, b) => {
    switch (sort) {
      case 'points':
        return (b.roomPoints ?? -1) - (a.roomPoints ?? -1)
      case 'keys':
        return (b.keySupply ?? -1) - (a.keySupply ?? -1)
      case 'updated':
        return Date.parse(b.ingestedAt) - Date.parse(a.ingestedAt)
      default: {
        const exhaustive: never = sort
        return exhaustive
      }
    }
  })
}

export function readRecentRoomIds(storage: Pick<Storage, 'getItem'> | null): string[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_ROOMS_KEY) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_ROOMS)
      : []
  } catch {
    return []
  }
}

export function rememberRecentRoom(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  roomId: string,
): string[] {
  const next = [roomId, ...readRecentRoomIds(storage).filter((id) => id !== roomId)].slice(
    0,
    MAX_RECENT_ROOMS,
  )
  try {
    storage?.setItem(RECENT_ROOMS_KEY, JSON.stringify(next))
  } catch {
    // Discovery remains usable when storage is unavailable.
  }
  return next
}
