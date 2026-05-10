/**
 * `/meme` inline-image attachment behavior. Builds on PR #481 by
 * letting the Pinata reply optionally carry a public HTTPS image URL
 * which gets validated and surfaced to AlfaClub via the existing
 * `mediaAttachments` channel.
 *
 * Lock-in:
 *   - imageUrl / image_url / url top-level fields are recognised.
 *   - attachments[]/media[]/images[] arrays — first valid entry wins.
 *   - Nested {url, imageUrl, image_url} on array entries supported.
 *   - Invalid URLs (http://, data:, .svg, .html, malformed) →
 *     attachments dropped silently; reply remains text-only.
 *   - No imageUrl field → today's text-only behavior.
 *   - /gmeow attachment behavior is independent; /meme changes do
 *     not affect it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import { _hermitPromptBuildersForTests, executeHermitCommand } from './skillRouter'

const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

function pinataMemeReply(payload: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({ text: JSON.stringify(payload) }),
  } as Response
}

describe('/meme — formatHermitImageResult (unit, no fetch)', () => {
  const { formatHermitImageResult, pickCandidateImageUrl } =
    _hermitPromptBuildersForTests as {
      formatHermitImageResult: (raw: string) => {
        imagePrompt: string
        reply: string
        mediaAttachments: Array<{ url: string; type: string; mime_type?: string; filename?: string }>
      }
      pickCandidateImageUrl: (parsed: Record<string, unknown>) => string | null
    }

  it('falls back to text-only when imageUrl is absent', () => {
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'Noir akita in a neon pit',
        caption: 'Tape green, tails up.',
        hashtags: ['#4626'],
      }),
    )
    expect(out.mediaAttachments).toEqual([])
    expect(out.reply).toContain('Prompt: Noir akita in a neon pit')
    expect(out.reply).toContain('Caption: Tape green, tails up.')
    expect(out.reply).toContain('#4626')
    expect(out.reply).not.toContain('http')
  })

  it('attaches a valid imageUrl returned by Pinata', () => {
    const url = 'https://cdn.example.com/akita.png'
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        caption: 'c',
        hashtags: ['#x'],
        imageUrl: url,
      }),
    )
    expect(out.mediaAttachments).toEqual([
      {
        url,
        type: 'photo',
        filename: 'akita.png',
        mime_type: 'image/png',
      },
    ])
    // Reply still carries the prompt/caption/hashtags AND the
    // validated URL appended for clients that don't render
    // attachments.
    expect(out.reply).toContain('Prompt: p')
    expect(out.reply).toContain('Caption: c')
    expect(out.reply).toContain('#x')
    expect(out.reply).toContain(url)
  })

  it('also accepts snake_case image_url', () => {
    const url = 'https://cdn.example.com/cat.gif'
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        caption: 'c',
        hashtags: ['#y'],
        image_url: url,
      }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]).toMatchObject({
      url,
      type: 'photo',
      mime_type: 'image/gif',
    })
  })

  it('also accepts a generic top-level url field', () => {
    const url = 'https://cdn.example.com/photo.webp'
    const out = formatHermitImageResult(
      JSON.stringify({ imagePrompt: 'p', url }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]).toMatchObject({
      url,
      type: 'photo',
      mime_type: 'image/webp',
    })
  })

  it('reads the first entry of an attachments[] string array', () => {
    const url = 'https://cdn.example.com/first.jpg'
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        attachments: [url, 'https://cdn.example.com/second.png'],
      }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]?.url).toBe(url)
  })

  it('reads url from the first attachments[] object entry', () => {
    const url = 'https://cdn.example.com/obj.jpeg'
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        attachments: [{ url, type: 'photo' }],
      }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]?.url).toBe(url)
  })

  it('reads url from media[] when attachments[] is absent', () => {
    const url = 'https://cdn.example.com/m.png'
    const out = formatHermitImageResult(
      JSON.stringify({ imagePrompt: 'p', media: [{ url }] }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]?.url).toBe(url)
  })

  it('reads url from images[] when neither attachments[] nor media[] is present', () => {
    const url = 'https://cdn.example.com/i.gif'
    const out = formatHermitImageResult(
      JSON.stringify({ imagePrompt: 'p', images: [url] }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]?.url).toBe(url)
  })

  it('drops invalid http:// URL and falls back to text-only', () => {
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        caption: 'c',
        imageUrl: 'http://insecure.example.com/cat.png',
      }),
    )
    expect(out.mediaAttachments).toEqual([])
    expect(out.reply).toContain('Prompt: p')
    expect(out.reply).toContain('Caption: c')
    expect(out.reply).not.toContain('http://')
  })

  it('drops a non-image extension imageUrl (e.g. .svg, .html)', () => {
    expect(
      formatHermitImageResult(
        JSON.stringify({ imagePrompt: 'p', imageUrl: 'https://x.example/icon.svg' }),
      ).mediaAttachments,
    ).toEqual([])
    expect(
      formatHermitImageResult(
        JSON.stringify({ imagePrompt: 'p', imageUrl: 'https://x.example/page.html' }),
      ).mediaAttachments,
    ).toEqual([])
  })

  it('drops a malformed URL string', () => {
    expect(
      formatHermitImageResult(
        JSON.stringify({ imagePrompt: 'p', imageUrl: 'not a url' }),
      ).mediaAttachments,
    ).toEqual([])
  })

  it('drops a data: URL', () => {
    expect(
      formatHermitImageResult(
        JSON.stringify({ imagePrompt: 'p', imageUrl: 'data:image/png;base64,AAA' }),
      ).mediaAttachments,
    ).toEqual([])
  })

  it('passes through when ?filename= rescues an opaque-path URL (PR #481)', () => {
    const url =
      'https://4626.fun/ipfs/bafybeihhh?filename=hermit-meme.gif'
    const out = formatHermitImageResult(
      JSON.stringify({ imagePrompt: 'p', imageUrl: url }),
    )
    expect(out.mediaAttachments).toEqual([
      {
        url,
        type: 'photo',
        filename: 'hermit-meme.gif',
        mime_type: 'image/gif',
      },
    ])
  })

  it('prefers imageUrl over image_url over url over attachments[]', () => {
    const winner = 'https://cdn.example/winner.png'
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        imageUrl: winner,
        image_url: 'https://cdn.example/loser1.png',
        url: 'https://cdn.example/loser2.png',
        attachments: ['https://cdn.example/loser3.png'],
      }),
    )
    expect(out.mediaAttachments).toHaveLength(1)
    expect(out.mediaAttachments[0]?.url).toBe(winner)
  })

  it('skips invalid first attachments[] entry and stops there (no scanning)', () => {
    // Documenting current behavior: pickCandidateImageUrl returns the
    // first non-empty candidate it finds; if that candidate then
    // fails inferPublicMediaAttachment, we drop it rather than
    // hunting through the rest of the list. Keeps the code simple
    // and avoids accidentally surfacing a second-choice URL the
    // model didn't intend as primary.
    const out = formatHermitImageResult(
      JSON.stringify({
        imagePrompt: 'p',
        attachments: ['http://insecure/first.png', 'https://cdn.example/ok.png'],
      }),
    )
    expect(out.mediaAttachments).toEqual([])
  })

  it('pickCandidateImageUrl unit — happy path and missing fields', () => {
    expect(pickCandidateImageUrl({ imageUrl: 'https://x' })).toBe('https://x')
    expect(pickCandidateImageUrl({ image_url: 'https://y' })).toBe('https://y')
    expect(pickCandidateImageUrl({ url: 'https://z' })).toBe('https://z')
    expect(pickCandidateImageUrl({})).toBeNull()
    expect(pickCandidateImageUrl({ imageUrl: '   ' })).toBeNull()
    expect(pickCandidateImageUrl({ imageUrl: 42 as unknown as string })).toBeNull()
  })
})

describe('/meme — end-to-end via executeHermitCommand', () => {
  let restoreEnv: (() => void) | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
    restoreEnv = applyEnv({
      HERMIT_PINATA_CHAT_ENDPOINT: 'https://pinata.example/chat',
      HERMIT_PINATA_BEARER_TOKEN: 'token-abc',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('attaches a valid imageUrl returned by Pinata', async () => {
    const url = 'https://cdn.example.com/meme.png'
    fetchMock.mockResolvedValueOnce(
      pinataMemeReply({
        imagePrompt: 'p',
        caption: 'c',
        hashtags: ['#x'],
        imageUrl: url,
      }),
    )
    const result = await executeHermitCommand({
      commandText: '/meme akita neon',
      senderAddress: ALICE,
    })
    expect(result.kind).toBe('meme')
    expect(result.provider).toBe('pinata')
    expect(result.mediaAttachments).toEqual([
      { url, type: 'photo', filename: 'meme.png', mime_type: 'image/png' },
    ])
    expect(result.reply).toContain(url)
  })

  it('supports snake_case image_url', async () => {
    const url = 'https://cdn.example.com/meme.gif'
    fetchMock.mockResolvedValueOnce(
      pinataMemeReply({ imagePrompt: 'p', image_url: url }),
    )
    const result = await executeHermitCommand({
      commandText: '/meme akita',
      senderAddress: ALICE,
    })
    expect(result.mediaAttachments).toHaveLength(1)
    expect(result.mediaAttachments?.[0]).toMatchObject({
      url,
      type: 'photo',
      mime_type: 'image/gif',
    })
  })

  it('falls back to text-only when imageUrl is missing (existing behavior preserved)', async () => {
    fetchMock.mockResolvedValueOnce(
      pinataMemeReply({
        imagePrompt: 'Noir akita in a neon trading pit',
        caption: 'Tape turns green, tails up.',
        hashtags: ['#4626', '#meme'],
      }),
    )
    const result = await executeHermitCommand({
      commandText: '/meme noir akita',
      senderAddress: ALICE,
    })
    expect(result.kind).toBe('meme')
    expect(result.imagePrompt).toBe('Noir akita in a neon trading pit')
    expect(result.reply).toContain('Prompt: Noir akita in a neon trading pit')
    expect(result.reply).toContain('Caption: Tape turns green, tails up.')
    expect(result.mediaAttachments).toBeUndefined()
  })

  it('falls back to text-only when imageUrl is invalid (http://, .svg, malformed)', async () => {
    fetchMock.mockResolvedValueOnce(
      pinataMemeReply({
        imagePrompt: 'p',
        caption: 'c',
        imageUrl: 'http://insecure.example.com/x.png',
      }),
    )
    const result = await executeHermitCommand({
      commandText: '/meme test',
      senderAddress: ALICE,
    })
    expect(result.mediaAttachments).toBeUndefined()
    expect(result.reply).toContain('Prompt: p')
    expect(result.reply).not.toContain('http://')
  })

  it('drops a `?filename=evil.html` URL (defense-in-depth via inferPublicMediaAttachment)', async () => {
    fetchMock.mockResolvedValueOnce(
      pinataMemeReply({
        imagePrompt: 'p',
        imageUrl: 'https://gateway.example/ipfs/bafy?filename=evil.html',
      }),
    )
    const result = await executeHermitCommand({
      commandText: '/meme x',
      senderAddress: ALICE,
    })
    expect(result.mediaAttachments).toBeUndefined()
  })

  it('still falls back to text-only when Pinata returns non-JSON text (legacy provider behavior)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Akita cat meme prompt' }),
    } as Response)
    const result = await executeHermitCommand({
      commandText: '/meme akita',
      senderAddress: ALICE,
    })
    expect(result.imagePrompt).toBe('Akita cat meme prompt')
    expect(result.mediaAttachments).toBeUndefined()
  })

  it('mentions the optional imageUrl field in the Pinata prompt so the provider can opt in', () => {
    const { buildImage } = _hermitPromptBuildersForTests
    const prompt = buildImage('akita neon', null)
    expect(prompt).toContain('imageUrl')
    expect(prompt).toMatch(/OPTIONAL/i)
    expect(prompt).toMatch(/HTTPS/i)
  })
})

describe('/gmeow — attachment behavior unchanged by /meme work', () => {
  let restoreEnv: (() => void) | null = null
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
    vi.restoreAllMocks()
  })

  it('plain /gmeow still attaches the bundled cat-laugh fixture (PR #481 behavior)', async () => {
    const result = await executeHermitCommand({
      commandText: '/gmeow',
      senderAddress: ALICE,
    })
    expect(result.kind).toBe('gmeow')
    expect(result.mediaAttachments).toEqual([
      {
        url: expect.stringContaining('/giphy.gif'),
        type: 'photo',
        filename: 'giphy.gif',
        mime_type: 'image/gif',
      },
    ])
    // /gmeow's attachment is independent of /meme — nothing in the
    // /meme-specific extractor should leak into this path.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
