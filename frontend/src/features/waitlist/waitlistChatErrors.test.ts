import { describe, expect, it } from 'vitest'

import { formatWaitlistChatError } from './waitlistChatErrors'

describe('formatWaitlistChatError', () => {
  it('maps Privy env errors to user-safe copy', () => {
    expect(formatWaitlistChatError('PRIVY_WALLET_AUTHORIZATION_KEY missing')).toBe(
      'Waitlist chat is still syncing. Try refresh in a moment.',
    )
  })

  it('returns null for empty input', () => {
    expect(formatWaitlistChatError(null)).toBeNull()
    expect(formatWaitlistChatError('   ')).toBeNull()
  })
})
