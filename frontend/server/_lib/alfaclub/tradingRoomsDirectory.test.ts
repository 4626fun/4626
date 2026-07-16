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
    buy_price_raw: '102400000',
    mid_price_raw: '100812500',
    fund_size_raw: '628.232661',
    creator_reward_raw: '69711000',
    image_url: 'https://example.com/akita.gif',
    room_description: 'The AKITA room',
    featured: true,
    unique_holders_raw: '42',
    ingested_at: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('AlfaClub room directory mapping', () => {
  it('preserves room points and exposes USD market metrics', () => {
    expect(rowToAlfaClubRoomDirectoryItem(snapshotRow())).toEqual({
      roomId: '1659',
      roomName: 'AKITA',
      displayLabel: 'AKITA by wenakita',
      creatorHandle: 'wenakita',
      roomType: 'social',
      tier: 'exclusive',
      keySupply: 101,
      roomPoints: 3_490_650_000,
      keyPriceUsdc: 100.8125,
      volumeUsdc: 3490.65,
      feesGeneratedUsdc: 69.711,
      tradingFundUsdc: 628.232661,
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
