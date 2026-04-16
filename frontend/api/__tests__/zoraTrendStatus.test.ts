import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_trendStatus.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readRequestPrincipalMock,
  isAdminAddressMock,
  preflightTrendTickerMock,
  getTrendOpByTickerHashMock,
  listRecentTrendOpsMock,
} = vi.hoisted(() => ({
  readRequestPrincipalMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  preflightTrendTickerMock: vi.fn(),
  getTrendOpByTickerHashMock: vi.fn(),
  listRecentTrendOpsMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  getNumberQuery: vi.fn((req: any, key: string) => {
    const value = req.query?.[key]
    return value == null ? null : Number(value)
  }),
  getStringQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptions: vi.fn(() => false),
  setCache: vi.fn(),
  setCors: vi.fn(),
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  readRequestPrincipal: readRequestPrincipalMock,
}))

vi.mock('../../server/_lib/auth/session.js', () => ({
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/zora/trends.js', () => ({
  preflightTrendTicker: preflightTrendTickerMock,
}))

vi.mock('../../server/_lib/zora/zoraTrendOpsStore.js', () => ({
  getTrendOpByTickerHash: getTrendOpByTickerHashMock,
  listRecentTrendOps: listRecentTrendOpsMock,
}))

describe('GET /api/zora/trendStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin authorization', async () => {
    readRequestPrincipalMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.success).toBe(false)
  })

  it('returns recent trend ops when ticker is omitted', async () => {
    readRequestPrincipalMock.mockReturnValueOnce({ address: '0xabc', source: 'session' })
    isAdminAddressMock.mockReturnValueOnce(true)
    listRecentTrendOpsMock.mockResolvedValueOnce([{ ticker: 'BASE', status: 'deployed' }])

    const req = createMockReq({ method: 'GET', query: { limit: '5' } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.recent).toEqual([{ ticker: 'BASE', status: 'deployed' }])
    expect(listRecentTrendOpsMock).toHaveBeenCalledWith(5)
  })

  it('returns preflight and stored state when ticker is provided', async () => {
    readRequestPrincipalMock.mockReturnValueOnce({ address: '0xabc', source: 'session' })
    isAdminAddressMock.mockReturnValueOnce(true)
    preflightTrendTickerMock.mockResolvedValueOnce({
      ticker: 'BASEAI',
      tickerHash: '0xhash',
      predictedAddress: '0x1111111111111111111111111111111111111111',
      deployed: true,
      deployedBytecode: '0x1234',
    })
    getTrendOpByTickerHashMock.mockResolvedValueOnce({
      ticker: 'BASEAI',
      status: 'deployed',
      txHash: '0xtx',
    })

    const req = createMockReq({ method: 'GET', query: { ticker: 'baseai' } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.preflight?.ticker).toBe('BASEAI')
    expect(res.body?.data?.stored?.status).toBe('deployed')
  })
})

