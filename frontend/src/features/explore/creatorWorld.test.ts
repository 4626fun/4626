import { describe, expect, it } from 'vitest'

import type { ZoraCoin } from '@/lib/zora/types'

import {
  buildCreatorWorldItems,
  normalizeCreatorExploreView,
  resolveCreatorWorldImage,
} from './creatorWorld'

function creator(address: string, overrides: Partial<ZoraCoin> = {}): ZoraCoin {
  return {
    address,
    name: `Creator ${address}`,
    symbol: 'WORLD',
    chainId: 8453,
    ...overrides,
  }
}

describe('creator world model', () => {
  it('accepts only the world view and falls back to the existing table', () => {
    expect(normalizeCreatorExploreView('world')).toBe('world')
    expect(normalizeCreatorExploreView('table')).toBe('table')
    expect(normalizeCreatorExploreView('globe')).toBe('table')
    expect(normalizeCreatorExploreView(null)).toBe('table')
  })

  it('prefers the creator profile avatar before creator-coin media', () => {
    const coin = creator('0x1111111111111111111111111111111111111111', {
      creatorProfile: {
        avatar: {
          previewImage: {
            medium: 'ipfs://profile-medium',
            small: 'https://example.com/profile-small.png',
          },
        },
      },
      mediaContent: {
        previewImage: {
          medium: 'https://example.com/coin-medium.png',
        },
      },
    })

    expect(resolveCreatorWorldImage(coin)).toBe(
      'https://ipfs.decentralized-content.com/ipfs/profile-medium',
    )
  })

  it('falls back to creator-coin media when no profile avatar exists', () => {
    const coin = creator('0x2222222222222222222222222222222222222222', {
      mediaContent: {
        previewImage: {
          medium: 'https://example.com/coin-medium.png',
        },
      },
    })

    expect(resolveCreatorWorldImage(coin)).toBe('https://example.com/coin-medium.png')
  })

  it('deduplicates addresses, caps results, and builds canonical creator links', () => {
    const first = creator('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
      name: 'First',
      symbol: 'ONE',
    })
    const duplicate = creator('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      name: 'Duplicate',
    })
    const second = creator('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', {
      name: 'Second',
    })

    const items = buildCreatorWorldItems([first, duplicate, second], 2)

    expect(items).toHaveLength(2)
    expect(items.map((item) => item.name)).toEqual(['First', 'Second'])
    expect(items[0]).toMatchObject({
      address: first.address,
      detailPath: `/explore/creators/base/${first.address}`,
      symbol: 'ONE',
    })
  })
})
