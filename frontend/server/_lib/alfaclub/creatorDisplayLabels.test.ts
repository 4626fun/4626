import { describe, expect, it, vi } from 'vitest'

import {
  pickCreatorDisplayLabel,
  readCreatorLabels,
} from './creatorDisplayLabels.js'
import { readCachedCreatorLabels } from './roomLabelCache.js'

vi.mock('./roomLabelCache.js', () => ({
  readCachedCreatorLabels: vi.fn(async () => new Map()),
}))

describe('pickCreatorDisplayLabel', () => {
  it('prefers chat username, then twitter, then room name, then basename', () => {
    expect(
      pickCreatorDisplayLabel({
        chatUsername: 'Flip_Research',
        twitterUsername: 'other',
        roomName: 'Flip Room',
        basename: 'flip.base.eth',
      }),
    ).toBe('@Flip_Research')

    expect(
      pickCreatorDisplayLabel({
        twitterUsername: 'Flip_Research',
        roomName: 'Flip Room',
      }),
    ).toBe('@Flip_Research')

    expect(
      pickCreatorDisplayLabel({
        roomName: 'Flip Research Room',
      }),
    ).toBe('Flip Research Room')

    expect(
      pickCreatorDisplayLabel({
        basename: 'flip.base.eth',
      }),
    ).toBe('flip.base.eth')
  })

  it('normalizes leading @ and whitespace', () => {
    expect(
      pickCreatorDisplayLabel({
        chatUsername: '   @@Flip_Research  ',
      }),
    ).toBe('@Flip_Research')
  })

  it('uses cache labels before dynamic lookups', async () => {
    vi.mocked(readCachedCreatorLabels).mockResolvedValueOnce(
      new Map([['0xf39b0d1f2c31b3832ac0cb3ae4334c16272bd37e', 'Clean Slate Protocol']]),
    )
    const labels = await readCreatorLabels([
      {
        address: '0xf39b0d1f2c31b3832ac0cb3ae4334c16272bd37e',
        tokenId: '50',
      },
    ])

    expect(labels.get('0xf39b0d1f2c31b3832ac0cb3ae4334c16272bd37e')).toBe(
      'Clean Slate Protocol',
    )
  })
})
