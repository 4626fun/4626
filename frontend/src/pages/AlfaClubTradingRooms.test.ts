import { describe, expect, it } from 'vitest'

import { resolveAlfaClubRoomHubTab } from './AlfaClubTradingRooms'

describe('AlfaClub room hub tab routing', () => {
  it('defaults missing and invalid tabs to overview', () => {
    expect(resolveAlfaClubRoomHubTab(null, '1659')).toBe('overview')
    expect(resolveAlfaClubRoomHubTab('unknown', '1659')).toBe('overview')
  })

  it('folds legacy safety links into overview and limits inverse to room 1659', () => {
    expect(resolveAlfaClubRoomHubTab('safety', '9')).toBe('overview')
    expect(resolveAlfaClubRoomHubTab('liquidity', '9')).toBe('liquidity')
    expect(resolveAlfaClubRoomHubTab('inverse', '1659')).toBe('inverse')
    expect(resolveAlfaClubRoomHubTab('inverse', '9')).toBe('overview')
  })
})
