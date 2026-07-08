import { isPrivyEmbeddedSignerAuthError } from '@/lib/auth/privyEmbeddedSignerAuthErrors'
import { isLocalDevPrivySessionMarkerMode } from './loopbackSessionMarkerShim'

/**
 * On localhost, Privy's embedded-wallet iframe session-refresh cookie is
 * blocked as third-party by the browser, so a stale embedded signer cannot
 * be silently repaired there — only a fresh email OTP sign-in (which opens a
 * brand-new iframe session) reliably fixes it. Surface that explicitly on
 * any Privy auth-error surface (chat connect, wallet/X account linking) so
 * time isn't spent debugging what is a localhost-only limitation; verify
 * against a deployed preview URL if this keeps recurring.
 */
export const LOCALHOST_PRIVY_AUTH_NOTE =
  ' This is a known localhost limitation (Privy session refresh is blocked as third-party) — sign in again with email OTP, or verify against a deployed preview URL.'

/**
 * Appends `LOCALHOST_PRIVY_AUTH_NOTE` to `message` when running on a loopback
 * host and `message` looks like a Privy embedded-signer auth failure.
 * Idempotent — safe to call on a message that may already carry the note.
 */
export function appendLocalhostPrivyAuthNoteIfNeeded(message: string): string {
  if (!message) return message
  if (!isLocalDevPrivySessionMarkerMode()) return message
  if (!isPrivyEmbeddedSignerAuthError(message)) return message
  if (message.includes(LOCALHOST_PRIVY_AUTH_NOTE.trim())) return message
  return `${message}${LOCALHOST_PRIVY_AUTH_NOTE}`
}
