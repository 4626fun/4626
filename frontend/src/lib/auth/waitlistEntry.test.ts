import { describe, expect, it } from 'vitest'

import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistEntryPath,
  buildWaitlistEntryUrl,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
} from './waitlistEntry'

describe('waitlistEntry', () => {
  it('builds the canonical waitlist entry path as a clean route', () => {
    expect(buildWaitlistEntryPath()).toBe('/waitlist')
  })

  it('builds waitlist entry URLs against the provided base origin', () => {
    expect(buildWaitlistEntryUrl('https://4626.fun')).toBe('https://4626.fun/waitlist')
    expect(buildWaitlistEntryUrl('https://v1.4626.fun/')).toBe('https://v1.4626.fun/waitlist')
  })

  it('builds the canonical marketing waitlist path and URL', () => {
    expect(getCanonicalMarketingWaitlistPath()).toBe('/waitlist')
    expect(buildCanonicalMarketingWaitlistUrl('https://4626.fun/')).toBe('https://4626.fun/waitlist')
  })

  it('treats only the clean /waitlist path as the live marketing waitlist entry surface', () => {
    expect(isMarketingWaitlistEntryLocation({ pathname: '/waitlist' })).toBe(true)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/faq' })).toBe(false)
  })
})
