import { describe, expect, it } from 'vitest'

import { buildWaitlistEntryPath, buildWaitlistEntryUrl } from './waitlistEntry'

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
})
