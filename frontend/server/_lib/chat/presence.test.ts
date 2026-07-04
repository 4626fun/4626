import { describe, expect, it } from 'vitest'

import { formatShortChatAddress, normalizeChatAddress } from './presence.js'

describe('formatShortChatAddress', () => {
  it('shortens a checksummed address with an ellipsis', () => {
    expect(formatShortChatAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')).toBe('0xab6d…67b5')
  })

  it('returns short values unchanged', () => {
    expect(formatShortChatAddress('0x1234')).toBe('0x1234')
  })
})

describe('normalizeChatAddress', () => {
  it('lowercases valid addresses', () => {
    expect(normalizeChatAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')).toBe(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
  })
})
