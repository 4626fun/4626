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
    sell_price_raw: '99225000',
    mid_price_raw: '100812500',
    fund_size_raw: '628.232661',
    creator_reward_raw: '69711000',
    pnl_raw: '1131.5698460556935',
    pnl_pct_7d_raw: '11.161349502606623',
    pnl_pct_30d_raw: '34.5148710212019',
    pnl_pct_all_raw: '25.992230711436697',
    image_url: 'https://example.com/akita.gif',
    room_description: 'The AKITA room',
    featured: true,
    unique_holders_raw: '42',
    ingested_at: '2026-07-12T12:00:00.000Z',
    ...overrides,
  }
}

describe('AlfaClub room directory mapping', () => {
  it('scales micro-USDC markets and exposes buy/sell plus fund PnL windows', () => {
    expect(rowToAlfaClubRoomDirectoryItem(snapshotRow())).toEqual({
      roomId: '1659',
      roomName: 'AKITA',
      displayLabel: 'AKITA by wenakita',
      creatorHandle: 'wenakita',
      roomType: 'social',
      tier: 'exclusive',
      keySupply: 101,
      roomPoints: 3490.65,
      keyPriceUsdc: 100.8125,
      buyPriceUsdc: 102.4,
      sellPriceUsdc: 99.225,
      volumeUsdc: 3490.65,
      feesGeneratedUsdc: 69.711,
      tradingFundUsdc: 628.232661,
      pnlUsdc: 1131.5698460556935,
      pnlPct7d: 11.161349502606623,
      pnlPct30d: 34.5148710212019,
      pnlPctAllTime: 25.992230711436697,
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

  it('scales sub-$1 micro-USDC prices (e.g. low-supply Club rooms)', () => {
    const item = rowToAlfaClubRoomDirectoryItem(
      snapshotRow({
        room_id: '385',
        room_name: 'BORED',
        creator_twitter_username: 'BoredEloonMusk',
        room_type: 'trading',
        tier: 'club',
        volume_col_raw: '975000',
        supply_col_raw: '3',
        buy_price_raw: '225000',
        sell_price_raw: '100000',
        mid_price_raw: '162500',
        fund_size_raw: '0.0585',
        creator_reward_raw: '19500',
        pnl_raw: '0',
        pnl_pct_7d_raw: '0',
        pnl_pct_30d_raw: '0',
        pnl_pct_all_raw: '0',
        featured: false,
        unique_holders_raw: '3',
      }),
    )
    expect(item.keyPriceUsdc).toBe(0.1625)
    expect(item.buyPriceUsdc).toBe(0.225)
    expect(item.sellPriceUsdc).toBe(0.1)
    expect(item.volumeUsdc).toBe(0.975)
    expect(item.feesGeneratedUsdc).toBe(0.0195)
    expect(item.tradingFundUsdc).toBe(0.0585)
  })

