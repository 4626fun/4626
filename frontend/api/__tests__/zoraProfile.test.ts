import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_profile.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getStringQueryMock,
  handleOptionsMock,
  requireServerKeyMock,
  setCacheMock,
  setCorsMock,
  fetchZoraProfileMock,
} = vi.hoisted(() => ({
  getStringQueryMock: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptionsMock: vi.fn(() => false),
  requireServerKeyMock: vi.fn(() => 'test-zora-key'),
  setCacheMock: vi.fn(),
  setCorsMock: vi.fn(),
  fetchZoraProfileMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  getStringQuery: getStringQueryMock,
  handleOptions: handleOptionsMock,
  requireServerKey: requireServerKeyMock,
  setCache: setCacheMock,
  setCors: setCorsMock,
}))

vi.mock('../../server/_lib/zoraProfile.js', () => ({
  fetchZoraProfile: fetchZoraProfileMock,
}))

describe('GET /api/zora/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchZoraProfileMock.mockResolvedValue({
      handle: 'akita',
      creatorCoin: { address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' },
    })
  })

  it('returns profile data via shared resolver and keeps cache semantics', async () => {
    const req = createMockReq({
      method: 'GET',
      query: {
        identifier: 'akita',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: {
        handle: 'akita',
        creatorCoin: { address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' },
      },
    })
    expect(fetchZoraProfileMock).toHaveBeenCalledWith('akita')
    expect(setCacheMock).toHaveBeenCalledWith(res, 300)
  })

  it('returns 501 when server api key is not configured', async () => {
    requireServerKeyMock.mockReturnValueOnce('')
    const req = createMockReq({
      method: 'GET',
      query: {
        identifier: 'akita',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(501)
    expect(res.body).toEqual({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
    expect(fetchZoraProfileMock).not.toHaveBeenCalled()
  })

  it('returns 400 when identifier is missing', async () => {
    const req = createMockReq({
      method: 'GET',
      query: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Missing identifier' })
    expect(fetchZoraProfileMock).not.toHaveBeenCalled()
  })
})
