import { describe, expect, it } from 'vitest'

import { isPrivyProviderLinked } from '@/lib/privy/privyLinkedAccounts'

describe('privyLinkedAccounts', () => {
  it('detects twitter links from twitter and x account types', () => {
    expect(
      isPrivyProviderLinked({ linkedAccounts: [{ type: 'twitter_oauth', username: '@4626' }] }, 'twitter'),
    ).toBe(true)
    expect(isPrivyProviderLinked({ linkedAccounts: [{ type: 'x', username: '@4626' }] }, 'twitter')).toBe(true)
    expect(isPrivyProviderLinked({ linkedAccounts: [] }, 'twitter')).toBe(false)
  })
})
