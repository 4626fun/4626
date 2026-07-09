import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  releaseActionLease,
  tryAcquireActionLease,
  withActionLease,
} from '../utils/actionLease.js'

describe('actionLease (M2-09)', () => {
  let dir: string
  const prevLease = process.env.SOLANA_ORCHESTRATOR_ACTION_LEASE
  const prevDir = process.env.SOLANA_ORCHESTRATOR_LEASE_DIR

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), '4626-action-lease-'))
    process.env.SOLANA_ORCHESTRATOR_ACTION_LEASE = '1'
    process.env.SOLANA_ORCHESTRATOR_LEASE_DIR = dir
  })

  afterEach(async () => {
    if (prevLease === undefined) delete process.env.SOLANA_ORCHESTRATOR_ACTION_LEASE
    else process.env.SOLANA_ORCHESTRATOR_ACTION_LEASE = prevLease
    if (prevDir === undefined) delete process.env.SOLANA_ORCHESTRATOR_LEASE_DIR
    else process.env.SOLANA_ORCHESTRATOR_LEASE_DIR = prevDir
    await rm(dir, { recursive: true, force: true })
  })

  it('grants exclusive lease and blocks concurrent acquire', async () => {
    const first = await tryAcquireActionLease({
      action: 'settle_fees',
      holder: 'a',
      leaseDir: dir,
      ttlMs: 60_000,
    })
    expect(first.acquired).toBe(true)

    const second = await tryAcquireActionLease({
      action: 'settle_fees',
      holder: 'b',
      leaseDir: dir,
      ttlMs: 60_000,
    })
    expect(second.acquired).toBe(false)
    if (!second.acquired) {
      expect(second.reason).toBe('held')
      expect(second.holder).toBe('a')
    }

    if (first.acquired) {
      await releaseActionLease({ leasePath: first.leasePath, token: first.token })
    }

    const third = await tryAcquireActionLease({
      action: 'settle_fees',
      holder: 'c',
      leaseDir: dir,
      ttlMs: 60_000,
    })
    expect(third.acquired).toBe(true)
  })

  it('withActionLease skips run when lease held', async () => {
    const held = await tryAcquireActionLease({
      action: 'price_monitor',
      holder: 'holder',
      leaseDir: dir,
      ttlMs: 60_000,
    })
    expect(held.acquired).toBe(true)

    let ran = false
    let skipped = false
    const outcome = await withActionLease({
      action: 'price_monitor',
      leaseDir: dir,
      onSkipped: () => {
        skipped = true
      },
      run: async () => {
        ran = true
        return 1
      },
    })
    expect(outcome.ran).toBe(false)
    expect(ran).toBe(false)
    expect(skipped).toBe(true)
  })

  it('allows reacquire after TTL expiry', async () => {
    const now = Date.now()
    const first = await tryAcquireActionLease({
      action: 'winner_relay',
      holder: 'old',
      leaseDir: dir,
      ttlMs: 1,
      nowMs: now - 10_000,
    })
    expect(first.acquired).toBe(true)

    const second = await tryAcquireActionLease({
      action: 'winner_relay',
      holder: 'new',
      leaseDir: dir,
      ttlMs: 60_000,
      nowMs: now,
    })
    expect(second.acquired).toBe(true)
  })

  it('rethrows non-EEXIST errors from exclusive create', async () => {
    await expect(
      tryAcquireActionLease({
        action: 'settle_fees',
        holder: 'x',
        leaseDir: '/definitely/not/a/writable/path/for-lease-test',
        ttlMs: 60_000,
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/ENOENT|EACCES|EROFS/) })
  })

  it('only one racer wins when both claim an expired lease', async () => {
    const now = Date.now()
    const first = await tryAcquireActionLease({
      action: 'settle_fees',
      holder: 'stale',
      leaseDir: dir,
      ttlMs: 1,
      nowMs: now - 60_000,
    })
    expect(first.acquired).toBe(true)

    // Parallel-style: both see expired; only one rename+wx succeeds.
    const [a, b] = await Promise.all([
      tryAcquireActionLease({
        action: 'settle_fees',
        holder: 'racer-a',
        leaseDir: dir,
        ttlMs: 60_000,
        nowMs: now,
      }),
      tryAcquireActionLease({
        action: 'settle_fees',
        holder: 'racer-b',
        leaseDir: dir,
        ttlMs: 60_000,
        nowMs: now,
      }),
    ])
    const wins = [a, b].filter((r) => r.acquired)
    expect(wins).toHaveLength(1)
  })
})
