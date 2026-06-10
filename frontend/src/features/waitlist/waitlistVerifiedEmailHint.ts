import {
  extractPrivyLinkedEmailFromUser,
  extractPrivyVerifiedEmailFromUser,
} from '@/lib/privy/verifiedEmail'

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
