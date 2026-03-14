import { describe, expect, it } from 'vitest'

import { handleKeeprCommand } from '../commands.ts'

const TEST_WALLET = '0x00000000000000000000000000000000000000aa' as const

describe('keepr help commands', () => {
  it('returns compact quick help by default', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-1',
      senderWallet: TEST_WALLET,
      text: '/help',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Keepr quick help')
    expect(result.response).toContain('Start here (30 seconds)')
    expect(result.response).toContain('/buy | /sell | /bid')
    expect(result.response).toContain('/help core | coin | market | social | ops | bankr | wallet')
    expect(result.response).toContain('/help all')
    expect(result.response).not.toContain('/coin trend funnel')
    expect(result.response).not.toContain('/inline')
  })

  it('returns market topic help from /help market', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-2',
      senderWallet: TEST_WALLET,
      text: '/help market',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Keepr help - market')
    expect(result.response).toContain('/mkt quote <symbol>')
    expect(result.response).not.toContain('/coin create')
  })

  it('returns full help with /help all', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-3',
      senderWallet: TEST_WALLET,
      text: '/help all',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Keepr commands (full)')
    expect(result.response).toContain('/coin trend funnel')
    expect(result.response).toContain('/bankr exec <instruction> --confirm')
  })

  it('falls back to quick help with an unknown topic', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-4',
      senderWallet: TEST_WALLET,
      text: '/help bananas',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Unknown help topic: bananas')
    expect(result.response).toContain('Keepr quick help')
  })
})
