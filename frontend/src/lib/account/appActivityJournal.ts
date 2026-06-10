import { getAddress, isAddress } from 'viem'

const STORAGE_PREFIX = 'cv:app-activity:v1'
const MAX_ENTRIES = 40

export const APP_ACTIVITY_UPDATED_EVENT = 'cv:app-activity-updated'

export type AppActivityEntry = {
  id: string
  kind: 'swap'
  walletAddress: string
  txHash: string | null
  userOpHash: string | null
  amountInUnits: string
  estimatedOut: string
  tokenIn: string
  tokenOut: string
  completedAtMs: number
}

function getStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null
  return globalThis.localStorage ?? null
}

function storageKey(walletAddress: string): string {
  return `${STORAGE_PREFIX}:${getAddress(walletAddress).toLowerCase()}`
}

function readRaw(walletAddress: string): AppActivityEntry[] {
  const storage = getStorage()
  if (!storage || !isAddress(walletAddress)) return []
  try {
    const raw = storage.getItem(storageKey(walletAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw) as AppActivityEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => entry && typeof entry === 'object' && entry.kind === 'swap')
  } catch {
    return []
  }
}

function writeRaw(walletAddress: string, entries: AppActivityEntry[]): void {
  const storage = getStorage()
  if (!storage || !isAddress(walletAddress)) return
  try {
    storage.setItem(storageKey(walletAddress), JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // ignore quota / private mode
  }
}

export function readAppActivityJournal(walletAddress: string | null | undefined): AppActivityEntry[] {
  if (!walletAddress || !isAddress(walletAddress)) return []
  return readRaw(walletAddress).sort((a, b) => b.completedAtMs - a.completedAtMs)
}

export function appendAppSwapActivity(entry: {
  walletAddress: string
  txHash?: string | null
  userOpHash?: string | null
  amountInUnits: string
  estimatedOut: string
  tokenIn: string
  tokenOut: string
  completedAtMs?: number
}): AppActivityEntry | null {
  if (!isAddress(entry.walletAddress)) return null
  const walletAddress = getAddress(entry.walletAddress)
  const txHash = entry.txHash?.trim() || null
  const userOpHash = entry.userOpHash?.trim() || null
  const completedAtMs = entry.completedAtMs ?? Date.now()
  const id = txHash ? `swap:${txHash}` : userOpHash ? `swap:${userOpHash}` : `swap:${completedAtMs}`

  const next: AppActivityEntry = {
    id,
    kind: 'swap',
    walletAddress,
    txHash,
    userOpHash,
    amountInUnits: entry.amountInUnits,
    estimatedOut: entry.estimatedOut,
    tokenIn: entry.tokenIn,
    tokenOut: entry.tokenOut,
    completedAtMs,
  }

  const existing = readRaw(walletAddress)
  const withoutDup = existing.filter((row) => row.id !== id && row.txHash !== txHash)
  writeRaw(walletAddress, [next, ...withoutDup])
  if (typeof globalThis.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent(APP_ACTIVITY_UPDATED_EVENT))
  }
  return next
}

export function clearAppActivityJournalForTests(): void {
  const storage = getStorage()
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key?.startsWith(`${STORAGE_PREFIX}:`)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}
