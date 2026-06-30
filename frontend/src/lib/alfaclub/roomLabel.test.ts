import { describe, expect, it } from 'vitest'

import { formatAlfaClubRoomLabel } from './roomLabel'

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
