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
    expect(result.response).toContain('🎮 <b>Commands</b>')
    expect(result.response).toContain('<code>/start</code>')
    expect(result.response).toContain('Need more?')
    expect(result.response).toContain('/help core')
    expect(result.response).toContain('/help all')
    expect(result.response).toContain('/help wallet')
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

  it('returns ops topic help', async () => {
    const result = await executeCommand({
      groupId: 'group-help-2c',
      senderWallet: TEST_WALLET,
      text: '/help ops',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('🛠 <b>Ops Commands</b>')
    expect(result.response).toContain('<code>/keepr status</code>')
    expect(result.response).toContain('<code>/keepr rules</code>')
  })

  it('returns full help with /help all', async () => {
    const result = await executeCommand({
      groupId: 'group-help-3',
      senderWallet: TEST_WALLET,
      text: '/help all',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — Help</b>')
    expect(result.response).toContain('🎮 <b>Core Commands</b>')
    expect(result.response).toContain('🪙 <b>Coin Commands</b>')
    expect(result.response).toContain('🛠 <b>Ops Commands</b>')
    expect(result.response).toContain('👛 <b>Wallet Commands</b>')
    expect(result.response).toContain('👥 <b>Group Commands</b>')
    expect(result.response).toContain('<code>/wallet</code> — wallet balances, positions, and activity')
    expect(result.response).toContain('<code>/coin trend check &lt;ticker&gt;</code>')
    expect(result.response).toContain('/reputation')
    expect(result.response).toContain('/ai &lt;question&gt;')
    expect(result.response).not.toContain('/ai <question>')
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
