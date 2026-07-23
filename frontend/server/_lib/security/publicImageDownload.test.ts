import { describe, expect, it, vi } from 'vitest'

import { downloadPublicHttpsImage } from './publicImageDownload.js'

const safeLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }] as const)

describe('downloadPublicHttpsImage', () => {
  it('rejects private destinations and private redirect targets', async () => {
    await expect(downloadPublicHttpsImage({
      sourceUrl: 'https://127.0.0.1/image.png',
      maxBytes: 10,
      timeoutMs: 1_000,
    })).resolves.toEqual({ ok: false, error: 'source_url_forbidden' })

    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://169.254.169.254/latest/meta-data' },
    }))
    await expect(downloadPublicHttpsImage({
      sourceUrl: 'https://example.com/image.png',
      maxBytes: 10,
      timeoutMs: 1_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupImpl: safeLookup as any,
    })).resolves.toEqual({ ok: false, error: 'source_url_forbidden' })
  })

  it('stops streaming once the byte limit is exceeded', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: { 'content-type': 'image/png' },
    }))
    await expect(downloadPublicHttpsImage({
      sourceUrl: 'https://example.com/image.png',
      maxBytes: 3,
      timeoutMs: 1_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupImpl: safeLookup as any,
    })).resolves.toEqual({ ok: false, error: 'media_too_large' })
  })

  it('returns only allowlisted image content', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1]), {
      headers: { 'content-type': 'text/html' },
    }))
    await expect(downloadPublicHttpsImage({
      sourceUrl: 'https://example.com/image.png',
      maxBytes: 3,
      timeoutMs: 1_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupImpl: safeLookup as any,
    })).resolves.toEqual({ ok: false, error: 'unsupported_media_type' })
  })
})
