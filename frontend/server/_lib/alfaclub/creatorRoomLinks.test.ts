import { describe, expect, it } from 'vitest'

import {
  formatAlfaClubBriefOpsRoomFooter,
  pickCreatorRoomIdFromSnapshotRows,
  readOperationalAlfaClubRoomIds,
  resolveRoomIdFromFriendKeyTokenId,
} from './creatorRoomLinks.js'

describe('pickCreatorRoomIdFromSnapshotRows', () => {
  it('prefers room_id matching metrics token id over ops-room chat noise', () => {
    const picked = pickCreatorRoomIdFromSnapshotRows(
      [
        { roomId: '1043', volume: 100 },
        { roomId: '2', volume: null },
      ],
      '2',
    )
    expect(picked).toBe('2')
  })

  it('falls back to highest volume when token id does not match a room', () => {
    const picked = pickCreatorRoomIdFromSnapshotRows(
      [
        { roomId: '19', volume: 10 },
        { roomId: '99', volume: 50 },
      ],
      '19',
    )
    expect(picked).toBe('19')
  })
})

describe('readOperationalAlfaClubRoomIds', () => {
  it('includes default bridge room 1043', () => {
    expect(readOperationalAlfaClubRoomIds().has('1043')).toBe(true)
  })
})

describe('resolveRoomIdFromFriendKeyTokenId', () => {
  it('maps numeric token ids to trading rooms but not ops room 1043', () => {
    expect(resolveRoomIdFromFriendKeyTokenId('2')).toBe('2')
    expect(resolveRoomIdFromFriendKeyTokenId('1043')).toBeNull()
    expect(resolveRoomIdFromFriendKeyTokenId('')).toBeNull()
  })
})

describe('formatAlfaClubBriefOpsRoomFooter', () => {
  it('explains when digest posts to ops room', () => {
    expect(formatAlfaClubBriefOpsRoomFooter('1043')).toContain('alfaclub.app')
    expect(formatAlfaClubBriefOpsRoomFooter('2')).toBeNull()
  })
})
