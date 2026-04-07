import { describe, expect, it } from 'vitest'

import { getGenericNotFoundCta, resolveAccess } from './App'
import { buildAppEntryPath } from './lib/auth/appEntry'
import { MARKETING_ORIGIN } from './lib/host'
import { buildWaitlistEntryUrl } from './lib/auth/waitlistEntry'

const SESSION_ADDRESS = '0x1234567890123456789012345678901234567890'

describe('waitlist to gated-app route regression', () => {
  it('allows the canonical waitlist handoff into an accepted app route once the session is established', () => {
    expect(buildAppEntryPath('/swap')).toBe('/swap')

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
      redirectTo: buildWaitlistEntryUrl('https://4626.fun'),
    })
  })

  it('allows telegram link entry with a valid session even when acceptance fails', () => {
    expect(
      resolveAccess('session', {
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
    ).toEqual({ allow: true, reason: 'ok' })
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
      redirectTo: buildWaitlistEntryUrl('https://4626.fun'),
    })
  })

  it('uses the canonical public waitlist path for marketing-only recovery CTAs', () => {
    expect(getGenericNotFoundCta('marketing')).toEqual({
      href: '/waitlist',
      label: 'Join Waitlist',
      hint: 'Start from the canonical waitlist entry.',
    })

    expect(getGenericNotFoundCta('app')).toEqual({
      href: '/swap',
      label: 'Go To Trade',
      hint: 'Continue to the canonical app landing route.',
    })

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
        marketingUrl: MARKETING_ORIGIN,
        hostMode: 'app',
      }),
    ).toEqual({
      allow: false,
      reason: 'needs-session',
      redirectTo: buildWaitlistEntryUrl(MARKETING_ORIGIN),
    })
  })
})
