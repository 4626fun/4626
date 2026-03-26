import { describe, expect, it } from 'vitest'

import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistEntryPath,
  buildWaitlistEntryUrl,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
} from './waitlistEntry'

describe('waitlistEntry', () => {
  it('builds the canonical waitlist entry path with reason and modal hash', () => {
    expect(buildWaitlistEntryPath('needs-session')).toBe('/?reason=needs-session#waitlist')
    expect(buildWaitlistEntryPath('needs-acceptance')).toBe('/?reason=needs-acceptance#waitlist')
  })

  it('builds waitlist entry URLs against the provided base origin', () => {
    expect(buildWaitlistEntryUrl('https://4626.fun', 'needs-session')).toBe('https://4626.fun/?reason=needs-session#waitlist')
    expect(buildWaitlistEntryUrl('https://v1.4626.fun/', 'needs-acceptance')).toBe(
      'https://v1.4626.fun/?reason=needs-acceptance#waitlist',
    )
  })

  it('builds the canonical marketing waitlist hash path and URL', () => {
    expect(getCanonicalMarketingWaitlistPath()).toBe('/#waitlist')
    expect(buildCanonicalMarketingWaitlistUrl('https://4626.fun/')).toBe('https://4626.fun/#waitlist')
  })

  it('treats only the root hash path as the live marketing waitlist entry surface', () => {
    expect(isMarketingWaitlistEntryLocation({ pathname: '/', hash: '#waitlist' })).toBe(true)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/waitlist', hash: '' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/', hash: '' })).toBe(false)
    expect(isMarketingWaitlistEntryLocation({ pathname: '/faq', hash: '#waitlist' })).toBe(false)
  })
})
