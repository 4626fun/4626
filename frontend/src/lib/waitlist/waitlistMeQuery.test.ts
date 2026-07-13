import { describe, expect, it } from 'vitest'

import { getWaitlistMeSessionQueryKey } from './waitlistMeQuery'

describe('getWaitlistMeSessionQueryKey', () => {
  it('isolates cached waitlist profiles by normalized session address', () => {
    expect(getWaitlistMeSessionQueryKey('0xABC')).toEqual(['waitlist', 'me', '0xabc'])
    expect(getWaitlistMeSessionQueryKey('0xDEF')).toEqual(['waitlist', 'me', '0xdef'])
  })

  it('uses a stable anonymous scope before a session is established', () => {
    expect(getWaitlistMeSessionQueryKey(null)).toEqual(['waitlist', 'me', 'anonymous'])
  })
})
