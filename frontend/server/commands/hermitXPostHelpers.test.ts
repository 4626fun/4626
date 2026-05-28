import { describe, expect, it } from 'vitest'

import {
  formatHermitXCrossPostSkipMessage,
  isTwitterDuplicateContentError,
  uniquifyHermitTweetCaption,
} from './hermitXPostHelpers.js'

describe('isTwitterDuplicateContentError', () => {
  it('detects Twitter duplicate content 403 copy', () => {
    expect(
      isTwitterDuplicateContentError(
        'Tweet failed (403): You are not allowed to create a Tweet with duplicate content.',
      ),
    ).toBe(true)
  })
})

describe('formatHermitXCrossPostSkipMessage', () => {
  it('uses friendly copy for duplicate content', () => {
    expect(
      formatHermitXCrossPostSkipMessage(
        'Tweet failed (403): You are not allowed to create a Tweet with duplicate content.',
      ),
    ).toBe('X cross-post skipped — already posted this meme recently.')
  })
})

describe('uniquifyHermitTweetCaption', () => {
  it('appends meme id and timestamp so bare captions are not identical', () => {
    const out = uniquifyHermitTweetCaption('cat laugh from the Hermit cave.', {
      memeId: 'catlaugh-1',
      mediaUrl: 'https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      now: () => Date.parse('2026-05-28T09:30:00.000Z'),
    })
    expect(out).toContain('cat laugh from the Hermit cave.')
    expect(out).toContain('catlaugh-1')
    expect(out).toContain('2026-05-28 09:30')
    expect(out).not.toBe('cat laugh from the Hermit cave.')
  })
})
