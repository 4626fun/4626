import { describe, expect, it } from 'vitest'

import {
  getChatCommandById,
  getChatCommandByCommandText,
  inferCommandIdFromAgentText,
  listChatFollowUps,
  searchChatCommands,
} from './commandCenter'

describe('chat command center helpers', () => {
  it('normalizes command text lookups', () => {
    const command = getChatCommandByCommandText('   /keepr   status   ')
    expect(command?.id).toBe('keeper-status')
  })

  it('returns slash autocomplete suggestions for partial input', () => {
    const suggestions = searchChatCommands('/keepr', 5)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((entry) => entry.id === 'keeper-health')).toBe(true)
  })

  it('infers follow-up command context from agent output', () => {
    expect(inferCommandIdFromAgentText('keeper status looks healthy.')).toBe('keeper-status')
    expect(inferCommandIdFromAgentText('Fees settled on Solana by keeper.')).toBe('keeper-settle-fees')
    expect(inferCommandIdFromAgentText('Relay entries from Solana by keeper now.')).toBe('keeper-relay-entries')
    expect(inferCommandIdFromAgentText('Unknown output without hints')).toBeNull()
  })

  it('resolves configured follow-up chips', () => {
    const followUps = listChatFollowUps('keeper-solana')
    expect(followUps.map((entry) => entry.id)).toEqual(['keeper-health', 'keeper-settle-fees', 'keeper-relay-entries'])
  })

  it('registers AI assistant seed command for mini-app deep links', () => {
    const command = getChatCommandById('ai-assistant')
    expect(command?.command).toContain('/ai ')
  })

  it('resolves the canonical Solana keeper commands', () => {
    expect(getChatCommandByCommandText('/keepr settle-fees')?.id).toBe('keeper-settle-fees')
    expect(getChatCommandByCommandText('/keepr relay-entries')?.id).toBe('keeper-relay-entries')
  })
})
