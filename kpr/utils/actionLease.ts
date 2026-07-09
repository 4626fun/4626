/**
 * M2-09 — file-backed exclusive action lease.
 *
 * Prevents dual trigger planes (Vultr local cron + Vercel→sidecar reconcile)
 * from double-executing the same Solana keeper action within a TTL window.
 */

import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type ActionLeaseAcquireResult =
  | { acquired: true; leasePath: string; token: string }
  | { acquired: false; reason: 'held'; holder?: string; expiresAt?: number }

function defaultLeaseDir(): string {
  return (
    String(process.env.SOLANA_ORCHESTRATOR_LEASE_DIR ?? '').trim() ||
    join(process.cwd(), '.state', 'solana-orchestrator-leases')
  )
}

function readLeaseTtlMs(): number {
  const parsed = Number.parseInt(String(process.env.SOLANA_ORCHESTRATOR_LEASE_TTL_MS ?? '55000'), 10)
  if (!Number.isFinite(parsed) || parsed < 1_000) return 55_000
  return Math.min(parsed, 15 * 60_000)
}

function leaseEnabled(): boolean {
  const raw = String(process.env.SOLANA_ORCHESTRATOR_ACTION_LEASE ?? '1').trim().toLowerCase()
  return !['0', 'false', 'no'].includes(raw)
}

function sanitizeAction(action: string): string {
  return action.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80) || 'action'
}

type LeaseFile = {
  action: string
  token: string
  holder: string
  acquiredAt: number
  expiresAt: number
}

async function readLease(path: string): Promise<LeaseFile | null> {
  try {
    const text = await readFile(path, 'utf8')
    const parsed = JSON.parse(text) as Partial<LeaseFile>
    if (
      typeof parsed.action !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }
    return {
      action: parsed.action,
      token: parsed.token,
      holder: typeof parsed.holder === 'string' ? parsed.holder : 'unknown',
      acquiredAt: typeof parsed.acquiredAt === 'number' ? parsed.acquiredAt : 0,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    return null
  }
}

async function writeExclusiveLease(params: {
  leasePath: string
  action: string
  token: string
  holder: string
  now: number
  ttlMs: number
}): Promise<ActionLeaseAcquireResult> {
  const body: LeaseFile = {
    action: params.action,
    token: params.token,
    holder: params.holder,
    acquiredAt: params.now,
    expiresAt: params.now + params.ttlMs,
  }
  try {
    const handle = await open(params.leasePath, 'wx')
    await handle.writeFile(`${JSON.stringify(body, null, 2)}\n`, 'utf8')
    await handle.close()
    return { acquired: true, leasePath: params.leasePath, token: params.token }
  } catch (err) {
    // Exclusive create only races on EEXIST; surface other filesystem failures.
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
    if (code === 'EEXIST') {
      return { acquired: false, reason: 'held' }
    }
    throw err
  }
}

/**
 * Try to acquire an exclusive lease for `action`.
 * Returns acquired:false when another live lease is held.
 */
export async function tryAcquireActionLease(params: {
  action: string
  holder?: string
  leaseDir?: string
  ttlMs?: number
  nowMs?: number
}): Promise<ActionLeaseAcquireResult> {
  if (!leaseEnabled()) {
    return {
      acquired: true,
      leasePath: '',
      token: 'lease_disabled',
    }
  }

  const action = sanitizeAction(params.action)
  const leaseDir = params.leaseDir ?? defaultLeaseDir()
  const ttlMs = params.ttlMs ?? readLeaseTtlMs()
  const now = params.nowMs ?? Date.now()
  const leasePath = join(leaseDir, `${action}.lease.json`)
  const token = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const holder = params.holder ?? `pid:${process.pid}`

  await mkdir(leaseDir, { recursive: true })

  const existing = await readLease(leasePath)
  if (existing && existing.expiresAt > now) {
    return {
      acquired: false,
      reason: 'held',
      holder: existing.holder,
      expiresAt: existing.expiresAt,
    }
  }

  // Exclusive create when missing.
  const created = await writeExclusiveLease({ leasePath, action, token, holder, now, ttlMs })
  if (created.acquired) return created

  // File exists: re-check liveness.
  const raced = await readLease(leasePath)
  if (raced && raced.expiresAt > now) {
    return {
      acquired: false,
      reason: 'held',
      holder: raced.holder,
      expiresAt: raced.expiresAt,
    }
  }

  // Expired/corrupt: atomically claim the stale file via rename, then exclusive-create.
  // Only one racer wins the rename; losers re-read and see a live lease.
  const stalePath = `${leasePath}.stale.${token}`
  try {
    await rename(leasePath, stalePath)
    try {
      await rm(stalePath, { force: true })
    } catch {
      // best-effort cleanup
    }
  } catch {
    const after = await readLease(leasePath)
    if (after && after.expiresAt > now) {
      return {
        acquired: false,
        reason: 'held',
        holder: after.holder,
        expiresAt: after.expiresAt,
      }
    }
    // Missing or unreadable — fall through to wx create.
  }

  const recreated = await writeExclusiveLease({ leasePath, action, token, holder, now, ttlMs })
  if (recreated.acquired) return recreated

  const final = await readLease(leasePath)
  return {
    acquired: false,
    reason: 'held',
    holder: final?.holder,
    expiresAt: final?.expiresAt,
  }
}

export async function releaseActionLease(params: {
  leasePath: string
  token: string
}): Promise<void> {
  if (!params.leasePath || params.token === 'lease_disabled') return
  const current = await readLease(params.leasePath)
  if (!current || current.token !== params.token) return
  try {
    await rm(params.leasePath, { force: true })
  } catch {
    // best-effort
  }
}

export async function withActionLease<T>(params: {
  action: string
  holder?: string
  leaseDir?: string
  ttlMs?: number
  onSkipped?: (info: { holder?: string; expiresAt?: number }) => void | Promise<void>
  run: () => Promise<T>
}): Promise<{ ran: boolean; result?: T }> {
  const lease = await tryAcquireActionLease({
    action: params.action,
    holder: params.holder,
    leaseDir: params.leaseDir,
    ttlMs: params.ttlMs,
  })
  if (!lease.acquired) {
    await params.onSkipped?.({ holder: lease.holder, expiresAt: lease.expiresAt })
    return { ran: false }
  }
  try {
    const result = await params.run()
    return { ran: true, result }
  } finally {
    await releaseActionLease({ leasePath: lease.leasePath, token: lease.token })
  }
}
