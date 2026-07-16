import { describe, expect, it } from 'vitest'

import { alfaclubRoomPrimaryTitle, formatAlfaClubRoomLabel } from './roomLabel'

describe('formatAlfaClubRoomLabel', () => {
  it('combines room title and creator handle', () => {
    expect(
      formatAlfaClubRoomLabel({
        roomId: '1659',
        roomName: 'AKITA',
        creatorHandle: 'wenakita',
      }),
    ).toBe('AKITA by wenakita')
  })

  it('falls back to handle when room title is generic', () => {
    expect(
      formatAlfaClubRoomLabel({
        roomId: '518',
        roomName: 'Room #518',
        creatorHandle: 'somecreator',
      }),
    ).toBe('somecreator')
  })

  it('falls back to room id when nothing else exists', () => {
    expect(
      formatAlfaClubRoomLabel({
        roomId: '42',
        roomName: null,
        creatorHandle: null,
      }),
    ).toBe('Room #42')
  })
})

describe('alfaclubRoomPrimaryTitle', () => {
  it('omits the trailing by-handle when the handle is shown separately', () => {
    expect(
      alfaclubRoomPrimaryTitle({
        roomId: '1',
        roomName: 'AlfaClub Official',
        creatorHandle: 'AlfaClubdotapp',
        displayLabel: 'AlfaClub Official by AlfaClubdotapp',
      }),
    ).toBe('AlfaClub Official')
  })
})

  it('uses Room #id for generic titles so the handle is not duplicated', () => {
    expect(
      alfaclubRoomPrimaryTitle({
        roomId: '1',
        roomName: 'Room 1',
        creatorHandle: 'AlfaClubdotapp',
      }),
    ).toBe('Room #1')
  })
