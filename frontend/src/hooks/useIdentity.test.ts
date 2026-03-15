import { describe, expect, it } from 'vitest'

import { pickIdentityAvatar } from './useIdentity'

describe('pickIdentityAvatar', () => {
  it('prefers basename avatars over lens avatars', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: 'https://example.com/base.png',
        lensAvatar: 'https://example.com/lens.png',
      }),
    ).toBe('https://example.com/base.png')
  })

  it('falls back to lens avatar when basename avatar is missing', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: null,
        lensAvatar: 'https://example.com/lens.png',
      }),
    ).toBe('https://example.com/lens.png')
  })

  it('returns null when no avatar sources are available', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: null,
        lensAvatar: null,
      }),
    ).toBeNull()
  })
})
