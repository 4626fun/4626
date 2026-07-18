import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./pinataPin.js', () => ({
  pinRemoteMediaToPinata: vi.fn(),
}))
vi.mock('./repository.js', () => ({
  createHermitMeme: vi.fn(),
  findHermitMemeByUrlOrCid: vi.fn(),
}))

import { pinRemoteMediaToPinata } from './pinataPin.js'
import { createHermitMeme, findHermitMemeByUrlOrCid } from './repository.js'
import { isKeepableMediaAttachment, keepHermitMemeFromMedia, pickKeepableMediaUrl } from './keepMeme.js'

describe('keepMeme helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('picks gif/photo attachments only', () => {
    expect(
      pickKeepableMediaUrl([
        { url: 'https://x.example/a.pdf', type: 'file' },
        { url: 'https://x.example/a.gif', type: 'gif' },
      ])?.url,
    ).toBe('https://x.example/a.gif')
    expect(isKeepableMediaAttachment({ url: 'https://x.example/a.jpeg', type: 'photo' })).toBe(true)
  })

  it('reuses an existing arsenal entry without re-pinning', async () => {
    vi.mocked(findHermitMemeByUrlOrCid).mockResolvedValueOnce({
      id: 9,
      ownerAddress: '0xabc',
      roomId: '1484',
      cid: 'bafy1',
      url: 'https://4626.fun/ipfs/bafy1?filename=a.gif',
      caption: 'old',
      tags: ['kept'],
      createdBy: '0xabc',
      createdAt: '2026-07-18T00:00:00Z',
    })
    const result = await keepHermitMemeFromMedia({
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1484',
      media: { url: 'https://cdn.example/a.gif', type: 'gif' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reused).toBe(true)
    expect(pinRemoteMediaToPinata).not.toHaveBeenCalled()
    expect(createHermitMeme).not.toHaveBeenCalled()
  })

  it('pins and stores a new meme', async () => {
    vi.mocked(findHermitMemeByUrlOrCid).mockResolvedValue(null)
    vi.mocked(pinRemoteMediaToPinata).mockResolvedValue({
      ok: true,
      cid: 'bafynew',
      url: 'https://4626.fun/ipfs/bafynew?filename=chef.gif',
      filename: 'chef.gif',
      bytes: 1234,
    })
    vi.mocked(createHermitMeme).mockResolvedValue({
      id: 42,
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1659',
      cid: 'bafynew',
      url: 'https://4626.fun/ipfs/bafynew?filename=chef.gif',
      caption: 'chef energy',
      tags: ['kept', 'gif', 'room:1659'],
      createdBy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-07-18T00:00:00Z',
    })

    const result = await keepHermitMemeFromMedia({
      ownerAddress: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      roomId: '1659',
      media: { url: 'https://cdn.example/chef.gif', type: 'gif', filename: 'chef.gif' },
      caption: 'chef energy',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reused).toBe(false)
    expect(result.meme.id).toBe(42)
    expect(createHermitMeme).toHaveBeenCalledOnce()
  })
})
