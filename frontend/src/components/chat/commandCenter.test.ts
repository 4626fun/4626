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
    const command = getChatCommandByCommandText('   /CRE   STATUS   ')
    expect(command?.id).toBe('cre-status')
  })

  it('returns slash autocomplete suggestions for partial input', () => {
    const suggestions = searchChatCommands('/cre', 5)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((entry) => entry.id === 'cre-health')).toBe(true)
  })

  it('infers follow-up command context from agent output', () => {
    expect(inferCommandIdFromAgentText('CRE status looks healthy.')).toBe('cre-status')
    expect(inferCommandIdFromAgentText('Fees settled on Solana.')).toBe('cre-settle-fees')
    expect(inferCommandIdFromAgentText('Relay entries from Solana now.')).toBe('cre-relay-entries')
    expect(inferCommandIdFromAgentText('Unknown output without hints')).toBeNull()
  })

  it('resolves configured follow-up chips', () => {
    const followUps = listChatFollowUps('cre-solana')
    expect(followUps.map((entry) => entry.id)).toEqual(['cre-health', 'cre-settle-fees', 'cre-relay-entries'])
  })

  it('registers AI assistant seed command for mini-app deep links', () => {
    const command = getChatCommandById('ai-assistant')
    expect(command?.command).toContain('/ai ')
  })

  it('resolves the canonical Solana CRE commands', () => {
    expect(getChatCommandByCommandText('/cre settle-fees')?.id).toBe('cre-settle-fees')
    expect(getChatCommandByCommandText('/cre relay-entries')?.id).toBe('cre-relay-entries')
  })
})
