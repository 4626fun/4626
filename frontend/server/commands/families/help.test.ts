import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatHermitCommandRoomHelp, HERMIT_COMMAND_ROOM_HELP_MAX_CHARS } from '../../_lib/alfaclub/hermitAlfaClubHelp.js'
import { executeHelpCommandFamily } from './help.js'

describe('executeHelpCommandFamily', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns Hermit catalog for /help in alfaclub:1659', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = executeHelpCommandFamily('/help', { chatId: 'alfaclub:1659' })
    expect(result?.ok).toBe(true)
    expect(result?.response).toContain('/gmeow')
    expect(result?.response).toContain('Room 1659')
    expect(result?.response).not.toContain('Keepr')
  })

  it('returns Hermit catalog for /help in alfaclub:1043 when configured as Hermit room', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = executeHelpCommandFamily('/help', { chatId: 'alfaclub:1043' })
    expect(result?.response).toContain('Hermit command room **1043**')
  })

  it('falls back to Keepr help for non-Hermit alfaclub creator rooms', () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = executeHelpCommandFamily('/help', { chatId: 'alfaclub:2' })
    expect(result?.response).toContain('Keepr')
  })

  it('falls back to Keepr help when chatId is absent', () => {
    const result = executeHelpCommandFamily('/help')
    expect(result?.response).toContain('Keepr')
  })

  it('does not match unrelated commands', () => {
    expect(executeHelpCommandFamily('/helpful')).toBeNull()
  })

  it('Hermit help body stays within AlfaClub bot message truncate budget', () => {
    const body1659 = formatHermitCommandRoomHelp('1659')
    const body1043 = formatHermitCommandRoomHelp('1043')
    expect(body1659.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
    expect(body1043.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
  })
})
