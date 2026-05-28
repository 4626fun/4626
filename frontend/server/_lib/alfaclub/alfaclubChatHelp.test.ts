import { describe, expect, it } from 'vitest'

import {
  formatAlfaClubOpsRoomHelp,
  isAlfaClubOpsRoomId,
  resolveAlfaClubHelpText,
} from './alfaclubChatHelp.js'

describe('alfaclubChatHelp', () => {
  it('returns ops-room help for alfaclub:1043', () => {
    const text = resolveAlfaClubHelpText('alfaclub:1043')
    expect(text).toContain('/gmeow')
    expect(text).toContain('room 2')
    expect(text).not.toContain('Keepr')
  })

  it('does not override help for non-ops alfaclub rooms', () => {
    expect(resolveAlfaClubHelpText('alfaclub:2')).toBeNull()
  })

  it('marks default bridge room as ops', () => {
    expect(isAlfaClubOpsRoomId('1043')).toBe(true)
    expect(formatAlfaClubOpsRoomHelp('1043')).toContain('1043')
  })
})
