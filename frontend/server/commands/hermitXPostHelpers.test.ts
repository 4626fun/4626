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

  it('formats oauth write-permission skip copy with account guidance', () => {
    expect(
      formatHermitXCrossPostSkipMessage(
        'Twitter posting is authenticated, but this X app does not have OAuth 1.0a write permission.\n- account: @4626fun\n- oauth1 access-level: read',
      ),
    ).toBe(
      'X cross-post skipped — wrong or read-only X app (@4626fun). Run `/x status` and verify `HERMIT_TWITTER_*` OAuth1 credentials.',
    )
  })

  it('truncates long captions for X', () => {
    const long = 'a'.repeat(300)
    expect(truncateWithEllipsis(long, 280).length).toBeLessThanOrEqual(280)
  })
})
