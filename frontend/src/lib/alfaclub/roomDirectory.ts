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
