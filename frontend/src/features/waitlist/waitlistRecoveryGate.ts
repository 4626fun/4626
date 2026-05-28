export const WAITLIST_RECOVERY_GATE_STORAGE_KEY = 'cv:waitlist:recovery-gate'

export function readWaitlistRecoveryGate(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWaitlistRecoveryGate(active: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (active) window.sessionStorage.setItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY, '1')
    else window.sessionStorage.removeItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clearWaitlistRecoveryGate(): void {
  writeWaitlistRecoveryGate(false)
}
