import {
  extractPrivyLinkedEmailFromUser,
  extractPrivyVerifiedEmailFromUser,
} from '@/lib/privy/verifiedEmail'

/**
 * Consolidated local storage helpers for waitlist auth coordination.
 *
 * These were previously split across three micro-modules. They exist only to
 * survive certain Privy login races and recovery flows (auth pending flag,
 * recovery gate, email hint for bootstrap when Privy hydration lags).
 *
 * All values are best-effort sessionStorage (non-critical). Callers must
 * handle missing window.
 */

// ----------------------------- Auth pending -----------------------------
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
    if (active) {
      window.sessionStorage.setItem(WAITLIST_AUTH_PENDING_STORAGE_KEY, '1')
    } else {
      window.sessionStorage.removeItem(WAITLIST_AUTH_PENDING_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

export function clearWaitlistAuthPending(): void {
  writeWaitlistAuthPending(false)
}

// ----------------------------- Recovery gate -----------------------------
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
    if (active) {
      window.sessionStorage.setItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY, '1')
    } else {
      window.sessionStorage.removeItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

export function clearWaitlistRecoveryGate(): void {
  writeWaitlistRecoveryGate(false)
}

// ----------------------------- Verified email hint -----------------------------
export const WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY = 'cv:waitlist:verified-email-hint'

export function readStoredWaitlistVerifiedEmailHint(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY)
    if (!raw) return null
    const normalized = raw.trim().toLowerCase()
    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

export function writeStoredWaitlistVerifiedEmailHint(email: string | null | undefined): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalized) {
      window.sessionStorage.removeItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY, normalized)
  } catch {
    // ignore
  }
}

export function clearStoredWaitlistVerifiedEmailHint(): void {
  writeStoredWaitlistVerifiedEmailHint(null)
}

export function captureWaitlistVerifiedEmailHint(user: unknown): void {
  const email = extractPrivyVerifiedEmailFromUser(user) ?? extractPrivyLinkedEmailFromUser(user)
  if (email) writeStoredWaitlistVerifiedEmailHint(email)
}

export function resolveWaitlistVerifiedEmailHint(user: unknown): string | null {
  return (
    extractPrivyVerifiedEmailFromUser(user) ??
    extractPrivyLinkedEmailFromUser(user) ??
    readStoredWaitlistVerifiedEmailHint()
  )
}

/** Display-only: never treat a stored pre-auth hint as a live Privy email session. */
export function resolveWaitlistPrivyDisplayEmail(user: unknown): string | null {
  return extractPrivyVerifiedEmailFromUser(user) ?? extractPrivyLinkedEmailFromUser(user)
}
