import { describe, expect, it } from 'vitest'

import { isTransientWaitlistNetworkError } from './waitlistBootstrapUtils'

describe('isTransientWaitlistNetworkError', () => {
  it('detects browser fetch failures', () => {
    expect(isTransientWaitlistNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isTransientWaitlistNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('detects dynamic import fetch failures from extension contexts', () => {
    expect(
      isTransientWaitlistNetworkError(
        new Error('Failed to fetch dynamically imported module: chrome-extension://abc123/requestProvider.js'),
      ),
    ).toBe(true)
  })

  it('ignores API-level bootstrap failures', () => {
    expect(isTransientWaitlistNetworkError(new Error('Failed to bootstrap waitlist state.'))).toBe(false)
    expect(isTransientWaitlistNetworkError(new Error('Database unavailable'))).toBe(false)
  })
})
