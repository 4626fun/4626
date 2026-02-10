import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchLensJson, resolveLensUri, uploadImmutableJson } from './grove'

/**
 * The StorageClient SDK calls `fetch` internally:
 *   1. POST to upload (expects JSON array response)
 *   2. GET /status/<key> to poll propagation (expects `{ status: "done" }`)
 *
 * Our mock routes on URL to return the right shape for each.
 */
function createGroveMock(storageKey: string) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    // Status polling endpoint
    if (url.includes('/status/')) {
      return new Response(JSON.stringify({ status: 'done' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    // Upload endpoint — SDK expects a JSON array
    return new Response(
      JSON.stringify([
        {
          storage_key: storageKey,
          gateway_url: `https://api.grove.storage/${storageKey}`,
          uri: `lens://${storageKey}`,
        },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
}

describe('grove upload helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uploads JSON and returns normalized result', async () => {
    const fetchMock = createGroveMock('abc')
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImmutableJson({ hello: 'world' }, 232)
    expect(result.storageKey).toBe('abc')
    expect(result.gatewayUrl).toBe('https://api.grove.storage/abc')
    expect(result.lensUri).toBe('lens://abc')

    // SDK should have called fetch at least once (upload + status poll)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('resolves lens URIs to gateway URLs', () => {
    expect(resolveLensUri('lens://abc')).toBe('https://api.grove.storage/abc')
    expect(resolveLensUri('https://api.grove.storage/abc')).toBe('https://api.grove.storage/abc')
  })

  it('fetches and parses JSON from lens:// URI', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ name: 'creator' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchLensJson<{ name: string }>('lens://meta-1')
    expect(fetchMock).toHaveBeenCalledWith('https://api.grove.storage/meta-1', undefined)
    expect(result.name).toBe('creator')
  })

  it('returns empty string for empty uri', () => {
    expect(resolveLensUri('')).toBe('')
  })

  it('passes through non-lens URIs unchanged', () => {
    expect(resolveLensUri('https://example.com/data')).toBe('https://example.com/data')
  })
})
