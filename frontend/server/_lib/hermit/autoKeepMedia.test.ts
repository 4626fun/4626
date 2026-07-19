import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./keepMeme.js', () => ({
  isKeepableMediaAttachment: vi.fn((attachment: { url: string; type?: string }) => {
    return Boolean(attachment.url) && (attachment.type === 'gif' || attachment.type === 'photo')
  }),
  keepHermitMemeFromMedia: vi.fn(),
}))

import { keepHermitMemeFromMedia } from './keepMeme.js'
import {
  _resetHermitAutoKeepRecentForTests,
  autoKeepHermitMediaFromIngest,
  collectAutoKeepCandidates,
  readHermitAutoKeepEnabled,
} from './autoKeepMedia.js'

describe('autoKeepMedia', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    _resetHermitAutoKeepRecentForTests()
  })

  it('defaults enabled', () => {
    vi.stubEnv('HERMIT_AUTO_KEEP_ENABLED', '')
    expect(readHermitAutoKeepEnabled()).toBe(true)
  })

  it('collects keepable media only from allowed rooms and hex senders', () => {
    const candidates = collectAutoKeepCandidates({
      allowedRoomIds: new Set(['1484', '1659']),
      maxPerTick: 5,
      messages: [
        {
          roomId: '1484',
          messageId: 'm1',
          senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          attachmentsJson: [{ url: 'https://cdn.example/a.gif', type: 'gif' }],
        },
        {
          roomId: '999',
          messageId: 'm2',
          senderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          attachmentsJson: [{ url: 'https://cdn.example/b.gif', type: 'gif' }],
        },
        {
          roomId: '1659',
          messageId: 'm3',
          senderAddress: 'trade-completed',
          attachmentsJson: [{ url: 'https://cdn.example/c.gif', type: 'gif' }],
        },
        {
          roomId: '1659',
          messageId: 'm4',
          senderAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
          isBot: true,
          attachmentsJson: [{ url: 'https://cdn.example/d.gif', type: 'gif' }],
        },
      ],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.messageId).toBe('m1')
  })

  it('auto-keeps candidates through keepHermitMemeFromMedia', async () => {
    vi.stubEnv('HERMIT_AUTO_KEEP_ENABLED', '1')
    vi.stubEnv('HERMIT_AUTO_KEEP_ROOM_IDS', '1484')
    vi.mocked(keepHermitMemeFromMedia).mockResolvedValue({
      ok: true,
      reused: false,
      pinnedUrl: 'https://4626.fun/ipfs/bafy1?filename=a.gif',
      meme: {
        id: 1,
        ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        roomId: '1484',
        cid: 'bafy1',
        url: 'https://4626.fun/ipfs/bafy1?filename=a.gif',
        caption: 'hi',
        tags: ['auto'],
        createdBy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        createdAt: '2026-07-18T00:00:00Z',
      },
    })

    const result = await autoKeepHermitMediaFromIngest({
      fallbackRoomIds: ['1484'],
      messages: [
        {
          roomId: '1484',
          messageId: 'm1',
          senderAddress: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
          text: 'chef energy',
          attachmentsJson: [{ url: 'https://cdn.example/chef.gif', type: 'gif' }],
        },
      ],
    })
    expect(result).toEqual({ attempted: 1, saved: 1, reused: 0, skipped: 0 })
    expect(keepHermitMemeFromMedia).toHaveBeenCalledOnce()
  })
})
