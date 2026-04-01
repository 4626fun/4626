import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/cli/_explore.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getNumberQueryMock,
  getStringQueryMock,
  handleOptionsMock,
  requireServerKeyMock,
  setCacheMock,
  setCorsMock,
  exploreCliMock,
  toCliErrorPayloadMock,
} = vi.hoisted(() => ({
  getNumberQueryMock: vi.fn((req: any, key: string) => {
    const value = req.query?.[key]
    return value == null ? null : Number(value)
  }),
  getStringQueryMock: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptionsMock: vi.fn(() => false),
  requireServerKeyMock: vi.fn(() => 'test-zora-key'),
  setCacheMock: vi.fn(),
  setCorsMock: vi.fn(),
  exploreCliMock: vi.fn(),
  toCliErrorPayloadMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  getNumberQuery: getNumberQueryMock,
  getStringQuery: getStringQueryMock,
  handleOptions: handleOptionsMock,
  requireServerKey: requireServerKeyMock,
  setCache: setCacheMock,
  setCors: setCorsMock,
}))

vi.mock('../../server/zora/cliCompat.js', () => ({
  exploreCli: exploreCliMock,
  toCliErrorPayload: toCliErrorPayloadMock,
}))

describe('GET /api/zora/cli/explore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireServerKeyMock.mockReturnValue('test-zora-key')
    exploreCliMock.mockResolvedValue({
      coins: [{ name: 'Akita', address: '0x1111111111111111111111111111111111111111' }],
      nextCursor: null,
    })
  })

  it('returns CLI-compatible explore payload', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { sort: 'trending', type: 'all', limit: '5' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(exploreCliMock).toHaveBeenCalledWith({
      serverKey: 'test-zora-key',
      sort: 'trending',
      type: 'all',
      limit: 5,
      cursor: null,
    })
    expect(res.body).toEqual({
      coins: [{ name: 'Akita', address: '0x1111111111111111111111111111111111111111' }],
      nextCursor: null,
    })
    expect(setCacheMock).toHaveBeenCalledWith(res, 60)
  })

  it('returns 501 when ZORA_SERVER_API_KEY is missing', async () => {
    requireServerKeyMock.mockReturnValueOnce('')
    const req = createMockReq({ method: 'GET', query: { sort: 'trending' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(501)
    expect(res.body).toEqual({
      error: 'ZORA_SERVER_API_KEY is not configured',
      suggestion: 'Set ZORA_SERVER_API_KEY in the server environment.',
    })
    expect(exploreCliMock).not.toHaveBeenCalled()
  })

  it('uses consistent error envelope when compat layer throws', async () => {
    exploreCliMock.mockRejectedValueOnce(new Error('upstream timeout'))
    toCliErrorPayloadMock.mockReturnValueOnce({
      status: 502,
      body: { error: 'upstream timeout', suggestion: 'retry shortly' },
    })
    const req = createMockReq({ method: 'GET', query: { sort: 'trending' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'upstream timeout', suggestion: 'retry shortly' })
  })
})
