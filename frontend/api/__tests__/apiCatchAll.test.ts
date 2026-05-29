import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COOKIE_SESSION, makeSessionToken } from '@4626/server-core'
import { applyEnv, createMockReq, createMockRes } from './helpers'

describe('api catch-all hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.doUnmock('../_handlers/_routes.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns generic 500 response without stack details', async () => {
    vi.doMock('../_handlers/_routes.js', () => ({
      getApiHandler: vi.fn(async () => {
        throw new Error('db://sensitive-connection-string')
      }),
    }))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { path: 'health' },
      url: '/api/health',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'Internal server error' })
    expect(JSON.stringify(res.body)).not.toContain('db://sensitive-connection-string')
    errorSpy.mockRestore()
  })

  it('returns stable envelope for unknown routes', async () => {
    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { path: 'does/not/exist' },
      url: '/api/does/not/exist',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ success: false, error: 'Not found' })
    expect(res.getHeader('cache-control')).toBe('no-store')
    expect(res.getHeader('x-content-type-options')).toBe('nosniff')
  })

  it('rejects unsupported HTTP methods before route resolution', async () => {
    const getApiHandler = vi.fn(async () => null)
    vi.doMock('../_handlers/_routes.js', () => ({ getApiHandler }))

    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'TRACE',
      query: { path: 'health' },
      url: '/api/health',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
    expect(res.getHeader('cache-control')).toBe('no-store')
    expect(getApiHandler).not.toHaveBeenCalled()
  })

  it('rejects overly long route subpaths', async () => {
    const mod = await import('../[...path].ts')
    const handler = mod.default
    const longSubpath = `health/${'a'.repeat(300)}`
    const req = createMockReq({
      method: 'GET',
      query: { path: longSubpath },
      url: `/api/${longSubpath}`,
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ success: false, error: 'Not found' })
    expect(res.getHeader('cache-control')).toBe('no-store')
  })

  it('allows dotted API subpaths like v1/spec.json', async () => {
    const routeHandler = vi.fn(async (_req, res) => {
      res.status(200).json({ ok: true })
    })
    const getApiHandler = vi.fn(async (subpath: string) => (subpath === 'v1/spec.json' ? routeHandler : null))

    vi.doMock('../_handlers/_routes.js', () => ({
      getApiHandler,
    }))

    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { path: 'v1/spec.json' },
      url: '/api/v1/spec.json',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(getApiHandler).toHaveBeenCalledWith('v1/spec.json')
    expect(routeHandler).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('loads paymaster route and preserves JSON-RPC envelope', async () => {
    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { path: 'paymaster' },
      url: '/api/paymaster',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Method not allowed' },
    })
  })

  it('returns JSON-RPC envelope for paymaster route failures', async () => {
    vi.doMock('../_handlers/_routes.js', () => ({
      getApiHandler: vi.fn(async () => {
        throw new Error('paymaster init failed')
      }),
    }))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const mod = await import('../[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      query: { path: 'paymaster' },
      url: '/api/paymaster',
      body: { jsonrpc: '2.0', id: 1, method: 'eth_supportedEntryPoints', params: [] },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32000, message: 'request denied - paymaster proxy internal error' },
    })
    errorSpy.mockRestore()
  })

  it('blocks cookie-authenticated unsafe requests from untrusted origins before handler execution', async () => {
    const restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      APP_ORIGIN: 'https://trusted.4626.fun',
      CORS_ALLOWED_ORIGINS: undefined,
    })
    try {
      const routeHandler = vi.fn(async (_req, res) => {
        res.status(200).json({ ok: true })
      })
      const getApiHandler = vi.fn(async (subpath: string) => (subpath === 'unsafe/demo' ? routeHandler : null))

      vi.doMock('../_handlers/_routes.js', () => ({
        getApiHandler,
      }))

      const mod = await import('../[...path].ts')
      const handler = mod.default
      const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000aa' })
      const cookie = `${COOKIE_SESSION}=${encodeURIComponent(token)}`

      const blockedReq = createMockReq({
        method: 'POST',
        query: { path: 'unsafe/demo' },
        url: '/api/unsafe/demo',
        headers: {
          cookie,
          origin: 'https://evil.example',
        },
      })
      const blockedRes = createMockRes()

      await handler(blockedReq, blockedRes)

      expect(blockedRes.statusCode).toBe(403)
      expect(blockedRes.body).toEqual({ success: false, error: 'Forbidden' })
      expect(blockedRes.getHeader('cache-control')).toBe('no-store')
      expect(routeHandler).not.toHaveBeenCalled()

      const allowedReq = createMockReq({
        method: 'POST',
        query: { path: 'unsafe/demo' },
        url: '/api/unsafe/demo',
        headers: {
          cookie,
          origin: 'https://trusted.4626.fun',
        },
      })
      const allowedRes = createMockRes()

      await handler(allowedReq, allowedRes)

      expect(allowedRes.statusCode).toBe(200)
      expect(allowedRes.body).toEqual({ ok: true })
      expect(routeHandler).toHaveBeenCalledOnce()
    } finally {
      restoreEnv()
    }
  })
})
