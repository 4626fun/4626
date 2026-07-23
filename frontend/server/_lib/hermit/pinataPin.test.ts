import { afterEach, describe, expect, it, vi } from 'vitest'

import { pinRemoteMediaToPinata, readPinataJwt } from './pinataPin.js'

describe('pinRemoteMediaToPinata', () => {
  const safeLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }] as const)

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('fails closed without PINATA_JWT', async () => {
    vi.stubEnv('PINATA_JWT', '')
    expect(readPinataJwt()).toBeNull()
    const result = await pinRemoteMediaToPinata({
      sourceUrl: 'https://example.com/cat.gif',
      lookupImpl: safeLookup as any,
    })
    expect(result).toEqual({ ok: false, error: 'pinata_jwt_missing' })
  })

  it('rejects non-https sources', async () => {
    vi.stubEnv('PINATA_JWT', 'test-jwt')
    const result = await pinRemoteMediaToPinata({
      sourceUrl: 'http://example.com/cat.gif',
    })
    expect(result).toEqual({ ok: false, error: 'source_url_must_be_https' })
  })

  it('rejects private and link-local source hosts', async () => {
    vi.stubEnv('PINATA_JWT', 'test-jwt')
    await expect(
      pinRemoteMediaToPinata({
        sourceUrl: 'https://169.254.169.254/latest/meta-data',
      }),
    ).resolves.toEqual({ ok: false, error: 'source_url_forbidden' })
  })

  it('rejects non-image content-types and insecure redirect targets', async () => {
    vi.stubEnv('PINATA_JWT', 'test-jwt')

    const htmlFetch = vi.fn(async () => new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }))
    await expect(
      pinRemoteMediaToPinata({
        sourceUrl: 'https://example.com/cat.gif',
        fetchImpl: htmlFetch as unknown as typeof fetch,
        lookupImpl: safeLookup as any,
      }),
    ).resolves.toEqual({ ok: false, error: 'unsupported_media_type' })

    const redirectFetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://example.com/cat.gif' },
    }))
    await expect(
      pinRemoteMediaToPinata({
        sourceUrl: 'https://example.com/cat.gif',
        fetchImpl: redirectFetch as unknown as typeof fetch,
        lookupImpl: safeLookup as any,
      }),
    ).resolves.toEqual({ ok: false, error: 'source_url_forbidden' })
  })

  it('pins fetched bytes and brands 4626.fun gateway URL', async () => {
    vi.stubEnv('PINATA_JWT', 'test-jwt')
    vi.stubEnv('HERMIT_AGENT_GATEWAY_BASE', 'https://4626.fun')
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00])
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('example.com')) {
        return new Response(gifBytes, {
          status: 200,
          headers: { 'content-type': 'image/gif' },
        })
      }
      if (url.includes('pinata.cloud')) {
        expect(init?.method).toBe('POST')
        expect(String((init?.headers as Record<string, string>)?.Authorization ?? '')).toContain(
          'Bearer test-jwt',
        )
        return new Response(JSON.stringify({ IpfsHash: 'bafytestcid123' }), { status: 200 })
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const result = await pinRemoteMediaToPinata({
      sourceUrl: 'https://example.com/path/cat.gif',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupImpl: safeLookup as any,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cid).toBe('bafytestcid123')
    expect(result.url).toContain('https://4626.fun/ipfs/bafytestcid123')
    expect(result.url).toContain('filename=cat.gif')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
