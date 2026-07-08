// @vitest-environment happy-dom
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

  it('maps XMTP rate-limit errors to user-safe copy', () => {
    expect(formatWaitlistChatError('1 exceeds rate limit R23.240.54.118DEF')).toBe(
      'XMTP is rate limiting welcome sync for this network. Wait about a minute, then tap Refresh.',
    )
  })

  it('maps missing auth token (embedded signer session) to re-login guidance', () => {
    // jsdom's default test origin is http://localhost/, so this also covers
    // the localhost-specific suffix (see the dedicated suffix test below).
    expect(
      formatWaitlistChatError('UnknownRpcError: An unknown RPC error occurred. Details: Missing auth token.'),
    ).toContain('Sign-in for chat expired.')
    expect(formatWaitlistChatError('ei3: Missing auth token.')).toContain(
      'Sign-in for chat expired.',
    )
  })

  it('appends localhost-specific guidance for the expired-session message on a loopback host', () => {
    // jsdom test origin defaults to http://localhost/.
    const message = formatWaitlistChatError('Missing auth token.')
    expect(message).toContain('Sign-in for chat expired.')
    expect(message).toContain('known localhost limitation')
    expect(message).toContain('deployed preview URL')
  })
})
