import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  streamResponseMock,
  getElizaLlmServiceMock,
  readSessionFromRequestMock,
  checkRateLimitMock,
  getClientIpMock,
} = vi.hoisted(() => ({
  streamResponseMock: vi.fn(),
  getElizaLlmServiceMock: vi.fn(),
  readSessionFromRequestMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
}))

vi.mock('../../server/agents/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))

vi.mock('../../server/auth/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('../../server/auth/_shared.js')
  return {
    ...actual,
    readSessionFromRequest: readSessionFromRequestMock,
  }
})

vi.mock('../../server/_lib/infra/rateLimit.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/infra/rateLimit.js')>('../../server/_lib/infra/rateLimit.js')
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    getClientIp: getClientIpMock,
  }
})

describe('agent stream handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSessionFromRequestMock.mockReturnValue({
      address: '0x1111111111111111111111111111111111111111',
    })
    getClientIpMock.mockReturnValue('127.0.0.1')
    checkRateLimitMock.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60_000,
    })
    getElizaLlmServiceMock.mockReturnValue({
      streamResponse: streamResponseMock,
    })
  })

  it('returns 401 when auth session is missing', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null)
    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { message: 'hi' },
      url: '/api/agent/stream',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'Unauthorized' })
    expect(streamResponseMock).not.toHaveBeenCalled()
  })

  it('returns SSE events for a valid message', async () => {
    streamResponseMock.mockImplementation(async function* () {
      yield { type: 'meta', data: { provider: 'OpenAI' } }
      yield { type: 'delta', data: { text: 'hello ' } }
      yield { type: 'done', data: { text: 'hello world' } }
    })

    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { message: 'hi' },
      url: '/api/agent/stream',
    })
    const res = createMockRes() as any
    const chunks: string[] = []
    res.write = vi.fn((chunk: string) => {
      chunks.push(String(chunk))
      return true
    })
    res.flushHeaders = vi.fn()

    await handler(req, res)

    const payload = chunks.join('')
    expect(streamResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      abortSignal: expect.any(Object),
    }))
    expect(String(res.getHeader('content-type'))).toContain('text/event-stream')
    expect(payload).toContain('event: open')
    expect(payload).toContain('event: meta')
    expect(payload).toContain('event: delta')
    expect(payload).toContain('event: done')
    expect(payload).toContain('event: close')
  })

  it('returns 400 when message is missing', async () => {
    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: {},
      url: '/api/agent/stream',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'message is required' })
  })

  it('returns 400 when context is too long', async () => {
    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { message: 'hi', context: 'x'.repeat(4001) },
      url: '/api/agent/stream',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'context is too long' })
    expect(streamResponseMock).not.toHaveBeenCalled()
  })

  it('returns 413 when post body exceeds max bytes', async () => {
    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      headers: { 'content-length': '17000' },
      url: '/api/agent/stream',
      body: { message: 'hi' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(413)
    expect(res.body).toEqual({ success: false, error: 'Request body is too large' })
    expect(streamResponseMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid post JSON body', async () => {
    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      url: '/api/agent/stream',
      body: ['not-an-object'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid JSON body' })
    expect(streamResponseMock).not.toHaveBeenCalled()
  })

  it('returns 429 when stream rate limit is exceeded', async () => {
    checkRateLimitMock
      .mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 20_000,
      })
      .mockReturnValueOnce({
        allowed: true,
        remaining: 20,
        resetAt: Date.now() + 20_000,
      })

    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { message: 'hi' },
      url: '/api/agent/stream',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ success: false, error: 'Rate limit exceeded' })
    expect(res.getHeader('x-ratelimit-limit')).toBeTruthy()
    expect(streamResponseMock).not.toHaveBeenCalled()
  })

  it('emits SSE error event when streaming fails', async () => {
    streamResponseMock.mockImplementation(async function* () {
      throw new Error('upstream timeout')
      yield { type: 'done', data: {} }
    })

    const mod = await import('../_handlers/agent/_stream.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { message: 'hi' },
      url: '/api/agent/stream',
    })
    const res = createMockRes() as any
    const chunks: string[] = []
    res.write = vi.fn((chunk: string) => {
      chunks.push(String(chunk))
      return true
    })
    res.flushHeaders = vi.fn()

    await handler(req, res)

    const payload = chunks.join('')
    expect(payload).toContain('event: open')
    expect(payload).toContain('event: error')
    expect(payload).toContain('stream_failed')
  })
})
