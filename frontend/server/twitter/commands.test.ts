import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEnv } from '../../api/__tests__/helpers'

import { handleTwitterCommand } from './commands.js'

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
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('posts a tweet with oauth1 user-context', async () => {
    restoreEnv = applyEnv({
      TWITTER_API_KEY: 'key',
      TWITTER_API_SECRET: 'secret',
      TWITTER_ACCESS_TOKEN: 'token',
      TWITTER_ACCESS_SECRET: 'token-secret',
    })

    ;(fetch as any).mockResolvedValueOnce({
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

    expect((fetch as any).mock.calls.length).toBe(1)
    const [url, init] = (fetch as any).mock.calls[0]
    expect(String(url)).toBe('https://api.twitter.com/2/tweets')
    expect(init?.method).toBe('POST')
    expect(String(init?.headers?.Authorization ?? '')).toMatch(/^OAuth /)
    expect(String(init?.body ?? '')).toContain('"text":"hello world"')
  })
})
