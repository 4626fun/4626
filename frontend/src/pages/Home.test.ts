import { describe, expect, it } from 'vitest'

import { buildWaitlistCloseTarget, getHomeWaitlistRedirectTarget, shouldRedirectHomeToSwap, shouldShowWaitlistEntry } from './Home'

describe('shouldRedirectHomeToSwap', () => {
  it('redirects app home traffic to /swap by default', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        pathname: '/',
        search: '',
        hash: '',
      }),
    ).toBe(true)
  })

  it('keeps marketing mode on home', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'marketing',
        pathname: '/',
        search: '',
        hash: '',
      }),
    ).toBe(false)
  })

  it('does not redirect the clean waitlist route on app host', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        pathname: '/waitlist',
        search: '',
        hash: '',
      }),
    ).toBe(false)
  })

  it('does not redirect legacy waitlist-tagged app links before they are normalized', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        pathname: '/',
        search: '?reason=needs-acceptance&wl=1',
        hash: '#waitlist',
      }),
    ).toBe(false)
  })
})

describe('waitlist entry URL helpers', () => {
  it('redirects app-host waitlist URLs back to the marketing waitlist entry', () => {
    expect(
      getHomeWaitlistRedirectTarget({
        hostMode: 'app',
        marketingOrigin: 'https://4626.fun',
        pathname: '/',
        search: '?reason=needs-session',
        hash: '#waitlist',
      }),
    ).toBe('https://4626.fun/waitlist')
  })

  it('redirects the clean app-host waitlist route back to the marketing waitlist entry', () => {
    expect(
      getHomeWaitlistRedirectTarget({
        hostMode: 'app',
        marketingOrigin: 'https://4626.fun',
        pathname: '/waitlist',
        search: '',
        hash: '',
      }),
    ).toBe('https://4626.fun/waitlist')
  })

  it('keeps marketing-host waitlist URLs local', () => {
    expect(
      getHomeWaitlistRedirectTarget({
        hostMode: 'marketing',
        marketingOrigin: 'https://4626.fun',
        pathname: '/',
        search: '?reason=needs-session',
        hash: '#waitlist',
      }),
    ).toBeNull()
  })

  it('shows the inline waitlist entry for the sticky session flag', () => {
    expect(
      shouldShowWaitlistEntry({
        pathname: '/',
        stickyOpen: true,
      }),
    ).toBe(true)
  })

  it('shows the inline waitlist entry on the canonical /waitlist route', () => {
    expect(
      shouldShowWaitlistEntry({
        pathname: '/waitlist',
        stickyOpen: false,
      }),
    ).toBe(true)
  })

  it('builds close target by returning / from the canonical waitlist route', () => {
    expect(
      buildWaitlistCloseTarget({
        pathname: '/waitlist',
        search: '',
        hash: '',
      }),
    ).toEqual({
      path: '/',
      changed: true,
    })
  })

  it('returns unchanged target when no waitlist trigger exists', () => {
    expect(
      buildWaitlistCloseTarget({
        pathname: '/',
        search: '',
        hash: '',
      }),
    ).toEqual({
      path: '/',
      changed: false,
    })
  })
})
