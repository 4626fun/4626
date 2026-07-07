import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  isAmoeAllowlistPublisherEnabled,
  publishAllowlistEpoch,
  readAmoeAllowlistPublisherPrivateKey,
} from '../lottery/amoeAllowlistPublisher.js'

describe('amoeAllowlistPublisher', () => {
  const prevEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...prevEnv }
  })

  afterEach(() => {
    process.env = prevEnv
  })

  it('isAmoeAllowlistPublisherEnabled is false by default', () => {
    delete process.env.AMOE_ALLOWLIST_PUBLISHER_ENABLED
    expect(isAmoeAllowlistPublisherEnabled()).toBe(false)
  })

  it('isAmoeAllowlistPublisherEnabled is true when flag is 1', () => {
    process.env.AMOE_ALLOWLIST_PUBLISHER_ENABLED = '1'
    expect(isAmoeAllowlistPublisherEnabled()).toBe(true)
  })

  it('falls back to LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY when allowlist key unset', () => {
    delete process.env.AMOE_ALLOWLIST_PUBLISHER_PRIVATE_KEY
    delete process.env.AMOE_LEDGER_PUBLISHER_PRIVATE_KEY
    process.env.LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY = `0x${'aa'.repeat(32)}`
    expect(readAmoeAllowlistPublisherPrivateKey()).toBe(`0x${'aa'.repeat(32)}`)
  })

  it('publishAllowlistEpoch no-ops when epoch snapshot already confirmed', async () => {
    const sql = vi.fn(async () => ({
      rows: [{ publish_confirmed_at: new Date().toISOString() }],
    }))
    const db = { sql } as any
    const outcome = await publishAllowlistEpoch({
      db,
      epoch: 42n,
      lotteryAmoeRouter: '0x0000000000000000000000000000000000000001',
      publisherVersion: 'test',
    })
    expect(outcome.kind).toBe('already_confirmed')
  })
})
