import { describe, expect, it } from 'vitest'

import { isTruncatedAddressLabel } from './useChatIdentity'

describe('isTruncatedAddressLabel', () => {
  it('matches full and truncated EVM addresses', () => {
    expect(isTruncatedAddressLabel('0xAb6d5C10b03300326cd7fab7267ae192842967b5')).toBe(true)
    expect(isTruncatedAddressLabel('0x2f9e…6ed2')).toBe(true)
    expect(isTruncatedAddressLabel('0x2f9e...6ed2')).toBe(true)
  })

  it('does not treat basenames as truncated addresses', () => {
    expect(isTruncatedAddressLabel('jessextbt.base.eth')).toBe(false)
    expect(isTruncatedAddressLabel('jessextbt')).toBe(false)
  })
})
