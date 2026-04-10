import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_trendReserve.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readRequestPrincipalMock,
  isAdminAddressMock,
  upsertTrendPredictionMock,
  markTrendOpDeployingMock,
  markTrendOpDeployedMock,
  markTrendOpFailedMock,
  preflightTrendTickerMock,
  reserveTrendTickerMock,
} = vi.hoisted(() => ({
  readRequestPrincipalMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  upsertTrendPredictionMock: vi.fn(),
  markTrendOpDeployingMock: vi.fn(),
  markTrendOpDeployedMock: vi.fn(),
  markTrendOpFailedMock: vi.fn(),
  preflightTrendTickerMock: vi.fn(),
  reserveTrendTickerMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipal: readRequestPrincipalMock,
}))

vi.mock('../../server/_lib/session.js', () => ({
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/zoraTrendOpsStore.js', () => ({
  upsertTrendPrediction: upsertTrendPredictionMock,
  markTrendOpDeploying: markTrendOpDeployingMock,
  markTrendOpDeployed: markTrendOpDeployedMock,
  markTrendOpFailed: markTrendOpFailedMock,
}))

vi.mock('../../server/zora/trends.js', () => ({
  preflightTrendTicker: preflightTrendTickerMock,
  reserveTrendTicker: reserveTrendTickerMock,
}))

describe('POST /api/zora/trendReserve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readRequestPrincipalMock.mockReturnValue({ address: '0xabc', source: 'session' })
    isAdminAddressMock.mockReturnValue(true)
  })

  it('validates creatorToken', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        ticker: 'BASE',
        creatorToken: 'bad',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toMatch(/Invalid creatorToken/i)
    expect(String(res.getHeader('cache-control') ?? '')).toBe('no-store')
  })

  it('rejects oversized request payloads', async () => {
    const req = createMockReq({
      method: 'POST',
      body: 'x'.repeat(20_000),
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(413)
    expect(String(res.body?.error ?? '')).toContain('Request body too large')
  })

  it('short-circuits when preflight shows deployed trend', async () => {
    preflightTrendTickerMock.mockResolvedValueOnce({
      ticker: 'BASE',
      tickerHash: '0xhash',
      predictedAddress: '0x1111111111111111111111111111111111111111',
      deployed: true,
      deployedBytecode: '0x1234',
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        ticker: 'BASE',
        creatorToken: '0x2222222222222222222222222222222222222222',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.status).toBe('already_deployed')
    expect(markTrendOpDeployedMock).toHaveBeenCalledTimes(1)
    expect(reserveTrendTickerMock).not.toHaveBeenCalled()
  })

  it('reserves and persists deployed status', async () => {
    preflightTrendTickerMock.mockResolvedValueOnce({
      ticker: 'BASE',
      tickerHash: '0xhash2',
      predictedAddress: '0x1111111111111111111111111111111111111111',
      deployed: false,
      deployedBytecode: null,
    })
    reserveTrendTickerMock.mockResolvedValueOnce({
      ticker: 'BASE',
      tickerHash: '0xhash2',
      predictedAddress: '0x1111111111111111111111111111111111111111',
      deployedAddress: '0x1111111111111111111111111111111111111111',
      deployed: true,
      txHash: '0xtx',
      walletAddress: '0x3333333333333333333333333333333333333333',
      walletId: 'wallet_1',
      status: 'deployed',
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        ticker: 'BASE',
        creatorToken: '0x2222222222222222222222222222222222222222',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('deployed')
    expect(markTrendOpDeployingMock).toHaveBeenCalledTimes(1)
    expect(markTrendOpDeployedMock).toHaveBeenCalledTimes(1)
  })
})
