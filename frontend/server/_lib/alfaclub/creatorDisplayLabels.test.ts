import { describe, expect, it } from 'vitest'

import { pickCreatorDisplayLabel } from './creatorDisplayLabels.js'

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
})
