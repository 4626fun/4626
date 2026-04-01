import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/cli/_authStatus.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  setCacheMock,
  setCorsMock,
  requireServerKeyMock,
  authStatusCliMock,
  toCliErrorPayloadMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setCacheMock: vi.fn(),
  setCorsMock: vi.fn(),
  requireServerKeyMock: vi.fn(() => 'test-zora-key'),
  authStatusCliMock: vi.fn(),
  toCliErrorPayloadMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  handleOptions: handleOptionsMock,
  requireServerKey: requireServerKeyMock,
  setCache: setCacheMock,
  setCors: setCorsMock,
}))

vi.mock('../../server/zora/cliCompat.js', () => ({
  authStatusCli: authStatusCliMock,
  toCliErrorPayload: toCliErrorPayloadMock,
}))

describe('GET /api/zora/cli/authStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStatusCliMock.mockReturnValue({
      authenticated: true,
      key: 'abcdef12...3456',
      source: 'env:ZORA_SERVER_API_KEY',
    })
  })

  it('returns auth status payload', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      authenticated: true,
      key: 'abcdef12...3456',
      source: 'env:ZORA_SERVER_API_KEY',
    })
    expect(setCacheMock).toHaveBeenCalledWith(res, 30)
  })

  it('rejects non-GET methods to keep endpoint read-only', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({
      error: 'Method not allowed',
      suggestion: 'Use GET /api/zora/cli/authStatus.',
    })
  })
})
