import { describe, expect, it } from 'vitest'
import {
  formatHermitXCrossPostSkipMessage,
  isTwitterDuplicateContentError,
  truncateWithEllipsis,
} from './hermitXPostHelpers.js'

describe('hermitXPostHelpers', () => {
  it('detects Twitter duplicate content errors', () => {
    expect(
      isTwitterDuplicateContentError(
        'Tweet failed (403): You are not allowed to create a Tweet with duplicate content.',
      ),
    ).toBe(true)
  })

  it('formats duplicate skip copy for AlfaClub', () => {
    expect(
      formatHermitXCrossPostSkipMessage(
        'Tweet failed (403): You are not allowed to create a Tweet with duplicate content.',
      ),
    ).toBe('X cross-post skipped — already posted this meme recently.')
  })

  it('formats media download skip copy for AlfaClub', () => {
    expect(formatHermitXCrossPostSkipMessage('Failed to download Twitter media (404).')).toBe(
      'X cross-post skipped — could not fetch GIF for upload (broken host link).',
    )
  })

  it('truncates long captions for X', () => {
    const long = 'a'.repeat(300)
    expect(truncateWithEllipsis(long, 280).length).toBeLessThanOrEqual(280)
  })
})
