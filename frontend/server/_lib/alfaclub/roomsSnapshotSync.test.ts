import { describe, expect, it } from 'vitest'

import {
  mapRoomDetailPayload,
  readRoomsSnapshotSyncFlags,
} from './roomsSnapshotSync.js'

const ROOM_1659_FIXTURE = {
  data: {
    room: {
      id: '1659',
      sn: '1659',
      roomType: 'Trading',
      tier: 'Club',
      featured: true,
      createdAt: '2026-05-28T04:17:43.000Z',
      updatedAt: '2026-07-04T05:30:19.000Z',
      creator: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      walletAddress: '0xEbF94fA19DB7d2E7905dEcD01DaE4ea9eb4C1FF2',
      currentSupply: '64',
      volume: '3490650000',
      buyPrice: '102400000',
      sellPrice: '99225000',
      midPrice: '100812500',
      fundSize: '863.0649309999999',
      pnl: '1366.4021160556936',
      pnlPercentage7d: '6.411830646254202',
      pnlPercentage30d: '44.01124273906727',
      pnlPercentageAllTime: '31.386342759938547',
      ethosScore: '1276',
      metadataId: '7700319a-b5c2-49d1-9243-f7fc356800b3',
    },
    creator: {
      address: '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9',
      twitter_username: 'wenakita',
      points: '3288256.7413716966057',
      ethosScore: '1276',
    },
    metadata: {
      id: '7700319a-b5c2-49d1-9243-f7fc356800b3',
      name: 'AKITA',
      description: 'creator room',
      image: 'https://example.com/akita.png',
    },
    unique_holders: 18,
  },
}

describe('roomsSnapshotSync', () => {
  it('maps AlfaClub room detail payload into snapshot columns', () => {
    const mapped = mapRoomDetailPayload(ROOM_1659_FIXTURE)
    expect(mapped).not.toBeNull()
    expect(mapped?.roomId).toBe('1659')
    expect(mapped?.row.room_type).toBe('trading')
    expect(mapped?.row.tier).toBe('club')
    expect(mapped?.row.creator_twitter_username).toBe('wenakita')
    expect(mapped?.row.wallet_address).toBe('0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2')
    expect(mapped?.row.room_name).toBe('AKITA')
    expect(mapped?.row.unique_holders).toBe(18)
    expect(mapped?.row.source).toBe('room_detail')
    expect(mapped?.raw.room).toMatchObject({ id: '1659' })
  })

  it('returns null for payloads without a room block', () => {
    expect(mapRoomDetailPayload({ data: {} })).toBeNull()
    expect(mapRoomDetailPayload(null)).toBeNull()
  })

  it('reads sync flags with safe defaults', () => {
    const flags = readRoomsSnapshotSyncFlags()
    expect(flags.enabled).toBe(true)
    expect(flags.batchSize).toBeGreaterThan(0)
    expect(flags.concurrency).toBeGreaterThan(0)
  })
})
