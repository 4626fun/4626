export const WAITLIST_AUTH_PENDING_STORAGE_KEY = 'cv:waitlist:auth-pending'

export function readWaitlistAuthPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(WAITLIST_AUTH_PENDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWaitlistAuthPending(active: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (active) window.sessionStorage.setItem(WAITLIST_AUTH_PENDING_STORAGE_KEY, '1')
    else window.sessionStorage.removeItem(WAITLIST_AUTH_PENDING_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clearWaitlistAuthPending(): void {
  writeWaitlistAuthPending(false)
}
