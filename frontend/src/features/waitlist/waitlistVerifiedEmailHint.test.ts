// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY,
  captureWaitlistVerifiedEmailHint,
  clearStoredWaitlistVerifiedEmailHint,
  readStoredWaitlistVerifiedEmailHint,
  resolveWaitlistVerifiedEmailHint,
} from './waitlistVerifiedEmailHint'

describe('waitlistVerifiedEmailHint', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('persists linked email hints from Privy user objects', () => {
    captureWaitlistVerifiedEmailHint({
      id: 'did:privy:test',
      email: { address: 'User@Example.com', verified: false },
    })
    expect(sessionStorage.getItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY)).toBe('user@example.com')
    expect(readStoredWaitlistVerifiedEmailHint()).toBe('user@example.com')
  })

  it('prefers verified email over stored hint', () => {
    sessionStorage.setItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY, 'stale@example.com')
    expect(
      resolveWaitlistVerifiedEmailHint({
        id: 'did:privy:test',
        linkedAccounts: [{ type: 'email', address: 'fresh@example.com', verified: true }],
      }),
    ).toBe('fresh@example.com')
  })

  it('falls back to stored hint when Privy hydration lags', () => {
    sessionStorage.setItem(WAITLIST_VERIFIED_EMAIL_HINT_STORAGE_KEY, 'stored@example.com')
    expect(resolveWaitlistVerifiedEmailHint({ id: 'did:privy:test' })).toBe('stored@example.com')
  })

  it('clears stored hints', () => {
    captureWaitlistVerifiedEmailHint({
      email: { address: 'user@example.com', verified: true },
    })
    clearStoredWaitlistVerifiedEmailHint()
    expect(readStoredWaitlistVerifiedEmailHint()).toBeNull()
  })
})
