import { describe, expect, it } from 'vitest'

import {
  buildCreatorProfileFromTableContext,
  buildMediaContentFromAvatarUrl,
  buildTrend30dFromTableContext,
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
          sparkline30dValues: [],
          sparkline30dChangePct: null,
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

  it('builds trend30d payload from indexed table context', () => {
    expect(
      buildTrend30dFromTableContext({
        coinAddress: '0x123',
        fees24hUsd: null,
        uniqueHolders: null,
        marketCapDelta24h: null,
        name: null,
        symbol: null,
        avatarImageUrl: null,
        zoraHandle: null,
        sparkline30dValues: [1, 1.1, 1.2],
        sparkline30dChangePct: 20,
      }),
    ).toEqual({
      values: [1, 1.1, 1.2],
      changePercent: 20,
    })
  })
})
