import { describe, expect, it } from 'vitest'

import { executeCommand } from '../../commands/execute.ts'

const TEST_WALLET = '0x00000000000000000000000000000000000000aa' as const

describe('keepr help commands', () => {
  it('returns compact quick help by default', async () => {
    const result = await executeCommand({
      groupId: 'group-help-1',
      senderWallet: TEST_WALLET,
      text: '/help',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
    expect(result.response).toContain('🎮 <b>Start Here</b>')
    expect(result.response).toContain('/buy | /sell | /bid')
    expect(result.response).toContain('/help core|coin|social|ops|wallet')
    expect(result.response).toContain('/help all')
    expect(result.response).toContain('/wallet')
    expect(result.response).not.toContain('/coin trend funnel')
    expect(result.response).not.toContain('/inline')
  })

  it('treats removed market help as an unknown topic', async () => {
    const result = await executeCommand({
      groupId: 'group-help-2',
      senderWallet: TEST_WALLET,
      text: '/help market',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Unknown help topic: <code>market</code>')
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
  })

  it('treats removed arena help as an unknown topic', async () => {
    const result = await executeCommand({
      groupId: 'group-help-2b',
      senderWallet: TEST_WALLET,
      text: '/help arena',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Unknown help topic: <code>arena</code>')
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
  })

  it('returns ops topic help with canonical Solana action names', async () => {
    const result = await executeCommand({
      groupId: 'group-help-2c',
      senderWallet: TEST_WALLET,
      text: '/help ops',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — ops</b>')
    expect(result.response).toContain('<code>/cre settle-fees</code>')
    expect(result.response).toContain('<code>/cre relay-entries</code>')
  })

  it('returns full help with /help all', async () => {
    const result = await executeCommand({
      groupId: 'group-help-3',
      senderWallet: TEST_WALLET,
      text: '/help all',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — Help</b>')
    expect(result.response).toContain('Use <code>/help</code> for quick start')
    expect(result.response).toContain('🎮 <b>Core Commands</b>')
    expect(result.response).toContain('└ <code>/id</code> — pick a user, group, or channel ID')
    expect(result.response).toContain('🛠 <b>Operator / Admin</b>')
    expect(result.response).toContain('📚 <b>Topic Guides</b>')
    expect(result.response).toContain('<code>/wallet</code> — balances and positions')
    expect(result.response).toContain('<code>/coin create &lt;name&gt; &lt;symbol&gt; &lt;uri&gt;</code>')
    expect(result.response).toContain('<code>/coin trend funnel &lt;ticker&gt; &lt;eth-amount&gt;</code>')
    expect(result.response).toContain('<code>/cre status | /cre health | /cre auction | /cre solana</code>')
    expect(result.response).toContain('<code>/cre tend | /cre report | /cre settle-fees | /cre relay-entries</code>')
    expect(result.response).toContain('/reputation')
    expect(result.response).toContain('/coin trend funnel')
    expect(result.response).toContain('/ai &lt;question&gt;')
    expect(result.response).not.toContain('/ai <question>')
    expect(result.response).not.toContain('/mkt')
    expect(result.response).not.toContain('<blockquote expandable>')
  })

  it('falls back to quick help with an unknown topic', async () => {
    const result = await executeCommand({
      groupId: 'group-help-4',
      senderWallet: TEST_WALLET,
      text: '/help bananas',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Unknown help topic: <code>bananas</code>')
    expect(result.response).toContain('<b>Keepr — Quick Start</b>')
  })
})
