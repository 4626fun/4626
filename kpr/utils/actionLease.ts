/**
 * M2-09 — file-backed exclusive action lease.
 *
 * Prevents dual trigger planes (Vultr local cron + Vercel→sidecar reconcile)
 * from double-executing the same Solana keeper action within a TTL window.
 */

import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export type ActionLeaseAcquireResult =
  | { acquired: true; leasePath: string; token: string }
  | { acquired: false; reason: 'held'; holder?: string; expiresAt?: number }

export class ActionLeaseError extends Error {
  readonly code:
    | 'action_lease_storage_unavailable'
    | 'action_lease_aborted_before_effects'
    | 'action_lease_outcome_indeterminate'

  constructor(code: ActionLeaseError['code']) {
    super(code)
    this.name = 'ActionLeaseError'
    this.code = code
  }
}

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

type MutexFile = {
  token: string
  createdAt: number
}

type MutexOwnership = MutexFile & {
  dev: bigint
  ino: bigint
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

function fsCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err
    ? String((err as { code?: unknown }).code)
    : ''
}

async function writeCompleteJson(path: string, body: unknown): Promise<void> {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(body)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * Publish a complete lease inode without ever exposing a partially-written
 * JSON file. `link` is the exclusive compare-and-publish operation.
 */
async function publishExclusiveLease(path: string, body: LeaseFile): Promise<boolean> {
  const tempPath = `${path}.publish.${body.token}.${randomUUID()}`
  try {
    await writeCompleteJson(tempPath, body)
    try {
      await link(tempPath, path)
      return true
    } catch (err) {
      if (fsCode(err) === 'EEXIST') return false
      throw err
    }
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
}

function sameInode(
  left: { dev: bigint; ino: bigint },
  right: { dev: bigint; ino: bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

async function readMutex(path: string): Promise<MutexFile | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<MutexFile>
    if (typeof parsed.token !== 'string' || typeof parsed.createdAt !== 'number') return null
    return { token: parsed.token, createdAt: parsed.createdAt }
  } catch {
    return null
  }
}

async function restoreClaimedMutex(claimPath: string, mutexPath: string): Promise<void> {
  try {
    await link(claimPath, mutexPath)
    await rm(claimPath, { force: true })
  } catch {
    // Never delete a claimed inode that was not ours. If another mutex already
    // occupies the canonical path, preserve this inode at the claim path.
  }
}

async function removeOwnedMutex(mutexPath: string, owner: MutexOwnership): Promise<void> {
  const claimPath = `${mutexPath}.release.${owner.token}.${randomUUID()}`
  try {
    await rename(mutexPath, claimPath)
  } catch {
    return
  }

  const [claimedStat, claimed] = await Promise.all([
    stat(claimPath, { bigint: true }).catch(() => null),
    readMutex(claimPath),
  ])
  if (
    !claimedStat
    || !claimed
    || claimed.token !== owner.token
    || !sameInode(claimedStat, owner)
  ) {
    await restoreClaimedMutex(claimPath, mutexPath)
    return
  }
  await rm(claimPath, { force: true }).catch(() => undefined)
}

async function removeObservedStaleMutex(
  mutexPath: string,
  observed: { dev: bigint; ino: bigint; mtimeMs: bigint },
): Promise<void> {
  const claimPath = `${mutexPath}.stale.${randomUUID()}`
  try {
    await rename(mutexPath, claimPath)
  } catch {
    return
  }

  const claimedStat = await stat(claimPath, { bigint: true }).catch(() => null)
  if (!claimedStat || !sameInode(claimedStat, observed)) {
    await restoreClaimedMutex(claimPath, mutexPath)
    return
  }
  if (Date.now() - Number(claimedStat.mtimeMs) <= 30_000) {
    await restoreClaimedMutex(claimPath, mutexPath)
    return
  }
  await rm(claimPath, { force: true }).catch(() => undefined)
}

export async function withLeaseMutationLock<T>(leasePath: string, mutate: () => Promise<T>): Promise<T> {
  const mutexPath = `${leasePath}.mutex`
  const deadline = Date.now() + 2_000
  let owner: MutexOwnership | null = null
  while (true) {
    try {
      const mutex: MutexFile = { token: randomUUID(), createdAt: Date.now() }
      const tempPath = `${mutexPath}.publish.${mutex.token}.${randomUUID()}`
      try {
        await writeCompleteJson(tempPath, mutex)
        await link(tempPath, mutexPath)
      } finally {
        await rm(tempPath, { force: true }).catch(() => undefined)
      }
      const mutexStat = await stat(mutexPath, { bigint: true })
      const current = await readMutex(mutexPath)
      if (current?.token === mutex.token) {
        owner = {
          ...mutex,
          dev: mutexStat.dev,
          ino: mutexStat.ino,
        }
        break
      }
    } catch (error) {
      if (fsCode(error) !== 'EEXIST') {
        throw new ActionLeaseError('action_lease_storage_unavailable')
      }
      const mutexStat = await stat(mutexPath, { bigint: true }).catch(() => null)
      if (mutexStat && Date.now() - Number(mutexStat.mtimeMs) > 30_000) {
        await removeObservedStaleMutex(mutexPath, mutexStat)
        continue
      }
      if (Date.now() >= deadline) {
        throw new ActionLeaseError('action_lease_storage_unavailable')
      }
      await delay(10)
    }
  }
  try {
    return await mutate()
  } finally {
    if (owner) await removeOwnedMutex(mutexPath, owner)
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
    const published = await publishExclusiveLease(params.leasePath, body)
    if (!published) return { acquired: false, reason: 'held' }
    return { acquired: true, leasePath: params.leasePath, token: params.token }
  } catch (err) {
    throw new ActionLeaseError('action_lease_storage_unavailable')
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

  try {
    await mkdir(leaseDir, { recursive: true })
  } catch {
    throw new ActionLeaseError('action_lease_storage_unavailable')
  }

  return withLeaseMutationLock<ActionLeaseAcquireResult>(leasePath, async () => {
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
    const stalePath = `${leasePath}.stale.${token}`
    try {
      await rename(leasePath, stalePath)
      const claimed = await readLease(stalePath)
      if (claimed && claimed.expiresAt > now) {
        await link(stalePath, leasePath).catch(() => undefined)
        await rm(stalePath, { force: true }).catch(() => undefined)
        return {
          acquired: false,
          reason: 'held',
          holder: claimed.holder,
          expiresAt: claimed.expiresAt,
        }
      }
      await rm(stalePath, { force: true })
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
  })
}

export async function releaseActionLease(params: {
  leasePath: string
  token: string
}): Promise<void> {
  if (!params.leasePath || params.token === 'lease_disabled') return
  try {
    await withLeaseMutationLock(params.leasePath, async () => {
      const current = await readLease(params.leasePath)
      if (!current || current.token !== params.token) return
      await rm(params.leasePath, { force: true })
    })
  } catch {
    // best-effort
  }
}

export async function renewActionLease(params: {
  leasePath: string
  token: string
  ttlMs: number
  nowMs?: number
}): Promise<boolean> {
  if (!params.leasePath || params.token === 'lease_disabled') return true
  return withLeaseMutationLock(params.leasePath, async () => {
    const current = await readLease(params.leasePath)
    if (!current || current.token !== params.token) return false

    const renewed: LeaseFile = {
      ...current,
      expiresAt: (params.nowMs ?? Date.now()) + params.ttlMs,
    }
    const tempPath = `${params.leasePath}.renew.${params.token}.${randomUUID()}`
    try {
      await writeCompleteJson(tempPath, renewed)
      // The mutation lock makes this token check + replace a fenced update.
      const latest = await readLease(params.leasePath)
      if (!latest || latest.token !== params.token) return false
      await rename(tempPath, params.leasePath)
      return true
    } catch {
      throw new ActionLeaseError('action_lease_storage_unavailable')
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined)
    }
  })
}

export type ActionLeaseRunContext = {
  signal: AbortSignal
  markEffectsStarted: () => void
  confirmAbortedBeforeEffects: () => void
}

export type ActionLeaseRunResult<T> =
  | { ran: false; outcome: 'held' }
  | { ran: true; outcome: 'completed'; result: T }
  | { ran: true; outcome: 'aborted_before_effects' }
  | { ran: true; outcome: 'indeterminate' }

export async function withActionLease<T>(params: {
  action: string
  holder?: string
  leaseDir?: string
  ttlMs?: number
  onSkipped?: (info: { holder?: string; expiresAt?: number }) => void | Promise<void>
  run: (context: ActionLeaseRunContext) => Promise<T>
}): Promise<ActionLeaseRunResult<T>> {
  const lease = await tryAcquireActionLease({
    action: params.action,
    holder: params.holder,
    leaseDir: params.leaseDir,
    ttlMs: params.ttlMs,
  })
  if (!lease.acquired) {
    await params.onSkipped?.({ holder: lease.holder, expiresAt: lease.expiresAt })
    return { ran: false, outcome: 'held' }
  }
  const ttlMs = params.ttlMs ?? readLeaseTtlMs()
  const renewalIntervalMs = Math.max(10, Math.floor(ttlMs / 3))
  let renewalLost = false
  let renewalError: unknown = null
  let renewalInFlight: Promise<void> | null = null
  let effectsStarted = false
  let cooperativelyAbortedBeforeEffects = false
  const abortController = new AbortController()
  const noteRenewalLoss = () => {
    renewalLost = true
    abortController.abort()
  }
  const renewalTimer = setInterval(() => {
    if (renewalInFlight) return
    renewalInFlight = renewActionLease({
      leasePath: lease.leasePath,
      token: lease.token,
      ttlMs,
    })
      .then((renewed) => {
        if (!renewed) noteRenewalLoss()
      })
      .catch((error) => {
        renewalError = error
        noteRenewalLoss()
      })
      .finally(() => {
        renewalInFlight = null
      })
  }, renewalIntervalMs)
  renewalTimer.unref()
  let result: T | undefined
  let runError: unknown = null
  try {
    result = await params.run({
      signal: abortController.signal,
      markEffectsStarted: () => {
        effectsStarted = true
      },
      confirmAbortedBeforeEffects: () => {
        if (!effectsStarted && abortController.signal.aborted) {
          cooperativelyAbortedBeforeEffects = true
        }
      },
    })
  } catch (error) {
    runError = error
  } finally {
    clearInterval(renewalTimer)
    if (renewalInFlight) await renewalInFlight.catch(() => undefined)
    await releaseActionLease({ leasePath: lease.leasePath, token: lease.token })
  }

  if (renewalLost || renewalError) {
    if (cooperativelyAbortedBeforeEffects && !effectsStarted) {
      return { ran: true, outcome: 'aborted_before_effects' }
    }
    return { ran: true, outcome: 'indeterminate' }
  }
  if (runError) throw runError
  return { ran: true, outcome: 'completed', result: result as T }
}
