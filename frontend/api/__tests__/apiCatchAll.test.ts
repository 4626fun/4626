import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

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
})
