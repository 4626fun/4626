import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pingVirtualsCompute } from './computePing.js'

describe('pingVirtualsCompute', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ok when compute responds with content', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'pong' } }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const result = await pingVirtualsCompute({ apiKey: 'virtuals-key', timeoutMs: 5_000 })
    expect(result).toEqual({ ok: true, model: 'moonshotai/kimi-k2-0905', content: 'pong' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://compute.virtuals.io/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer virtuals-key',
        }),
      }),
    )
  })

  it('returns structured failure for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: 'invalid_api_key' } }), {
          status: 401,
        })
      }) as any,
    )

    const result = await pingVirtualsCompute({ apiKey: 'bad-key', timeoutMs: 5_000 })
    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_api_key' })
  })
})
