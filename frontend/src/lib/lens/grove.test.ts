import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveLensUri, uploadImmutableJson } from './grove'

describe('grove upload helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('parses JSON responses with array payloads', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
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
  })

  it('parses text/plain JSON responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
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
    const fetchMock = vi.fn(async () => new Response('bad', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadImmutableJson({ fail: true }, 232)).rejects.toThrow('Grove upload failed')
  })

  it('resolves lens URIs to gateway URLs', () => {
    expect(resolveLensUri('lens://abc')).toBe('https://api.grove.storage/abc')
    expect(resolveLensUri('https://api.grove.storage/abc')).toBe('https://api.grove.storage/abc')
  })
})
