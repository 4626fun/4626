import { describe, expect, it } from 'vitest'

import {
  rowToAlfaClubRoomDirectoryItem,
  type AlfaClubRoomSnapshotRow,
} from './tradingRoomsDirectory.js'

function snapshotRow(
  overrides: Partial<AlfaClubRoomSnapshotRow> = {},
): AlfaClubRoomSnapshotRow {
  return {
    room_id: '1659',
    room_name: 'AKITA',
    creator_twitter_username: 'wenakita',
    cached_display_label: null,
    room_type: 'social',
    tier: 'exclusive',
    volume_col_raw: '3490650000',
    volume_raw: null,
    supply_col_raw: '101',
    supply_raw: null,
    image_url: 'https://example.com/akita.gif',
    room_description: 'The AKITA room',
    featured: true,
    unique_holders_raw: '42',
    ingested_at: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('AlfaClub room directory mapping', () => {
  it('preserves room points without currency scaling and exposes discovery metadata', () => {
    expect(rowToAlfaClubRoomDirectoryItem(snapshotRow())).toEqual({
      roomId: '1659',
      roomName: 'AKITA',
      displayLabel: 'AKITA by wenakita',
      creatorHandle: 'wenakita',
      roomType: 'social',
      tier: 'exclusive',
      keySupply: 101,
      roomPoints: 3_490_650_000,
      imageUrl: 'https://example.com/akita.gif',
      description: 'The AKITA room',
      featured: true,
      uniqueHolders: 42,
      ingestedAt: '2026-07-12T12:00:00.000Z',
    })
  })

  it('keeps canonical curve tiers and safely defaults unknown room types', () => {
    const item = rowToAlfaClubRoomDirectoryItem(
      snapshotRow({ room_type: 'unknown', tier: 'club' }),
    )
    expect(item.roomType).toBe('trading')
    expect(item.tier).toBe('club')
  })
})
