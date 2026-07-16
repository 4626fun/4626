import { describe, expect, it } from 'vitest'

import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'

import { filterAlfaClubExploreRooms } from './AlfaClubExploreRooms'

const ROOMS: AlfaClubRoomDirectoryItem[] = [
  {
    roomId: '1659',
    roomName: 'AKITA',
    displayLabel: 'AKITA by wenakita',
    creatorHandle: 'wenakita',
    roomType: 'trading',
    tier: 'exclusive',
    keySupply: 64,
    roomPoints: 3_500,
    keyPriceUsdc: null,
    volumeUsdc: null,
    feesGeneratedUsdc: null,
    tradingFundUsdc: null,
    imageUrl: null,
    description: 'Inverse market opinions',
    featured: true,
    uniqueHolders: 18,
    ingestedAt: '2026-07-15T12:00:00.000Z',
  },
  {
    roomId: '42',
    roomName: 'Builders',
    displayLabel: 'Builders by alice',
    creatorHandle: 'alice',
    roomType: 'social',
    tier: null,
    keySupply: 12,
    roomPoints: 800,
    keyPriceUsdc: null,
    volumeUsdc: null,
    feesGeneratedUsdc: null,
    tradingFundUsdc: null,
    imageUrl: null,
    description: 'A room for product builders',
    featured: false,
    uniqueHolders: 9,
    ingestedAt: '2026-07-15T13:00:00.000Z',
  },
  {
    roomId: '7',
    roomName: 'Macro',
    displayLabel: 'Macro desk',
    creatorHandle: 'bob',
    roomType: 'trading',
    tier: 'club',
    keySupply: 91,
    roomPoints: 1_200,
    keyPriceUsdc: null,
    volumeUsdc: null,
    feesGeneratedUsdc: null,
    tradingFundUsdc: null,
    imageUrl: null,
    description: 'Macro markets',
    featured: false,
    uniqueHolders: 21,
    ingestedAt: '2026-07-15T11:00:00.000Z',
  },
]

describe('filterAlfaClubExploreRooms', () => {
  it('searches room identity and creator fields', () => {
    expect(
      filterAlfaClubExploreRooms(ROOMS, {
        query: 'wenakita',
        roomType: 'all',
        tier: 'all',
        sort: 'points',
      }).map((room) => room.roomId),
    ).toEqual(['1659'])
  })

  it('filters by room type and curve tier', () => {
    expect(
      filterAlfaClubExploreRooms(ROOMS, {
        query: '',
        roomType: 'trading',
        tier: 'club',
        sort: 'points',
      }).map((room) => room.roomId),
    ).toEqual(['7'])
  })

  it('uses the requested directory sort', () => {
    expect(
      filterAlfaClubExploreRooms(ROOMS, {
        query: '',
        roomType: 'all',
        tier: 'all',
        sort: 'keys',
      }).map((room) => room.roomId),
    ).toEqual(['7', '1659', '42'])
  })
})
