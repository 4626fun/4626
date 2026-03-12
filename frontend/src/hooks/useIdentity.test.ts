import { describe, expect, it } from 'vitest'

import { pickIdentityAvatar } from './useIdentity'

describe('pickIdentityAvatar', () => {
  it('prefers basename avatars over farcaster and lens avatars', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: 'https://example.com/base.png',
        farcasterAvatar: 'https://example.com/farcaster.png',
        lensAvatar: 'https://example.com/lens.png',
      }),
    ).toBe('https://example.com/base.png')
  })

  it('falls back to farcaster avatar when basename avatar is missing', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: null,
        farcasterAvatar: 'https://example.com/farcaster.png',
        lensAvatar: 'https://example.com/lens.png',
      }),
    ).toBe('https://example.com/farcaster.png')
  })

  it('falls back to lens avatar when basename and farcaster avatars are missing', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: null,
        farcasterAvatar: null,
        lensAvatar: 'https://example.com/lens.png',
      }),
    ).toBe('https://example.com/lens.png')
  })

  it('returns null when no avatar sources are available', () => {
    expect(
      pickIdentityAvatar({
        basenameAvatar: null,
        farcasterAvatar: null,
        lensAvatar: null,
      }),
    ).toBeNull()
  })
})
