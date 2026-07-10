import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  releaseActionLease,
  renewActionLease,
  tryAcquireActionLease,
  withLeaseMutationLock,
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

  it('maps raw filesystem errors to a stable lease code', async () => {
    await expect(
      tryAcquireActionLease({
        action: 'settle_fees',
        holder: 'x',
        leaseDir: '/definitely/not/a/writable/path/for-lease-test',
        ttlMs: 60_000,
      }),
    ).rejects.toMatchObject({ code: 'action_lease_storage_unavailable' })
  })

  it('publishes a complete JSON lease and renews only with the owning token', async () => {
    const acquired = await tryAcquireActionLease({
      action: 'settle_fees',
      holder: 'owner',
      leaseDir: dir,
      ttlMs: 1_000,
    })
    expect(acquired.acquired).toBe(true)
    if (!acquired.acquired) return

    const before = JSON.parse(await readFile(acquired.leasePath, 'utf8')) as {
      token: string
      expiresAt: number
    }
    expect(before.token).toBe(acquired.token)

    expect(
      await renewActionLease({
        leasePath: acquired.leasePath,
        token: 'not-the-owner',
        ttlMs: 60_000,
        nowMs: before.expiresAt,
      }),
    ).toBe(false)
    expect(
      await renewActionLease({
        leasePath: acquired.leasePath,
        token: acquired.token,
        ttlMs: 60_000,
        nowMs: before.expiresAt,
      }),
    ).toBe(true)

    const after = JSON.parse(await readFile(acquired.leasePath, 'utf8')) as {
      token: string
      expiresAt: number
    }
    expect(after.token).toBe(acquired.token)
    expect(after.expiresAt).toBe(before.expiresAt + 60_000)
  })

  it('does not renew after a newer token fences the old holder', async () => {
    const acquired = await tryAcquireActionLease({
      action: 'winner_relay',
      holder: 'old-owner',
      leaseDir: dir,
      ttlMs: 60_000,
    })
    expect(acquired.acquired).toBe(true)
    if (!acquired.acquired) return

    const replacement = {
      action: 'winner_relay',
      token: 'new-owner-token',
      holder: 'new-owner',
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }
    await writeFile(acquired.leasePath, `${JSON.stringify(replacement)}\n`, 'utf8')

    expect(
      await renewActionLease({
        leasePath: acquired.leasePath,
        token: acquired.token,
        ttlMs: 60_000,
      }),
    ).toBe(false)
    expect(JSON.parse(await readFile(acquired.leasePath, 'utf8')).token).toBe('new-owner-token')
    await releaseActionLease({ leasePath: acquired.leasePath, token: acquired.token })
    expect(JSON.parse(await readFile(acquired.leasePath, 'utf8')).token).toBe('new-owner-token')
  })

  it('renews the lease while a long-running action is still active', async () => {
    let finishRun!: () => void
    const runFinished = new Promise<void>((resolve) => {
      finishRun = resolve
    })
    const running = withActionLease({
      action: 'long_running',
      holder: 'runner',
      leaseDir: dir,
      ttlMs: 120,
      run: async () => runFinished,
    })

    await new Promise((resolve) => setTimeout(resolve, 180))
    const competing = await tryAcquireActionLease({
      action: 'long_running',
      holder: 'competitor',
      leaseDir: dir,
      ttlMs: 120,
    })
    expect(competing.acquired).toBe(false)

    finishRun()
    await expect(running).resolves.toMatchObject({ ran: true, outcome: 'completed' })
  })

  it('does not let a stale mutex owner delete a replacement inode', async () => {
    const leasePath = join(dir, 'mutex-fence.lease.json')
    let releaseMutation!: () => void
    const mutationBlocked = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const running = withLeaseMutationLock(leasePath, async () => mutationBlocked)
    const mutexPath = `${leasePath}.mutex`

    let currentToken = ''
    for (let attempt = 0; attempt < 100 && !currentToken; attempt++) {
      currentToken = String(
        (JSON.parse(await readFile(mutexPath, 'utf8').catch(() => '{}')) as { token?: string }).token ?? '',
      )
      if (!currentToken) await new Promise((resolve) => setTimeout(resolve, 5))
    }
    expect(currentToken).not.toBe('')

    const replacementPath = `${mutexPath}.replacement`
    await writeFile(
      replacementPath,
      `${JSON.stringify({ token: 'replacement-owner', createdAt: Date.now() })}\n`,
      'utf8',
    )
    await rename(replacementPath, mutexPath)
    releaseMutation()
    await running

    expect(JSON.parse(await readFile(mutexPath, 'utf8')).token).toBe('replacement-owner')
  })

  it('returns indeterminate instead of inviting replay after renewal ownership is lost', async () => {
    let finishRun!: () => void
    const runFinished = new Promise<void>((resolve) => {
      finishRun = resolve
    })
    const running = withActionLease({
      action: 'renewal_lost_after_effects',
      holder: 'old-owner',
      leaseDir: dir,
      ttlMs: 90,
      run: async ({ markEffectsStarted }) => {
        markEffectsStarted()
        await runFinished
        return 'possibly-applied'
      },
    })
    const leasePath = join(dir, 'renewal_lost_after_effects.lease.json')

    await new Promise((resolve) => setTimeout(resolve, 10))
    await writeFile(
      leasePath,
      `${JSON.stringify({
        action: 'renewal_lost_after_effects',
        token: 'replacement-owner',
        holder: 'new-owner',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })}\n`,
      'utf8',
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    finishRun()

    await expect(running).resolves.toEqual({ ran: true, outcome: 'indeterminate' })
    expect(JSON.parse(await readFile(leasePath, 'utf8')).token).toBe('replacement-owner')
  })

  it('allows retry only after cooperative abort before effects', async () => {
    const running = withActionLease({
      action: 'cooperative_abort',
      holder: 'old-owner',
      leaseDir: dir,
      ttlMs: 90,
      run: async ({ signal, confirmAbortedBeforeEffects }) => {
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
        confirmAbortedBeforeEffects()
      },
    })
    const leasePath = join(dir, 'cooperative_abort.lease.json')

    await new Promise((resolve) => setTimeout(resolve, 10))
    await writeFile(
      leasePath,
      `${JSON.stringify({
        action: 'cooperative_abort',
        token: 'replacement-owner',
        holder: 'new-owner',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })}\n`,
      'utf8',
    )

    await expect(running).resolves.toEqual({ ran: true, outcome: 'aborted_before_effects' })
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
