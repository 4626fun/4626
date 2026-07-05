import { describe, expect, it } from 'vitest'

import { resolveWaitlistPrivyOAuthRedirectUrl } from './waitlistOAuthRedirect'

describe('resolveWaitlistPrivyOAuthRedirectUrl', () => {
  it('pins waitlist OAuth redirect to the active loopback origin and /waitlist path', () => {
    expect(resolveWaitlistPrivyOAuthRedirectUrl('http://localhost:5174')).toBe(
      'http://localhost:5174/waitlist',
    )
    expect(resolveWaitlistPrivyOAuthRedirectUrl('http://127.0.0.1:5173')).toBe(
      'http://127.0.0.1:5173/waitlist',
    )
  })
})
