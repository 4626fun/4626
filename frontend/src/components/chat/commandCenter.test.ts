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
    const command = getChatCommandByCommandText('   /BANKR   STATUS   ')
    expect(command?.id).toBe('bankr-status')
  })

  it('returns slash autocomplete suggestions for partial input', () => {
    const suggestions = searchChatCommands('/bankr', 5)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((entry) => entry.id === 'bankr-status')).toBe(true)
  })

  it('infers follow-up command context from agent output', () => {
    expect(inferCommandIdFromAgentText('Bankr status looks healthy.')).toBe('bankr-status')
    expect(inferCommandIdFromAgentText('Unknown output without hints')).toBeNull()
  })

  it('resolves configured follow-up chips', () => {
    const followUps = listChatFollowUps('vault-status')
    expect(followUps.map((entry) => entry.id)).toEqual(['vault-rules', 'cre-health'])
  })

  it('registers AI assistant seed command for mini-app deep links', () => {
    const command = getChatCommandById('ai-assistant')
    expect(command?.command).toContain('/ai ')
  })
})
