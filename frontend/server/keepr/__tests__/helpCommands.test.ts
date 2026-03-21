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
    expect(result.response).toContain('/help core|coin|market|social|ops|bankr|wallet|arena')
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
    expect(result.response).toContain('<code>/mkt quote &lt;symbol&gt;</code>')
    expect(result.response).not.toContain('/coin create')
  })

  it('returns arena topic help from /help arena', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-help-2b',
      senderWallet: TEST_WALLET,
      text: '/help arena',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — arena</b>')
    expect(result.response).toContain('/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6')
    expect(result.response).toContain('/arena watch on | off | status')
    expect(result.response).toContain('CLASH_OF_CLAW_API_KEY')
  })

  it('returns ops topic help with canonical Solana action names', async () => {
    const result = await handleKeeprCommand({
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
    const result = await handleKeeprCommand({
      groupId: 'group-help-3',
      senderWallet: TEST_WALLET,
      text: '/help all',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — Help</b>')
    expect(result.response).toContain('<blockquote>Use <code>/help</code> for quick mode')
    expect(result.response).toContain('<blockquote expandable>')
    expect(result.response).toContain('<u>start</u>')
    expect(result.response).toContain('<u>advanced</u>')
    expect(result.response).toContain('<code>/wallet</code> — wallet + positions')
    expect(result.response).toContain('<code>/coin create &lt;name&gt; &lt;symbol&gt; &lt;uri&gt;</code>')
    expect(result.response).toContain('<code>/coin trend funnel &lt;ticker&gt; &lt;eth-amount&gt;</code>')
    expect(result.response).toContain('<code>/mkt news &lt;symbol&gt; [limit]</code>')
    expect(result.response).toContain('<code>/help arena</code> — Clash of Claw controls')
    expect(result.response).toContain('<code>/cre auction | /cre solana | /cre tend | /cre report | /cre settle-fees | /cre relay-entries</code>')
    expect(result.response).toContain('<code>/bankr status | /bankr me | /bankr balances</code>')
    expect(result.response).toContain('/reputation')
    expect(result.response).toContain('/coin trend funnel')
    expect(result.response).toContain('/bankr exec &lt;instruction&gt; --confirm')
    expect(result.response).toContain('/ai &lt;question&gt;')
    expect(result.response).not.toContain('/ai <question>')
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
