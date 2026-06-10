import { getAddress, isAddress } from 'viem'

const STORAGE_PREFIX = 'cv:csw-owner-index:v1'

export type PersistedCswOwnerIndex = {
  ownerIndex: number
  ownerCountSnapshot: number
  savedAt: number
}

function storageKey(params: { chainId: number; smartWallet: string; ownerAddress: string }): string {
  const csw = getAddress(params.smartWallet).toLowerCase()
  const owner = getAddress(params.ownerAddress).toLowerCase()
  return `${STORAGE_PREFIX}:${params.chainId}:${csw}:${owner}`
}

function getStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null
  const storage = globalThis.localStorage
  return storage ? storage : null
}

function canUseStorage(): boolean {
  return getStorage() !== null
}

export function readPersistedCswOwnerIndex(params: {
  chainId: number
  smartWallet: string
  ownerAddress: string
}): PersistedCswOwnerIndex | null {
  if (!canUseStorage()) return null
  if (!Number.isFinite(params.chainId) || params.chainId <= 0) return null
  if (!isAddress(params.smartWallet) || !isAddress(params.ownerAddress)) return null

  try {
    const raw = getStorage()?.getItem(storageKey(params))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedCswOwnerIndex>
    const ownerIndex = Number(parsed.ownerIndex)
    const ownerCountSnapshot = Number(parsed.ownerCountSnapshot)
    const savedAt = Number(parsed.savedAt)
    if (!Number.isInteger(ownerIndex) || ownerIndex < 0) return null
    if (!Number.isInteger(ownerCountSnapshot) || ownerCountSnapshot <= 0) return null
    if (!Number.isFinite(savedAt) || savedAt <= 0) return null
    return { ownerIndex, ownerCountSnapshot, savedAt }
  } catch {
    return null
  }
}

export function writePersistedCswOwnerIndex(params: {
  chainId: number
  smartWallet: string
  ownerAddress: string
  ownerIndex: number
  ownerCountSnapshot: number
}): void {
  if (!canUseStorage()) return
  if (!Number.isFinite(params.chainId) || params.chainId <= 0) return
  if (!isAddress(params.smartWallet) || !isAddress(params.ownerAddress)) return
  if (!Number.isInteger(params.ownerIndex) || params.ownerIndex < 0) return
  if (!Number.isInteger(params.ownerCountSnapshot) || params.ownerCountSnapshot <= 0) return

  const payload: PersistedCswOwnerIndex = {
    ownerIndex: params.ownerIndex,
    ownerCountSnapshot: params.ownerCountSnapshot,
    savedAt: Date.now(),
  }
  try {
    getStorage()?.setItem(storageKey(params), JSON.stringify(payload))
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearPersistedCswOwnerIndex(params: {
  chainId: number
  smartWallet: string
  ownerAddress: string
}): void {
  if (!canUseStorage()) return
  try {
    getStorage()?.removeItem(storageKey(params))
  } catch {
    // ignore
  }
}

export function clearCswOwnerIndexPersistenceForTests(): void {
  const storage = getStorage()
  if (!storage) return
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key?.startsWith(`${STORAGE_PREFIX}:`)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}
