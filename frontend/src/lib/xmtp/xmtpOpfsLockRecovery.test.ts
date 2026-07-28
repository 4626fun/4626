import { describe, expect, it } from 'vitest'

import {
  isXmtpLocalDatabaseLockError,
  xmtpOpfsLockRecoveryGuidance,
} from './xmtpOpfsLockRecovery'

describe('isXmtpLocalDatabaseLockError', () => {
  it('matches provider-translated lock messages', () => {
    expect(
      isXmtpLocalDatabaseLockError(
        'XMTP local database is currently locked by another active tab/window or connect attempt. ' +
          'Close other 4626 chat tabs in Base App or your browser, then retry. ' +
          'If only one tab is open, use Reload to release lock.',
      ),
    ).toBe(true)
    expect(
      isXmtpLocalDatabaseLockError(
        'XMTP local database is currently locked by another tab/window. ' +
          'Close other 4626 chat tabs in Base App or your browser, then retry. ' +
          'If only one tab is open, use Reload to release lock.',
      ),
    ).toBe(true)
    expect(
      isXmtpLocalDatabaseLockError(
        'XMTP local storage is locked by another active tab/window. ' +
          'Close other 4626 chat tabs in Base App or your browser, then retry. ' +
          'If only one tab is open, use Reload to release lock.',
      ),
    ).toBe(true)
  })

  it('matches raw OPFS access-handle failures', () => {
    expect(
      isXmtpLocalDatabaseLockError(
        'Failed to initialize OPFS, ensure that there are no other active XMTP clients or Opfs instances',
      ),
    ).toBe(true)
  })

  it('does not match unrelated messaging errors', () => {
    expect(isXmtpLocalDatabaseLockError(null)).toBe(false)
    expect(isXmtpLocalDatabaseLockError('')).toBe(false)
    expect(isXmtpLocalDatabaseLockError('Embedded signer session expired.')).toBe(false)
    expect(isXmtpLocalDatabaseLockError('Network error')).toBe(false)
  })
})

describe('xmtpOpfsLockRecoveryGuidance', () => {
  it('returns Base App recovery steps for lock errors', () => {
    const guidance = xmtpOpfsLockRecoveryGuidance(
      'XMTP local database is currently locked by another active tab/window or connect attempt.',
    )
    expect(guidance).toContain('Base App')
    expect(guidance).toContain('reload once')
    expect(guidance).toContain('Reset local XMTP state')
  })

  it('returns null for non-lock errors', () => {
    expect(xmtpOpfsLockRecoveryGuidance('Network error')).toBeNull()
  })
})
