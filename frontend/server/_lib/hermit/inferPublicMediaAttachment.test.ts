/**
 * Unit tests for `inferPublicMediaAttachment` — the URL → AlfaClub
 * media-attachment record validator that gates which Hermit reply URLs
 * are sent as inline images vs plain text hyperlinks. The function
 * itself is not exported from the module's public surface; we reach it
 * through the existing `_hermitPromptBuildersForTests` test seam.
 *
 * Behaviour locked in by these tests (see PR investigation report and
 * `inferPublicMediaAttachment` in skillRouter.ts):
 *
 *   - HTTPS only.
 *   - Path-based extension detection: `.gif|.jpg|.jpeg|.png|.webp`
 *     is recognised as an image.
 *   - When the path has no recognised extension, fall back to the
 *     `?filename=…` query parameter — but only the extension is
 *     honoured, never any other attribute of the value.
 *   - `media.tenor.com/*.gif` keeps its bespoke `type: 'tenor-gif'`
 *     shape (no `mime_type`) so the production AlfaClub renderer that
 *     keys on that exact type continues to work unchanged.
 *   - Non-Tenor GIFs and `.webp/.jpg/.jpeg/.png` URLs return the
 *     generic `type: 'photo'` shape with an explicit `mime_type`.
 *   - Non-image extensions (`.html`, `.svg`, `.mp4`, …), unsupported
 *     schemes (`http`, `data:`), and malformed URLs all return null.
 */
import { describe, expect, it } from 'vitest'

import { _hermitPromptBuildersForTests } from './skillRouter'

const { inferPublicMediaAttachment } = _hermitPromptBuildersForTests as {
  inferPublicMediaAttachment: (
    url: string,
  ) =>
    | { url: string; type: string; filename?: string; mime_type?: string }
    | null
}

describe('inferPublicMediaAttachment — path-based recognition (existing behaviour)', () => {
  it('returns the bespoke `tenor-gif` shape for media.tenor.com GIF URLs', () => {
    const out = inferPublicMediaAttachment(
      'https://media.tenor.com/rfbhh3Hh3DMAAAAC/mochi-mochimons.gif',
    )
    expect(out).toEqual({
      url: 'https://media.tenor.com/rfbhh3Hh3DMAAAAC/mochi-mochimons.gif',
      type: 'tenor-gif',
    })
    // mime_type is intentionally absent on the Tenor branch.
    expect(out).not.toHaveProperty('mime_type')
  })

  it('returns the generic `photo` shape for plain .jpg URLs', () => {
    expect(
      inferPublicMediaAttachment('https://cdn.example.com/path/to/cat.jpg'),
    ).toEqual({
      url: 'https://cdn.example.com/path/to/cat.jpg',
      type: 'photo',
      filename: 'cat.jpg',
      mime_type: 'image/jpeg',
    })
  })

  it('returns the generic `photo` shape for .jpeg URLs (alias of jpg)', () => {
    expect(
      inferPublicMediaAttachment(
        'https://cdn.example.com/folder/photo.jpeg',
      ),
    ).toEqual({
      url: 'https://cdn.example.com/folder/photo.jpeg',
      type: 'photo',
      filename: 'photo.jpeg',
      mime_type: 'image/jpeg',
    })
  })

  it('returns the generic `photo` shape for .png URLs', () => {
    expect(
      inferPublicMediaAttachment('https://cdn.example.com/img/sticker.png'),
    ).toEqual({
      url: 'https://cdn.example.com/img/sticker.png',
      type: 'photo',
      filename: 'sticker.png',
      mime_type: 'image/png',
    })
  })

  it('returns the generic `photo` shape for .webp URLs', () => {
    expect(
      inferPublicMediaAttachment('https://cdn.example.com/x/cute.webp'),
    ).toEqual({
      url: 'https://cdn.example.com/x/cute.webp',
      type: 'photo',
      filename: 'cute.webp',
      mime_type: 'image/webp',
    })
  })

  it('preserves the original-cased URL even when path/host are lower-cased internally', () => {
    const out = inferPublicMediaAttachment('https://CDN.Example.COM/Image.PNG')
    expect(out?.url).toBe('https://CDN.Example.COM/Image.PNG')
    expect(out?.type).toBe('photo')
    expect(out?.mime_type).toBe('image/png')
  })

  it('handles a leading/trailing whitespace URL by trimming', () => {
    const out = inferPublicMediaAttachment(
      '   https://cdn.example.com/cat.png   ',
    )
    expect(out?.url).toBe('https://cdn.example.com/cat.png')
    expect(out?.type).toBe('photo')
  })
})

describe('inferPublicMediaAttachment — generic GIF support (new behaviour)', () => {
  it('returns the generic `photo` shape (type=photo, mime=image/gif) for a non-Tenor HTTPS .gif URL', () => {
    expect(
      inferPublicMediaAttachment('https://example.com/path/sloth.gif'),
    ).toEqual({
      url: 'https://example.com/path/sloth.gif',
      type: 'photo',
      filename: 'sloth.gif',
      mime_type: 'image/gif',
    })
  })

  it('does NOT collapse non-Tenor GIFs into the bespoke tenor-gif shape', () => {
    const out = inferPublicMediaAttachment(
      'https://giphy.example/cat.gif',
    )
    expect(out?.type).toBe('photo')
    expect(out?.mime_type).toBe('image/gif')
    expect(out).not.toHaveProperty('type', 'tenor-gif')
  })
})

describe('inferPublicMediaAttachment — `?filename=` query fallback (new behaviour)', () => {
  it('accepts the bundled cat-laugh ipfs gateway URL and emits an inline GIF attachment', () => {
    const url =
      'https://4626.fun/ipfs/bafybeiaj73ww23xkpuvrptykhu5ukcykd6w3fe5juc3zl6elzfz7tbj2jq?filename=catlaugh.gif'
    expect(inferPublicMediaAttachment(url)).toEqual({
      url,
      type: 'photo',
      filename: 'catlaugh.gif',
      mime_type: 'image/gif',
    })
  })

  it('accepts a `?filename=*.png` hint when the path has no recognised extension', () => {
    const url = 'https://gateway.example/ipfs/bafy123?filename=art.png'
    expect(inferPublicMediaAttachment(url)).toEqual({
      url,
      type: 'photo',
      filename: 'art.png',
      mime_type: 'image/png',
    })
  })

  it('accepts a `?filename=*.webp` hint', () => {
    const url = 'https://gateway.example/ipfs/bafy456?filename=meme.webp'
    expect(inferPublicMediaAttachment(url)).toEqual({
      url,
      type: 'photo',
      filename: 'meme.webp',
      mime_type: 'image/webp',
    })
  })

  it('rejects `?filename=*.html` (and any other non-image extension)', () => {
    expect(
      inferPublicMediaAttachment(
        'https://gateway.example/ipfs/bafy789?filename=evil.html',
      ),
    ).toBeNull()
  })

  it('rejects `?filename=*.svg` — SVG is not in the inline-image whitelist', () => {
    expect(
      inferPublicMediaAttachment(
        'https://gateway.example/ipfs/bafy789?filename=evil.svg',
      ),
    ).toBeNull()
  })

  it('rejects a `?filename=` value that has no extension at all', () => {
    expect(
      inferPublicMediaAttachment(
        'https://gateway.example/ipfs/bafy?filename=just-a-name',
      ),
    ).toBeNull()
  })

  it('rejects a value where the dot is the last character (no actual extension)', () => {
    expect(
      inferPublicMediaAttachment(
        'https://gateway.example/ipfs/bafy?filename=trailing.',
      ),
    ).toBeNull()
  })

  it('prefers the path extension over the filename hint when both are present', () => {
    // Path says .jpg, query says .png — path wins (concrete CDN URL).
    expect(
      inferPublicMediaAttachment(
        'https://cdn.example/dir/image.jpg?filename=alt.png',
      ),
    ).toEqual({
      url: 'https://cdn.example/dir/image.jpg?filename=alt.png',
      type: 'photo',
      filename: 'image.jpg',
      mime_type: 'image/jpeg',
    })
  })

  it('falls through to the filename hint when the path tail has an unrecognised extension', () => {
    expect(
      inferPublicMediaAttachment(
        'https://gateway.example/ipfs/bafy.txt?filename=meme.gif',
      ),
    ).toEqual({
      url: 'https://gateway.example/ipfs/bafy.txt?filename=meme.gif',
      type: 'photo',
      filename: 'meme.gif',
      mime_type: 'image/gif',
    })
  })
})

describe('inferPublicMediaAttachment — rejects unsafe / unsupported inputs', () => {
  it('rejects HTTP (non-TLS) URLs even when path looks like an image', () => {
    expect(
      inferPublicMediaAttachment('http://insecure.example.com/cat.png'),
    ).toBeNull()
  })

  it('rejects data: URLs', () => {
    expect(
      inferPublicMediaAttachment(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
      ),
    ).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(inferPublicMediaAttachment('https://')).toBeNull()
    expect(inferPublicMediaAttachment('not-a-url')).toBeNull()
    expect(inferPublicMediaAttachment('')).toBeNull()
  })

  it('rejects HTTPS URLs whose path has a non-image extension and no filename hint', () => {
    expect(
      inferPublicMediaAttachment('https://example.com/index.html'),
    ).toBeNull()
    expect(
      inferPublicMediaAttachment('https://example.com/movie.mp4'),
    ).toBeNull()
    expect(
      inferPublicMediaAttachment('https://example.com/x.svg'),
    ).toBeNull()
  })

  it('rejects HTTPS URLs that have only a hostname (no extension anywhere)', () => {
    expect(
      inferPublicMediaAttachment('https://example.com/'),
    ).toBeNull()
  })

  it('does not accept Tenor-host URLs whose path is not actually a .gif', () => {
    // We never want a Tenor URL to land as `tenor-gif` unless the
    // path really ends in .gif — guards against edge cases in the
    // upstream Tenor URL shape.
    expect(
      inferPublicMediaAttachment('https://media.tenor.com/foo/bar.html'),
    ).toBeNull()
  })
})
