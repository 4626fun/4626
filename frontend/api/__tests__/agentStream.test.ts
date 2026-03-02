import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { streamResponseMock, getElizaLlmServiceMock } = vi.hoisted(() => ({
  streamResponseMock: vi.fn(),
  getElizaLlmServiceMock: vi.fn(),
}))

vi.mock('../../server/agent/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))

describe('agent stream handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getElizaLlmServiceMock.mockReturnValue({
      streamResponse: streamResponseMock,
    })
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

