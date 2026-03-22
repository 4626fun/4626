import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}))

describe('image external proxy route registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  })

  it('registers the standalone image external proxy route', async () => {
    await expect(import('../image/external.ts')).resolves.toMatchObject({ default: expect.any(Function) })
  })
})

describe('GET /api/image/external', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.unstubAllGlobals()
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  })

  it('rejects non-GET methods', async () => {
    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('rejects invalid or unsafe URLs before calling upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { url: 'http://127.0.0.1/logo.png' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid image URL' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects hostnames that resolve to private IPs', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { url: 'https://cdn.example.com/token.png' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid image URL' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects redirects to unsafe hosts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/logo.png' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { url: 'https://cdn.example.com/token.png' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid image URL' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-image upstream responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not-an-image', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { url: 'https://cdn.example.com/token.png' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(415)
    expect(res.body).toEqual({ success: false, error: 'Upstream did not return an image' })
  })

  it('proxies image responses with cache headers', async () => {
    const payload = new Uint8Array([137, 80, 78, 71])
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/image/_external-proxy.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { url: 'https://cdn.example.com/token.png' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('image/png')
    expect(String(res.getHeader('cache-control') ?? '')).toContain('public')
    expect(res.body).toBeInstanceOf(Buffer)
  })
})
