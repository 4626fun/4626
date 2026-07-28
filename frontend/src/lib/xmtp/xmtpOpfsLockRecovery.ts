/**
 * User-facing recovery helpers for XMTP local OPFS database lock errors.
 *
 * These messages are set by `provider.tsx` after a raw OPFS access-handle
 * failure is translated. Keep detection in sync with those strings.
 */

import { isOpfsAccessHandleError } from './xmtpHelpers'

/** True for raw OPFS lock failures and the provider's translated lock copy. */
export function isXmtpLocalDatabaseLockError(message: string | null | undefined): boolean {
  if (!message) return false
  if (isOpfsAccessHandleError(message)) return true
  const m = message.toLowerCase()
  return (
    m.includes('local database is currently locked') ||
    m.includes('local storage is locked') ||
    (m.includes('xmtp') && m.includes('locked') && m.includes('tab'))
  )
}

export const XMTP_OPFS_LOCK_RECOVERY_TITLE =
  'Messaging storage is locked in this browser'

export const XMTP_OPFS_LOCK_RECOVERY_STEPS =
  'Close other 4626 chat tabs in Base App (or any other browser window), wait a moment, then retry. ' +
  'If only one tab is open, reload once to release a stuck lock. ' +
  'Reset local XMTP state only if reload still fails.'

export function xmtpOpfsLockRecoveryGuidance(error: string | null | undefined): string | null {
  if (!isXmtpLocalDatabaseLockError(error)) return null
  return XMTP_OPFS_LOCK_RECOVERY_STEPS
}
