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
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
    expect(result.response).toContain('<u>start</u>')
    expect(result.response).toContain('/buy | /sell | /bid')
    expect(result.response).toContain('/help core|coin|market|social|ops|bankr|wallet')
    expect(result.response).toContain('/help all')
    expect(result.response).toContain('/wallet')
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
    expect(result.response).toContain('<b>Keepr — market</b>')
    expect(result.response).toContain('<code>/mkt quote <symbol></code>')
    expect(result.response).not.toContain('/coin create')
  })

  it('returns full help with /help all', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-3',
      senderWallet: TEST_WALLET,
      text: '/help all',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — Help</b>')
    expect(result.response).toContain('<blockquote>Use <code>/help</code> for the short version')
    expect(result.response).toContain('<u>start</u>')
    expect(result.response).toContain('<u>advanced</u>')
    expect(result.response).toContain('<code>/wallet</code> — wallet, positions, and recent actions')
    expect(result.response).toContain('<code>/coin create <name> <symbol> <uri></code>')
    expect(result.response).toContain('<code>/coin trend funnel <ticker> <eth-amount></code>')
    expect(result.response).toContain('<code>/mkt news <symbol> [limit]</code>')
    expect(result.response).toContain('<code>/cre tend vault</code>')
    expect(result.response).toContain('<code>/bankr balances base,solana</code>')
    expect(result.response).toContain('<code>/reputation <agentId></code>')
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
    expect(result.response).toContain('<blockquote>Unknown help topic: <code>bananas</code></blockquote>')
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
  })
})
