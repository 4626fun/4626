import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEnv } from '../../api/__tests__/helpers'

import { handleTwitterCommand, postTweetFromSystem } from './commands.js'

describe('twitter commands', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns help text', async () => {
    const result = await handleTwitterCommand({
      groupId: 'group-help',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x help',
      role: 'MEMBER',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Twitter/X commands')
    expect(result.response).toContain('/x post')
  })

  it('denies posting for members', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-member-deny',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post hello --confirm',
      role: 'MEMBER',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('ADMIN or OWNER')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('requires --confirm for posting', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-confirm-required',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post hello world',
      role: 'ADMIN',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('--confirm')
    expect(result.action?.action).toBe('twitter.preview_post')
    expect(result.action?.tweetText).toBe('hello world')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('accepts unicode dash confirm flags from telegram clients', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
        },
        json: async () => ({
          screen_name: 'keepr4626bot',
          id_str: '1739288918867214336',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: '1899999999999999998',
            text: 'gm',
          },
        }),
        text: async () => '',
      })

    const result = await handleTwitterCommand({
      groupId: 'group-unicode-confirm',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post gm —confirm',
      role: 'ADMIN',
    })

    expect(result.ok).toBe(true)
    expect((fetch as any).mock.calls.length).toBe(2)
    const [url, init] = (fetch as any).mock.calls[1]
    expect(String(url)).toBe('https://api.twitter.com/2/tweets')
    expect(String(init?.body ?? '')).toContain('"text":"gm"')
  })

  it('surfaces read-only app permissions in status output', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read' : null),
      },
      json: async () => ({
        screen_name: 'keepr4626bot',
        id_str: '1739288918867214336',
      }),
      text: async () => '',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-status-read-only',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x status',
      role: 'ADMIN',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('oauth1 access-level: read')
    expect(result.response).toContain('post capability: blocked')
    expect(result.response).toContain('Read and write')
  })

  it('blocks posting when oauth1 access is read-only', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read' : null),
      },
      json: async () => ({
        screen_name: 'keepr4626bot',
        id_str: '1739288918867214336',
      }),
      text: async () => '',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-post-read-only',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post hello world --confirm',
      role: 'OWNER',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('does not have OAuth 1.0a write permission')
    expect(result.response).toContain('@keepr4626bot')
    expect((fetch as any).mock.calls.length).toBe(1)
    expect(String((fetch as any).mock.calls[0][0])).toContain('verify_credentials')
  })

  it('posts a tweet with oauth1 user-context', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
        },
        json: async () => ({
          screen_name: 'keepr4626bot',
          id_str: '1739288918867214336',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: '1899999999999999999',
            text: 'hello world',
          },
        }),
        text: async () => '',
      })

    const result = await handleTwitterCommand({
      groupId: 'group-post-success',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post hello world --confirm',
      role: 'OWNER',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(`Expected post to succeed but failed: ${result.response}`)
    }
    expect(result.response).toContain('Tweet posted')
    expect(result.response).toContain('https://x.com/i/web/status/1899999999999999999')
    expect(result.action?.action).toBe('twitter.posted')

    expect((fetch as any).mock.calls.length).toBe(2)
    expect(String((fetch as any).mock.calls[0][0])).toContain('verify_credentials')
    const [url, init] = (fetch as any).mock.calls[1]
    expect(String(url)).toBe('https://api.twitter.com/2/tweets')
    expect(init?.method).toBe('POST')
    expect(String(init?.headers?.Authorization ?? '')).toMatch(/^OAuth /)
    expect(String(init?.body ?? '')).toContain('"text":"hello world"')
  })

  it('posts a tweet with a downloaded image attachment from a public URL', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
        },
        json: async () => ({
          screen_name: 'keepr4626bot',
          id_str: '1739288918867214336',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ media_id_string: '99112233' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: '1900000000000000001',
            text: 'chart post',
          },
        }),
        text: async () => '',
      })

    const result = await postTweetFromSystem({
      text: 'chart post',
      groupId: 'group-media-success',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      media: {
        url: 'https://4626.fun/ipfs/bafy-chart?filename=alfaclub-top-volume.png',
      },
    })

    expect(result.ok).toBe(true)
    expect((fetch as any).mock.calls.length).toBe(4)
    expect(String((fetch as any).mock.calls[1][0])).toBe(
      'https://4626.fun/ipfs/bafy-chart?filename=alfaclub-top-volume.png',
    )
    expect(String((fetch as any).mock.calls[2][0])).toBe('https://upload.twitter.com/1.1/media/upload.json')
    const tweetBody = JSON.parse(String((fetch as any).mock.calls[3][1]?.body ?? '{}'))
    expect(tweetBody.media.media_ids).toEqual(['99112233'])
    expect(result.response).toContain('https://x.com/i/web/status/1900000000000000001')
  })

  it('surfaces media upload failures cleanly', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
        },
        json: async () => ({
          screen_name: 'keepr4626bot',
          id_str: '1739288918867214336',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null),
        },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
        text: async () => JSON.stringify({ detail: 'media rejected' }),
      })

    const result = await postTweetFromSystem({
      text: 'chart post',
      groupId: 'group-media-fail',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      media: {
        url: 'https://4626.fun/ipfs/bafy-chart?filename=alfaclub-top-volume.png',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('Twitter media upload failed (403): media rejected')
    expect((fetch as any).mock.calls.length).toBe(3)
  })

  it('uses HERMIT_TWITTER_* oauth1 env vars when present', async () => {
    restoreEnv = applyEnv({
      HERMIT_TWITTER_API_KEY: 'hermit-key',
      HERMIT_TWITTER_API_SECRET: 'hermit-secret',
      HERMIT_TWITTER_ACCESS_TOKEN: 'hermit-access-token',
      HERMIT_TWITTER_ACCESS_SECRET: 'hermit-access-secret',
      TWITTER_API_KEY: undefined,
      TWITTER_API_SECRET: undefined,
      TWITTER_ACCESS_TOKEN: undefined,
      TWITTER_ACCESS_SECRET: undefined,
    })

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
      },
      json: async () => ({
        screen_name: 'keepr4626bot',
        id_str: '1739288918867214336',
      }),
      text: async () => '',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-hermit-prefix-status',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x status',
      role: 'ADMIN',
    })

    expect(result.ok).toBe(true)
    expect((fetch as any).mock.calls.length).toBe(1)
  })

  it('prefers HERMIT_TWITTER_* over TWITTER_* when both are set', async () => {
    restoreEnv = applyEnv({
      HERMIT_TWITTER_API_KEY: 'hermit-key',
      HERMIT_TWITTER_API_SECRET: 'hermit-secret',
      HERMIT_TWITTER_ACCESS_TOKEN: 'hermit-access-token',
      HERMIT_TWITTER_ACCESS_SECRET: 'hermit-access-secret',
      TWITTER_API_KEY: 'legacy-key',
      TWITTER_API_SECRET: 'legacy-secret',
      TWITTER_ACCESS_TOKEN: 'legacy-access-token',
      TWITTER_ACCESS_SECRET: 'legacy-access-secret',
    })

    ;(fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-access-level' ? 'read-write' : null),
        },
        json: async () => ({
          screen_name: 'keepr4626bot',
          id_str: '1739288918867214336',
        }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: '1900000000000000000',
            text: 'gm',
          },
        }),
        text: async () => '',
      })

    const result = await handleTwitterCommand({
      groupId: 'group-hermit-prefix-post',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x post gm --confirm',
      role: 'OWNER',
    })

    expect(result.ok).toBe(true)
    const [_, init] = (fetch as any).mock.calls[1]
    expect(String(init?.headers?.Authorization ?? '')).toContain('oauth_consumer_key="hermit-key"')
  })

  it('with HERMIT_TWITTER_STRICT enabled, ignores plain TWITTER_* fallback', async () => {
    restoreEnv = applyEnv({
      HERMIT_TWITTER_STRICT: '1',
      HERMIT_TWITTER_API_KEY: undefined,
      HERMIT_TWITTER_API_SECRET: undefined,
      HERMIT_TWITTER_ACCESS_TOKEN: undefined,
      HERMIT_TWITTER_ACCESS_SECRET: undefined,
      TWITTER_API_KEY: 'legacy-key',
      TWITTER_API_SECRET: 'legacy-secret',
      TWITTER_ACCESS_TOKEN: 'legacy-access-token',
      TWITTER_ACCESS_SECRET: 'legacy-access-secret',
    })

    const result = await handleTwitterCommand({
      groupId: 'group-hermit-strict',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/x status',
      role: 'ADMIN',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('HERMIT_TWITTER_API_KEY')
    expect((fetch as any).mock.calls.length).toBe(0)
  })
})
