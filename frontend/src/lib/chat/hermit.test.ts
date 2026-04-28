import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

import { runHermitCommand } from '@/lib/chat/hermit'

function makeResponse(params: {
  ok: boolean
  status?: number
  payload: unknown
}): Response {
  return {
    ok: params.ok,
    status: params.status ?? (params.ok ? 200 : 500),
    json: async () => params.payload,
  } as Response
}

describe('runHermitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns typed Hermit payload for success envelope', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          success: true,
          data: {
            kind: 'gmeow',
            provider: 'local',
            reply: 'gm',
            meme: {
              id: 'm-1',
              url: 'https://example.com/meme.gif',
              caption: 'gm',
              tags: ['gm'],
            },
          },
        },
      }),
    )

    const result = await runHermitCommand('/gmeow gm')

    expect(result.kind).toBe('gmeow')
    expect(result.provider).toBe('local')
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v1/chat/hermit',
      expect.objectContaining({
        method: 'POST',
        withCredentials: true,
      }),
    )
  })

  it('surfaces API error on non-OK response', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: false,
        status: 403,
        payload: {
          success: false,
          error: 'Hermit access denied',
        },
      }),
    )

    await expect(runHermitCommand('/hermit hello')).rejects.toThrow('Hermit access denied')
  })

  it('rejects success envelope with invalid data shape', async () => {
    apiFetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        payload: {
          success: true,
          data: {
            kind: 'hermit',
            provider: 'local',
            reply: 'ok',
            extra: 'not-allowed',
          },
        },
      }),
    )

    await expect(runHermitCommand('/hermit hello')).rejects.toThrow('Hermit response data shape was invalid')
  })
})
