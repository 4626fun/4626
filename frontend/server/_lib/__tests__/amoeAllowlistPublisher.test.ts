import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  isAmoeAllowlistPublisherEnabled,
  pickNextAllowlistEpochToPublish,
  publishAllowlistEpoch,
  readAmoeAllowlistPublisherPrivateKey,
} from '../lottery/amoeAllowlistPublisher.js'
import {
  AMOE_ALLOWLIST_ROOT_MISMATCH,
  AMOE_ON_CHAIN_RECONCILED_TX,
  AMOE_ZERO_ROOT,
} from '../lottery/amoePublisherRoleGuard.js'

const ROOT_A = ('0x' + '11'.repeat(32)) as `0x${string}`
const ROOT_B = ('0x' + '22'.repeat(32)) as `0x${string}`
const ROUTER = '0x0000000000000000000000000000000000000001' as const

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
      lotteryAmoeRouter: ROUTER,
      publisherVersion: 'test',
    })
    expect(outcome.kind).toBe('already_confirmed')
  })

  it('reconciles already-on-chain root without broadcasting', async () => {
    const updates: string[] = []
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ')
      if (q.includes('publish_confirmed_at IS NOT NULL')) {
        return { rows: [] }
      }
      if (q.includes('SELECT root_hex, publish_tx_hash')) {
        return { rows: [{ root_hex: ROOT_A, publish_tx_hash: null }] }
      }
      if (q.includes('SET publish_tx_hash')) {
        updates.push(String(strings.concat([] as any)))
        return { rows: [] }
      }
      return { rows: [] }
    })
    const broadcast = vi.fn()
    const outcome = await publishAllowlistEpoch({
      db: { sql } as any,
      epoch: 42n,
      lotteryAmoeRouter: ROUTER,
      publisherVersion: 'test',
      broadcast,
      readOnChainRoot: async () => ROOT_A,
    })
    expect(outcome).toEqual({
      kind: 'already_on_chain',
      epoch: 42n,
      rootHex: ROOT_A,
    })
    expect(broadcast).not.toHaveBeenCalled()
    expect(updates.length).toBe(1)
    // Ensure sentinel stamp path ran (sql called with reconciled sentinel via values)
    const stampCall = sql.mock.calls.find((c) =>
      String(c[0]?.join?.(' ') ?? c[0]).includes('SET publish_tx_hash'),
    )
    expect(stampCall).toBeTruthy()
    expect(stampCall?.[1]).toBe(AMOE_ON_CHAIN_RECONCILED_TX)
  })

  it('throws amoe_allowlist_root_mismatch when on-chain root differs', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ')
      if (q.includes('publish_confirmed_at IS NOT NULL')) return { rows: [] }
      if (q.includes('SELECT root_hex, publish_tx_hash')) {
        return { rows: [{ root_hex: ROOT_A, publish_tx_hash: null }] }
      }
      return { rows: [] }
    })
    const broadcast = vi.fn()
    await expect(
      publishAllowlistEpoch({
        db: { sql } as any,
        epoch: 42n,
        lotteryAmoeRouter: ROUTER,
        publisherVersion: 'test',
        broadcast,
        readOnChainRoot: async () => ROOT_B,
      }),
    ).rejects.toThrow(AMOE_ALLOWLIST_ROOT_MISMATCH)
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('broadcasts when on-chain root is zero', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const q = strings.join(' ')
      if (q.includes('publish_confirmed_at IS NOT NULL')) return { rows: [] }
      if (q.includes('SELECT root_hex, publish_tx_hash')) {
        return { rows: [{ root_hex: ROOT_A, publish_tx_hash: null }] }
      }
      return { rows: [] }
    })
    const broadcast = vi.fn(async () => ({ txHash: ('0x' + 'ab'.repeat(32)) as `0x${string}` }))
    const outcome = await publishAllowlistEpoch({
      db: { sql } as any,
      epoch: 42n,
      lotteryAmoeRouter: ROUTER,
      publisherVersion: 'test',
      broadcast,
      readOnChainRoot: async () => AMOE_ZERO_ROOT,
    })
    expect(outcome.kind).toBe('finished')
    expect(broadcast).toHaveBeenCalledTimes(1)
  })

  it('pickNextAllowlistEpochToPublish returns oldest pending epoch', async () => {
    const sql = vi.fn(async () => ({ rows: [{ epoch: 76 }] }))
    const epoch = await pickNextAllowlistEpochToPublish({ sql } as any, {
      latestClosedEpoch: 83n,
    })
    expect(epoch).toBe(76n)
    expect(sql).toHaveBeenCalled()
  })

  it('pickNextAllowlistEpochToPublish returns null when none pending', async () => {
    const sql = vi.fn(async () => ({ rows: [] }))
    const epoch = await pickNextAllowlistEpochToPublish({ sql } as any, {
      latestClosedEpoch: 83n,
    })
    expect(epoch).toBeNull()
  })
})
