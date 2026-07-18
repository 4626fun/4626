import { afterEach, describe, expect, it, vi } from 'vitest'

import { pinRemoteMediaToPinata, readPinataJwt } from './pinataPin.js'

describe('pinRemoteMediaToPinata', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('fails closed without PINATA_JWT', async () => {
    vi.stubEnv('PINATA_JWT', '')
    expect(readPinataJwt()).toBeNull()
    const result = await pinRemoteMediaToPinata({
      sourceUrl: 'https://example.com/cat.gif',
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
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cid).toBe('bafytestcid123')
    expect(result.url).toContain('https://4626.fun/ipfs/bafytestcid123')
    expect(result.url).toContain('filename=cat.gif')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
