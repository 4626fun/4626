import { describe, expect, it } from 'vitest'

import { buildWaitlistCloseTarget, shouldOpenWaitlistModal, shouldRedirectHomeToSwap } from './Home'

describe('shouldRedirectHomeToSwap', () => {
  it('redirects app home traffic to /swap by default', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        search: '',
        hash: '',
      }),
    ).toBe(true)
  })

  it('keeps marketing mode on home', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'marketing',
        search: '',
        hash: '',
      }),
    ).toBe(false)
  })

  it('does not redirect app waitlist needs-session links', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        search: '?reason=needs-session',
        hash: '#waitlist',
      }),
    ).toBe(false)
  })

  it('does not redirect app waitlist needs-acceptance links', () => {
    expect(
      shouldRedirectHomeToSwap({
        hostMode: 'app',
        search: '?reason=needs-acceptance',
        hash: '#waitlist',
      }),
    ).toBe(false)
  })
})

describe('waitlist modal URL helpers', () => {
  it('opens modal for sticky session flag', () => {
    expect(
      shouldOpenWaitlistModal({
        hash: '',
        search: '',
        stickyOpen: true,
      }),
    ).toBe(true)
  })

  it('builds close target by removing waitlist hash and query triggers', () => {
    expect(
      buildWaitlistCloseTarget({
        pathname: '/',
        search: '?reason=needs-acceptance&wl=1&ref=abc',
        hash: '#waitlist',
      }),
    ).toEqual({
      path: '/?reason=needs-acceptance',
      changed: true,
    })
  })

  it('returns unchanged target when no waitlist trigger exists', () => {
    expect(
      buildWaitlistCloseTarget({
        pathname: '/',
        search: '?reason=needs-session',
        hash: '',
      }),
    ).toEqual({
      path: '/?reason=needs-session',
      changed: false,
    })
  })
})
