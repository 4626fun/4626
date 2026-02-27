import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExternalFetchError, fetchExternalJson } from '../../server/_lib/externalFetch.ts'

describe('external fetch hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects disallowed hosts before calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchExternalJson('https://evil.test/path', {
        label: 'test',
        allowedHosts: ['api.dexscreener.com'],
      }),
    ).rejects.toBeInstanceOf(ExternalFetchError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized responses', async () => {
    const largePayload = JSON.stringify({ data: 'x'.repeat(2_000) })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(largePayload, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      fetchExternalJson('https://api.dexscreener.com/test', {
        label: 'test',
        allowedHosts: ['api.dexscreener.com'],
        maxResponseBytes: 256,
      }),
    ).rejects.toMatchObject({ reason: 'response_too_large' })
  })

  it('rejects timed-out requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        })
      }),
    )

    await expect(
      fetchExternalJson('https://api.dexscreener.com/test', {
        label: 'test',
        allowedHosts: ['api.dexscreener.com'],
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ reason: 'timeout' })
  })
})
