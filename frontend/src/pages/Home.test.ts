import { describe, expect, it } from 'vitest'

import { shouldRedirectHomeToSwap } from './Home'

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
