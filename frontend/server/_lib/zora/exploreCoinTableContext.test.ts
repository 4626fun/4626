import { describe, expect, it } from 'vitest'

import {
  buildCreatorProfileFromTableContext,
  buildMediaContentFromAvatarUrl,
} from './exploreCoinTableContext.js'

describe('exploreCoinTableContext helpers', () => {
  it('builds media content from avatar url', () => {
    expect(buildMediaContentFromAvatarUrl('https://example.com/a.png')).toEqual({
      previewImage: {
        small: 'https://example.com/a.png',
        medium: 'https://example.com/a.png',
      },
    })
    expect(buildMediaContentFromAvatarUrl(null)).toBeUndefined()
  })

  it('merges indexed profile context with row handles', () => {
    expect(
      buildCreatorProfileFromTableContext(
        { zora_handle: 'jessepollak', twitter_username: null },
        {
          coinAddress: '0x123',
          fees24hUsd: null,
          uniqueHolders: null,
          marketCapDelta24h: null,
          name: 'jesse',
          symbol: 'jesse',
          avatarImageUrl: 'https://example.com/avatar.png',
          zoraHandle: 'jessepollak',
        },
      ),
    ).toEqual({
      handle: 'jessepollak',
      username: 'jessepollak',
      avatar: {
        previewImage: {
          small: 'https://example.com/avatar.png',
          medium: 'https://example.com/avatar.png',
        },
      },
    })
  })
})
