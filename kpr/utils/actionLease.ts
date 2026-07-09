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

  // Exclusive create when missing; overwrite only when expired/missing.
  try {
    const handle = await open(leasePath, 'wx')
    const body: LeaseFile = {
      action,
      token,
      holder,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    }
    await handle.writeFile(`${JSON.stringify(body, null, 2)}\n`, 'utf8')
    await handle.close()
    return { acquired: true, leasePath, token }
  } catch {
    // Race: re-read; if still held, fail; if expired, replace via temp+rename.
    const raced = await readLease(leasePath)
    if (raced && raced.expiresAt > now) {
      return {
        acquired: false,
        reason: 'held',
        holder: raced.holder,
        expiresAt: raced.expiresAt,
      }
    }
    const body: LeaseFile = {
      action,
      token,
      holder,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    }
    const tempPath = `${leasePath}.${token}.tmp`
    await writeFile(tempPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
    await rename(tempPath, leasePath)
    return { acquired: true, leasePath, token }
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
