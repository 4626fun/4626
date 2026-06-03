import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatAlfaClubOpsRoomHelp,
  isAlfaClubOpsRoomId,
  resolveAlfaClubHelpText,
} from './alfaclubChatHelp.js'
import { formatHermitCommandRoomHelp } from '../hermit/hermitAlfaClubHelp.js'

describe('alfaclubChatHelp', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns comprehensive Hermit help for alfaclub:1659', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const text = resolveAlfaClubHelpText('alfaclub:1659')
    expect(text).toContain('/gmeow')
    expect(text).toContain('/meme')
    expect(text).toContain('/hermit setup')
    expect(text).toContain('/alfa brief')
    expect(text).toContain('Room 1659')
    expect(text).toContain('Hyperliquid')
    expect(text).not.toContain('Keepr')
  })

  it('returns comprehensive Hermit help for alfaclub:1043 when it is a Hermit room', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const text = resolveAlfaClubHelpText('alfaclub:1043')
    expect(text).toContain('/gmeow')
    expect(text).toContain('Hermit command room **1043**')
    expect(text).not.toContain('Keepr')
  })

  it('does not override help for non-hermit alfaclub rooms', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    expect(resolveAlfaClubHelpText('alfaclub:2')).toBeNull()
  })

  it('marks default bridge room as ops', () => {
    expect(isAlfaClubOpsRoomId('1043')).toBe(true)
    expect(formatAlfaClubOpsRoomHelp('1043')).toContain('1043')
  })

  it('formatHermitCommandRoomHelp includes personalization and cooldown copy', () => {
    const text = formatHermitCommandRoomHelp('1659')
    expect(text).toContain('degen')
    expect(text).toContain('Cooldowns')
    expect(text).toContain('/hermit prefs')
  })
})
