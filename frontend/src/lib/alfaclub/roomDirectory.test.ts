import { describe, expect, it } from 'vitest'

import {
  formatRoomPct,
  formatRoomPoints,
  formatRoomUsd,
  formatRoomUsdCompact,
  normalizeAlfaClubUsdc,
  readRecentRoomIds,
  rememberRecentRoom,
  sortAlfaClubRooms,
  type AlfaClubRoomDirectoryItem,
} from './roomDirectory'

function room(
  roomId: string,
  volumeUsdc: number,
  keySupply: number,
  ingestedAt: string,
  pnlPctAllTime: number | null = null,
): AlfaClubRoomDirectoryItem {
  return {
    roomId,
    roomName: `Room ${roomId}`,
    displayLabel: `Room ${roomId}`,
    creatorHandle: null,
    roomType: 'trading',
    tier: 'club',
    keySupply,
    roomPoints: volumeUsdc,
    keyPriceUsdc: null,
    buyPriceUsdc: null,
    sellPriceUsdc: null,
    volumeUsdc,
    feesGeneratedUsdc: null,
    tradingFundUsdc: null,
    pnlUsdc: null,
    pnlPct7d: null,
    pnlPct30d: null,
    pnlPctAllTime,
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

  it('normalizes micro-USDC snapshot amounts and formats USD/PnL metrics', () => {
    expect(normalizeAlfaClubUsdc(102_400_000)).toBe(102.4)
    expect(normalizeAlfaClubUsdc(225_000)).toBe(0.225)
    expect(normalizeAlfaClubUsdc(162_500)).toBe(0.1625)
    expect(formatRoomUsd(102.4)).toBe('$102.40')
    expect(formatRoomUsd(-285.01)).toBe('-$285.01')
    expect(formatRoomPct(11.161)).toBe('+11.2%')
    expect(formatRoomPct(-18.17)).toBe('-18.2%')
    expect(formatRoomUsd(null)).toBe('—')
  })

  it('formats compact USD for buy/sell sublines', () => {
    expect(formatRoomUsdCompact(0.225)).toBe('$0.23')
    expect(formatRoomUsdCompact(102.4)).toBe('$102.40')
  })


  it('sorts by volume, keys, pnl, or freshness', () => {
    const rooms = [
      room('1', 100, 50, '2026-07-10T00:00:00.000Z', 10),
      room('2', 200, 5, '2026-07-12T00:00:00.000Z', 30),
    ]
    expect(sortAlfaClubRooms(rooms, 'volume').map(({ roomId }) => roomId)).toEqual(['2', '1'])
    expect(sortAlfaClubRooms(rooms, 'points').map(({ roomId }) => roomId)).toEqual(['2', '1'])
    expect(sortAlfaClubRooms(rooms, 'keys').map(({ roomId }) => roomId)).toEqual(['1', '2'])
    expect(sortAlfaClubRooms(rooms, 'pnl').map(({ roomId }) => roomId)).toEqual(['2', '1'])
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
