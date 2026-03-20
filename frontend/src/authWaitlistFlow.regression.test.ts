import { describe, expect, it } from 'vitest'

import { resolveAccess } from './App'
import { buildAppEntryPath } from './lib/auth/appEntry'
import { shouldNavigateAfterWaitlistHandoff } from './lib/auth/appContinueGate'
import { MARKETING_ORIGIN } from './lib/host'

const SESSION_ADDRESS = '0x1234567890123456789012345678901234567890'

describe('waitlist to gated-app route regression', () => {
  it('allows the canonical waitlist handoff into an accepted app route once the session is established', () => {
    expect(buildAppEntryPath('/swap')).toBe('/continue?from=waitlist&autologin=1&auth=wallet&next=%2Fswap')

    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: null,
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(false)

    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: SESSION_ADDRESS,
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(true)

    expect(
      resolveAccess('accepted', {
        loading: false,
        walletConnected: false,
        sessionValid: true,
        accepted: true,
        creator: true,
        admin: false,
        allowlistEnforced: true,
        effectiveAddress: SESSION_ADDRESS,
        marketingUrl: 'https://4626.fun',
        hostMode: 'app',
      }),
    ).toEqual({ allow: true, reason: 'ok' })
  })

  it('redirects back to the waitlist when the session is established but app acceptance fails', () => {
    expect(
      shouldNavigateAfterWaitlistHandoff({
        autoLogin: true,
        fromWaitlist: true,
        siweAuthAddress: SESSION_ADDRESS,
        privyClientStatus: 'ready',
        privyReady: true,
        privyAuthenticated: false,
      }),
    ).toBe(true)

    expect(
      resolveAccess('accepted', {
        loading: false,
        walletConnected: false,
        sessionValid: true,
        accepted: false,
        creator: false,
        admin: false,
        allowlistEnforced: true,
        effectiveAddress: SESSION_ADDRESS,
        marketingUrl: 'https://4626.fun',
        hostMode: 'app',
      }),
    ).toEqual({
      allow: false,
      reason: 'needs-acceptance',
      redirectTo: `${MARKETING_ORIGIN}/?reason=needs-acceptance#waitlist`,
    })
  })

  it('redirects missing-session app traffic to the marketing waitlist entry', () => {
    expect(
      resolveAccess('accepted', {
        loading: false,
        walletConnected: false,
        sessionValid: false,
        accepted: false,
        creator: false,
        admin: false,
        allowlistEnforced: true,
        effectiveAddress: null,
        marketingUrl: 'https://4626.fun',
        hostMode: 'app',
      }),
    ).toEqual({
      allow: false,
      reason: 'needs-session',
      redirectTo: `${MARKETING_ORIGIN}/?reason=needs-session#waitlist`,
    })
  })
})
