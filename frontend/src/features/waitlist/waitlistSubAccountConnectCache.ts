import type { WaitlistSubAccountConnectOverlay } from './waitlistFlowState'

const STORAGE_KEY = 'waitlist:sub-account-connect:v1'

type StoredEntry = WaitlistSubAccountConnectOverlay & { accountKey: string }

function readAll(): StoredEntry[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is StoredEntry =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as StoredEntry).accountKey === 'string' &&
        typeof (entry as StoredEntry).parentAddress === 'string' &&
        typeof (entry as StoredEntry).subAccountAddress === 'string',
    )
  } catch {
    return []
  }
}

function writeAll(entries: StoredEntry[]): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (entries.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readPersistedSubAccountConnectOverlay(
  accountKey: string | null,
): WaitlistSubAccountConnectOverlay | null {
  if (!accountKey) return null
  const match = readAll().find((entry) => entry.accountKey === accountKey)
  if (!match) return null
  return {
    parentAddress: match.parentAddress,
    subAccountAddress: match.subAccountAddress,
  }
}

export function writePersistedSubAccountConnectOverlay(
  accountKey: string,
  overlay: WaitlistSubAccountConnectOverlay,
): void {
  const next = readAll().filter((entry) => entry.accountKey !== accountKey)
  next.push({ accountKey, ...overlay })
  writeAll(next)
}

export function clearPersistedSubAccountConnectOverlay(accountKey: string | null): void {
  if (!accountKey) return
  writeAll(readAll().filter((entry) => entry.accountKey !== accountKey))
}
