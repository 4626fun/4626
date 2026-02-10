import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchLensJson, resolveLensUri, uploadImmutableJson } from './grove'

describe('grove upload helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('parses JSON responses with array payloads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([{
      storage_key: 'abc',
      gateway_url: 'https://api.grove.storage/abc',
      uri: 'lens://abc',
      status_url: 'https://api.grove.storage/status/abc',
    }]), { status: 201, headers: { 'content-type': 'application/json' } }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImmutableJson({ hello: 'world' }, 232)
    expect(result.storageKey).toBe('abc')
    expect(result.gatewayUrl).toBe('https://api.grove.storage/abc')
    expect(result.lensUri).toBe('lens://abc')
    expect(result.statusUrl).toBe('https://api.grove.storage/status/abc')

    // Verify one-step upload sends raw body with Content-Type header (not FormData)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.grove.storage/?chain_id=232')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(typeof init?.body).toBe('string')
    expect(JSON.parse(String(init?.body))).toEqual({ hello: 'world' })
  })

  it('parses single-object response (one-step upload format)', async () => {
    // Per Lens docs, one-step upload returns a single object, not an array
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      storage_key: 'single',
      gateway_url: 'https://api.grove.storage/single',
      uri: 'lens://single',
      status_url: 'https://api.grove.storage/status/single',
    }), { status: 201, headers: { 'content-type': 'application/json' } }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImmutableJson({ test: true }, 232)
    expect(result.storageKey).toBe('single')
    expect(result.gatewayUrl).toBe('https://api.grove.storage/single')
    expect(result.lensUri).toBe('lens://single')
    expect(result.statusUrl).toBe('https://api.grove.storage/status/single')
  })

  it('handles 202 Accepted status (async propagation)', async () => {
    // Per Lens docs, Grove may return 202 when saving to edge infrastructure
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      storage_key: 'pending',
      gateway_url: 'https://api.grove.storage/pending',
      uri: 'lens://pending',
      status_url: 'https://api.grove.storage/status/pending',
    }), { status: 202, headers: { 'content-type': 'application/json' } }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImmutableJson({ async: true }, 232)
    expect(result.storageKey).toBe('pending')
    expect(result.statusUrl).toBe('https://api.grove.storage/status/pending')
  })

  it('parses text/plain JSON responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([{
      storage_key: 'xyz',
      gateway_url: 'https://api.grove.storage/xyz',
      uri: 'lens://xyz',
    }]), { status: 200, headers: { 'content-type': 'text/plain' } }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadImmutableJson({ ok: true }, 232)
    expect(result.storageKey).toBe('xyz')
    expect(result.gatewayUrl).toBe('https://api.grove.storage/xyz')
    expect(result.lensUri).toBe('lens://xyz')
    expect(result.statusUrl).toBeNull()
  })

  it('throws on non-success responses', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('bad', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadImmutableJson({ fail: true }, 232)).rejects.toThrow('Grove upload failed')
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
})
