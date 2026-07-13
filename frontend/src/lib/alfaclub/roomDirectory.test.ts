import { describe, expect, it } from 'vitest'

import {
  formatRoomPoints,
  readRecentRoomIds,
  rememberRecentRoom,
  sortAlfaClubRooms,
  type AlfaClubRoomDirectoryItem,
} from './roomDirectory'

function room(
  roomId: string,
  roomPoints: number,
  keySupply: number,
  ingestedAt: string,
): AlfaClubRoomDirectoryItem {
  return {
    roomId,
    roomName: `Room ${roomId}`,
    displayLabel: `Room ${roomId}`,
    creatorHandle: null,
    roomType: 'trading',
    tier: 'club',
    keySupply,
    roomPoints,
    imageUrl: null,
    description: null,
    featured: false,
    uniqueHolders: null,
    ingestedAt,
  }
}

describe('AlfaClub room directory helpers', () => {
  it('formats points without currency semantics', () => {
    expect(formatRoomPoints(12_400)).toBe('12.4K pts')
    expect(formatRoomPoints(42)).toBe('42 pts')
    expect(formatRoomPoints(null)).toBe('—')
  })

  it('sorts by points, keys, or freshness', () => {
    const rooms = [
      room('1', 100, 50, '2026-07-10T00:00:00.000Z'),
      room('2', 200, 5, '2026-07-12T00:00:00.000Z'),
    ]
    expect(sortAlfaClubRooms(rooms, 'points').map(({ roomId }) => roomId)).toEqual(['2', '1'])
    expect(sortAlfaClubRooms(rooms, 'keys').map(({ roomId }) => roomId)).toEqual(['1', '2'])
    expect(sortAlfaClubRooms(rooms, 'updated').map(({ roomId }) => roomId)).toEqual(['2', '1'])
  })

  it('keeps a bounded, deduplicated recent-room history', () => {
    let raw: string | null = JSON.stringify(['2', '1'])
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value
      },
    }
    expect(rememberRecentRoom(storage, '1')).toEqual(['1', '2'])
    expect(readRecentRoomIds(storage)).toEqual(['1', '2'])
  })
})
