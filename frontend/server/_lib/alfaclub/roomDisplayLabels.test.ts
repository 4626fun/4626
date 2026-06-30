import { describe, expect, it } from 'vitest'

import { materializeRoomDisplayFields } from './roomDisplayLabels.js'

describe('materializeRoomDisplayFields', () => {
  it('combines metadata room title and creator handle', () => {
    expect(
      materializeRoomDisplayFields({
        roomId: '1',
        roomName: 'AlfaClub Official',
        creatorHandle: 'AlfaClubdotapp',
      }),
    ).toEqual({
      roomName: 'AlfaClub Official',
      creatorHandle: 'AlfaClubdotapp',
      displayLabel: 'AlfaClub Official by AlfaClubdotapp',
    })
  })

  it('uses cached display label when snapshot title is missing', () => {
    expect(
      materializeRoomDisplayFields({
        roomId: '1040',
        roomName: null,
        creatorHandle: null,
        cachedDisplayLabel: 'WIZO',
      }),
    ).toEqual({
      roomName: 'WIZO',
      creatorHandle: null,
      displayLabel: 'WIZO',
    })
  })
})
